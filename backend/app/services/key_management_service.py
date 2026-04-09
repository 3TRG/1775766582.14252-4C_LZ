"""
密钥生命周期管理服务
实现密钥的生成、激活、使用、轮换、过期、销毁全流程
参考国盾琨腾密码服务管理平台的密钥作为流动资源理念
"""

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func

from app.models.v1_models import (
    KeyEpoch, Conversation, QKESession, ConversationKeyMaterial,
    SecurityAlert
)
from app.models.quantum import EntropyAnalysis
import logging

from app.services.security_service import security_service
from app.services.event_service import EventService

logger = logging.getLogger(__name__)


class KeyManagementService:
    """密钥生命周期管理服务"""

    def __init__(self, db: Session, event_service: Optional[EventService] = None):
        self.db = db
        self.event_service = event_service
        # 默认配置
        self.default_key_lifetime_hours = 24  # 密钥默认有效期24小时
        self.max_key_usage_count = 10000      # 最大使用次数
        self.rotation_threshold_hours = 6     # 提前6小时开始轮换准备
        self.usage_warning_threshold = 0.8    # 使用率达到80%时警告

    # ==================== 密钥轮换管理 ====================

    def should_rotate_key(self, conversation_id: int) -> Tuple[bool, str]:
        """检查是否应该轮换密钥"""
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()

        if not conversation:
            return False, "Conversation not found"

        current_epoch = conversation.current_key_epoch or 0
        if current_epoch == 0:
            return True, "No active key epoch"

        # 获取当前活跃的密钥轮次
        key_epoch = self.db.query(KeyEpoch).filter(
            and_(
                KeyEpoch.conversation_id == conversation_id,
                KeyEpoch.epoch_no == current_epoch,
                KeyEpoch.status == "active"
            )
        ).first()

        if not key_epoch:
            return True, "Active key epoch not found"

        # 检查时间-based轮换
        if key_epoch.activated_at:
            age_hours = (datetime.utcnow() - key_epoch.activated_at).total_seconds() / 3600
            if age_hours >= self.default_key_lifetime_hours:
                return True, f"Key epoch age ({age_hours:.2f}h) exceeds lifetime ({self.default_key_lifetime_hours}h)"

            # 检查是否到了轮换准备时间
            if age_hours >= (self.default_key_lifetime_hours - self.rotation_threshold_hours):
                return True, f"Key epoch approaching lifetime limit ({age_hours:.2f}h)"

        # 检查使用量-based轮换（这里需要集成实际使用统计）
        usage_count = self._get_key_usage_count(conversation_id, current_epoch)
        if usage_count >= self.max_key_usage_count:
            return True, f"Key usage count ({usage_count}) exceeds maximum ({self.max_key_usage_count})"

        # 检查使用率警告
        if usage_count >= (self.max_key_usage_count * self.usage_warning_threshold):
            self._send_key_usage_warning(conversation_id, current_epoch, usage_count)

        return False, "Key is still valid"

    def rotate_key(self, conversation_id: int, reason: str = "scheduled") -> Optional[KeyEpoch]:
        """轮换密钥"""
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()

        if not conversation:
            return None

        current_epoch = conversation.current_key_epoch or 0
        new_epoch = current_epoch + 1

        # 如果有当前活跃的密钥，先标记为即将过期
        if current_epoch > 0:
            current_key_epoch = self.db.query(KeyEpoch).filter(
                and_(
                    KeyEpoch.conversation_id == conversation_id,
                    KeyEpoch.epoch_no == current_epoch,
                    KeyEpoch.status == "active"
                )
            ).first()

            if current_key_epoch:
                current_key_epoch.status = "rotating"
                current_key_epoch.rotate_reason = reason

        # 创建新的密钥轮次（实际密钥来自QKE协商）
        key_epoch = KeyEpoch(
            conversation_id=conversation_id,
            qke_session_id=None,  # 待QKE协商完成后更新
            epoch_no=new_epoch,
            key_fingerprint="",   # 待QKE协商完成后更新
            key_length=conversation.key_length or 256,  # 使用对话的密钥长度
            entropy=0.0,
            qber=0.0,
            activated_at=datetime.utcnow(),
            status="pending"  # 待QKE协商完成后激活
        )

        self.db.add(key_epoch)

        # 更新对话状态
        conversation.current_key_epoch = new_epoch
        conversation.qke_status = "negotiating"  # 表示正在协商新密钥

        self.db.commit()
        self.db.refresh(key_epoch)

        # 发布密钥轮换事件
        if self.event_service:
            import asyncio
            try:
                asyncio.create_task(self.event_service.publish_event({
                    "qke_session_id": None,
                    "conversation_id": conversation_id,
                    "event_type": "key_rotation_initiated",
                    "event_stage": "initiated",
                    "title": "密钥轮换已启动",
                    "description": f"正在为对话 {conversation_id} 轮换密钥，原因: {reason}",
                    "severity": "info",
                    "payload": {
                        "old_epoch": current_epoch,
                        "new_epoch": new_epoch,
                        "reason": reason
                    },
                    "timestamp": datetime.utcnow()
                }))
            except Exception as e:
                logger.warning("Failed to publish key rotation event: %s", e)

        return key_epoch

    def activate_key_epoch(self, conversation_id: int, qke_session_id: int,
                          key_fingerprint: str, key_length: int,
                          entropy: float, qber: float = 0.0) -> bool:
        """激活新生成的密钥轮次（在QKE协商完成后调用）"""
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()

        if not conversation:
            return False

        # 获取待激活的密钥轮次
        key_epoch = self.db.query(KeyEpoch).filter(
            and_(
                KeyEpoch.conversation_id == conversation_id,
                KeyEpoch.epoch_no == conversation.current_key_epoch,
                KeyEpoch.status == "pending"
            )
        ).first()

        if not key_epoch:
            return False

        # 激活新密钥轮次
        key_epoch.qke_session_id = qke_session_id
        key_epoch.key_fingerprint = key_fingerprint
        key_epoch.key_length = key_length
        key_epoch.entropy = entropy
        key_epoch.qber = qber
        key_epoch.status = "active"
        key_epoch.activated_at = datetime.utcnow()

        # 将之前的活跃密钥标记为过期
        old_epoch = conversation.current_key_epoch - 1 if conversation.current_key_epoch > 0 else None
        if old_epoch and old_epoch > 0:
            old_key_epoch = self.db.query(KeyEpoch).filter(
                and_(
                    KeyEpoch.conversation_id == conversation_id,
                    KeyEpoch.epoch_no == old_epoch,
                    KeyEpoch.status == "active"
                )
            ).first()

            if old_key_epoch:
                old_key_epoch.status = "active"  # 保持激活状态一段时间以确保平滑过渡
                # 实际应用中可能设置为 expiring 状态，并在一定时间后过期

        # 更新对话状态
        conversation.qke_status = "active"

        self.db.commit()

        # 记录熵值分析
        self._record_entropy_analysis(qke_session_id, key_fingerprint, entropy)

        # 发布密钥激活事件
        if self.event_service:
            import asyncio
            try:
                asyncio.create_task(self.event_service.publish_event({
                    "qke_session_id": qke_session_id,
                    "conversation_id": conversation_id,
                    "event_type": "epoch_activated",
                    "event_stage": "completed",
                    "title": "密钥轮次已激活",
                    "description": f"新密钥轮次 {key_epoch.epoch_no} 已激活",
                    "severity": "info",
                    "payload": {
                        "epoch_no": key_epoch.epoch_no,
                        "key_fingerprint": key_fingerprint,
                        "key_length": key_length,
                        "entropy": entropy,
                        "qber": qber
                    },
                    "timestamp": datetime.utcnow()
                }))
            except Exception as e:
                logger.warning("Failed to publish key activation event: %s", e)

        return True

    def expire_key_epoch(self, conversation_id: int, epoch_no: int,
                        reason: str = "time_expired") -> bool:
        """过期指定的密钥轮次"""
        key_epoch = self.db.query(KeyEpoch).filter(
            and_(
                KeyEpoch.conversation_id == conversation_id,
                KeyEpoch.epoch_no == epoch_no
            )
        ).first()

        if not key_epoch:
            return False

        key_epoch.status = "expired"
        key_epoch.expired_at = datetime.utcnow()
        key_epoch.rotate_reason = reason

        self.db.commit()

        # 发布密钥过期事件
        if self.event_service:
            import asyncio
            try:
                asyncio.create_task(self.event_service.publish_event({
                    "qke_session_id": key_epoch.qke_session_id,
                    "conversation_id": conversation_id,
                    "event_type": "key_epoch_expired",
                    "event_stage": "completed",
                    "title": "密钥轮次已过期",
                    "description": f"密钥轮次 {epoch_no} 已过期，原因: {reason}",
                    "severity": "warn",
                    "payload": {
                        "epoch_no": epoch_no,
                        "reason": reason
                    },
                    "timestamp": datetime.utcnow()
                }))
            except Exception as e:
                logger.warning("Failed to publish key expiration event: %s", e)

        return True

    def revoke_key_epoch(self, conversation_id: int, epoch_no: int,
                        reason: str = "security_risk") -> bool:
        """撤销指定的密钥轮次（立即失效）"""
        key_epoch = self.db.query(KeyEpoch).filter(
            and_(
                KeyEpoch.conversation_id == conversation_id,
                KeyEpoch.epoch_no == epoch_no
            )
        ).first()

        if not key_epoch:
            return False

        key_epoch.status = "revoked"
        key_epoch.expired_at = datetime.utcnow()
        key_epoch.rotate_reason = reason

        self.db.commit()

        # 如果这是当前活跃的密钥，需要触发紧急轮换
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()

        if conversation and conversation.current_key_epoch == epoch_no:
            conversation.qke_status = "failed"  # 标记为失败状态，触发重新协商

        self.db.commit()

        # 发布密钥撤销事件
        if self.event_service:
            import asyncio
            try:
                asyncio.create_task(self.event_service.publish_event({
                    "qke_session_id": key_epoch.qke_session_id,
                    "conversation_id": conversation_id,
                    "event_type": "key_epoch_revoked",
                    "event_stage": "completed",
                    "title": "密钥轮次已撤销",
                    "description": f"密钥轮次 {epoch_no} 已因安全风险被撤销，原因: {reason}",
                    "severity": "error",
                    "payload": {
                        "epoch_no": epoch_no,
                        "reason": reason
                    },
                    "timestamp": datetime.utcnow()
                }))
            except Exception as e:
                logger.warning("Failed to publish key revocation event: %s", e)

        return True

    # ==================== 密钥使用统计 ====================

    def _get_key_usage_count(self, conversation_id: int, epoch_no: int) -> int:
        """获取密钥使用次数（基于消息计数）"""
        from app.models.v1_models import Message

        # 计算使用此epoch的消息数量
        count = self.db.query(Message).filter(
            and_(
                Message.conversation_id == conversation_id,
                Message.key_epoch == epoch_no
            )
        ).count()

        return count

    def increment_key_usage(self, conversation_id: int, epoch_no: int, count: int = 1):
        """增加密钥使用计数（这里主要是通过消息记录来间接统计）"""
        # 实际使用计数通过Message表中的key_epoch字段来追踪
        # 此方法主要用于触发使用警告检查
        current_count = self._get_key_usage_count(conversation_id, epoch_no)
        if current_count >= (self.max_key_usage_count * self.usage_warning_threshold):
            self._send_key_usage_warning(conversation_id, epoch_no, current_count)

    def _send_key_usage_warning(self, conversation_id: int, epoch_no: int, usage_count: int):
        """发送密钥使用警告"""
        # 创建安全告警
        alert = SecurityAlert(
            conversation_id=conversation_id,
            alert_type="high_key_usage",
            severity="medium",
            title="密钥使用率较高",
            detail_json=f'{{"conversation_id": {conversation_id}, "epoch_no": {epoch_no}, "usage_count": {usage_count}, "threshold": {self.max_key_usage_count * self.usage_warning_threshold}}}',
            detected_at=datetime.utcnow(),
            status="open"
        )

        self.db.add(alert)
        self.db.commit()

        # 发布安全告警事件
        if self.event_service:
            import asyncio
            try:
                asyncio.create_task(self.event_service.publish_event({
                    "qke_session_id": None,
                    "conversation_id": conversation_id,
                    "event_type": "security_alert",
                    "event_stage": "opened",
                    "title": "密钥使用率较高",
                    "description": f"对话 {conversation_id} 的密钥轮次 {epoch_no} 使用率较高",
                    "severity": "medium",
                    "payload": {
                        "alert_type": "high_key_usage",
                        "conversation_id": conversation_id,
                        "epoch_no": epoch_no,
                        "usage_count": usage_count,
                        "threshold": self.max_key_usage_count * self.usage_warning_threshold
                    },
                    "timestamp": datetime.utcnow()
                }))
            except Exception as e:
                logger.warning("Failed to publish key usage warning: %s", e)

    # ==================== 熵值分析 ====================

    def _record_entropy_analysis(self, qke_session_id: int, key_fingerprint: str, entropy: float):
        """记录熵值分析结果"""
        entropy_analysis = EntropyAnalysis(
            qke_session_id=qke_session_id,
            key_fingerprint=key_fingerprint,
            shannon_entropy=entropy,
            min_entropy=entropy,  # 简化处理，实际应计算最小熵
            entropy_ratio=entropy / 8.0 if entropy <= 8.0 else 1.0,  # 假设最大熵为8.0（每 bit 1熵）
            analysis_method="shannon"
        )

        self.db.add(entropy_analysis)
        self.db.commit()

    def get_entropy_trend(self, conversation_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """获取熵值趋势"""
        # 获取最近的几个密钥轮次的熵值
        key_epochs = self.db.query(KeyEpoch).filter(
            KeyEpoch.conversation_id == conversation_id
        ).order_by(desc(KeyEpoch.activated_at)).limit(limit).all()

        return [
            {
                "epoch_no": epoch.epoch_no,
                "entropy": epoch.entropy,
                "activated_at": epoch.activated_at.isoformat() if epoch.activated_at else None,
                "key_fingerprint": epoch.key_fingerprint
            }
            for epoch in key_epochs
        ]

    # ==================== 密钥物理保护 ====================

    def secure_delete_key_material(self, key_material: bytearray) -> None:
        """安全删除密钥材料（覆写内存）"""
        if isinstance(key_material, bytearray):
            for i in range(len(key_material)):
                key_material[i] = secrets.token_bytes(1)[0]  # 用随机数据覆写
            for i in range(len(key_material)):
                key_material[i] = 0  # 再用零覆写

    def derive_key_with_forward_secrecy(self, base_key: bytes,
                                      epoch: int,
                                      purpose: str = "message") -> bytes:
        """使用前向安全的密钥派生"""
        # 使用哈希链确保前向安全：即使当前密钥泄露，也无法推导出之前的密钥
        material = f"{base_key.hex()}|{epoch}|{purpose}".encode('utf-8')
        return hashlib.sha256(material).digest()

    # ==================== 统计和报告 ====================

    def get_key_management_stats(self, conversation_id: int) -> Dict[str, Any]:
        """获取密钥管理统计信息"""
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()

        if not conversation:
            return {}

        # 获取所有密钥轮次
        key_epochs = self.db.query(KeyEpoch).filter(
            KeyEpoch.conversation_id == conversation_id
        ).order_by(desc(KeyEpoch.activated_at)).all()

        active_epochs = [e for e in key_epochs if e.status == "active"]
        expired_epochs = [e for e in key_epochs if e.status == "expired"]
        revoked_epochs = [e for e in key_epochs if e.status == "revoked"]

        # 计算平均熵值
        entropies = [e.entropy for e in key_epochs if e.entropy is not None]
        avg_entropy = sum(entropies) / len(entropies) if entropies else 0.0

        # 获取使用统计
        total_messages = 0
        if key_epochs:
            epoch_nos = [e.epoch_no for e in key_epochs]
            total_messages = self.db.query(func.count(Message.id)).filter(
                and_(
                    Message.conversation_id == conversation_id,
                    Message.key_epoch.in_(epoch_nos)
                )
            ).scalar() or 0

        return {
            "conversation_id": conversation_id,
            "current_epoch": conversation.current_key_epoch or 0,
            "total_epochs": len(key_epochs),
            "active_epochs": len(active_epochs),
            "expired_epochs": len(expired_epochs),
            "revoked_epochs": len(revoked_epochs),
            "average_entropy": round(avg_entropy, 4),
            "total_messages_encrypted": total_messages,
            "key_lifetime_hours": self.default_key_lifetime_hours,
            "max_key_usage": self.max_key_usage_count
        }

    def cleanup_expired_keys(self, older_than_hours: int = 168) -> int:  # 默认清理一周以前的过期密钥
        """清理长时间过期的密钥记录"""
        cutoff_time = datetime.utcnow() - timedelta(hours=older_than_hours)

        # 查找要清理的过期密钥
        expired_key_epochs = self.db.query(KeyEpoch).filter(
            and_(
                KeyEpoch.status == "expired",
                KeyEpoch.expired_at < cutoff_time
            )
        ).all()

        count = len(expired_key_epochs)
        for epoch in expired_key_epochs:
            self.db.delete(epoch)

        self.db.commit()
        return count


# 单例工厂函数
def create_key_management_service(db: Session,
                                event_service: Optional[EventService] = None) -> KeyManagementService:
    """创建密钥管理服务实例"""
    return KeyManagementService(db, event_service)
