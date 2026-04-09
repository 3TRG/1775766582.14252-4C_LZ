from __future__ import annotations

import json
import hashlib
import logging
import asyncio
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Callable, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

logger = logging.getLogger(__name__)

from app.services.qke_engine import (
    create_qke_engine,
    ParticipantConfig,
    SessionConfig
)
from app.models.quantum import QuantumPrivateKey, KeyDerivation, EntropyAnalysis, QuantumResource
from app.models.v1_models import (
    QKESession, QKESessionMember, QKERound, QKEEvent,
    KeyEpoch, Conversation, User
)
from app.services.security_service import security_service
from app.services.event_service import EventService
from app.services.key_management_service import create_key_management_service

class QKEService:
    """量子密钥交换服务 - 业务编排中心，专注于会话管理和协调"""

    def __init__(self, db: Session):
        self.db = db
        # 创建QKE引擎实例（使用本地模拟器作为默认后端）
        self.qke_engine = create_qke_engine("local_simulator")
        # 映射后端会话ID到数据库会话ID和对话ID
        self.backend_to_db_session_map: Dict[str, Tuple[int, int]] = {}
        # 映射数据库会话ID到引擎会话句柄（避免重复创建独立会话）
        self.db_to_engine_session_map: Dict[int, Any] = {}
        # 设置事件回调以实现实时事件通知
        if hasattr(self.qke_engine.backend, 'set_event_callback'):
            self.qke_engine.backend.set_event_callback(self._handle_backend_event)
        # 创建事件服务和密钥管理服务
        self.event_service = EventService(db)
        self.key_management_service = create_key_management_service(db, self.event_service)

    def _handle_backend_event(self, backend_session_id: str, event_type: str, event_stage: str, title: str, details: Dict[str, Any]):
        """处理来自后端的事件，统一通过 EventService 持久化和广播"""
        try:
            if backend_session_id in self.backend_to_db_session_map:
                db_session_id, conversation_id = self.backend_to_db_session_map[backend_session_id]

                # 所有事件统一走 EventService（负责持久化 + WebSocket 广播）
                asyncio.create_task(self.event_service.publish_event({
                    "qke_session_id": db_session_id,
                    "conversation_id": conversation_id,
                    "event_type": event_type,
                    "event_stage": event_stage,
                    "title": title,
                    "description": details.get('description', ''),
                    "severity": details.get('severity', 'info'),
                    "payload": details.get('payload', {}),
                    "timestamp": datetime.utcnow()
                }))
            else:
                logger.warning("后端会话ID %s 没有对应的数据库会话映射", backend_session_id)
        except Exception as e:
            logger.error("处理后端事件时出错: %s", e)

    async def create_qke_session(
        self,
        conversation_id: int,
        participant_ids: List[int],
        trigger_type: str = "initial",
        scene_type: str = "private",
        key_length: int = 256,
        decoy_count: int = 4,
    ) -> QKESession:
        """
        创建QKE会话 - 更新版本
        恶意节点模型已移除，所有参与者均为正常角色。
        """
        # 生成会话编号
        session_no = f"QKE-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{hashlib.md5(str(conversation_id).encode()).hexdigest()[:8]}"

        # 创建会话记录
        session = QKESession(
            session_no=session_no,
            conversation_id=conversation_id,
            trigger_type=trigger_type,
            scene_type=scene_type,
            protocol_name="QKE-STANDARD",
            protocol_version="v1",
            participant_count=len(participant_ids),
            leader_count=min(4, len(participant_ids)),  # 最多4个领导者
            key_length=key_length,
            decoy_count=decoy_count,
            status="created",
            start_time=datetime.utcnow()
        )

        self.db.add(session)
        self.db.flush()

        # 准备参与者配置
        participants = [
            ParticipantConfig(
                user_id=pid,
                is_leader=(idx < min(4, len(participant_ids)))
            )
            for idx, pid in enumerate(participant_ids)
        ]

        # 配置会话参数（恶意节点模型已移除）
        session_config = SessionConfig(
            key_length=key_length,
            decoy_count=decoy_count,
        )

        # 使用QKE引擎创建会话
        qke_session_handle = self.qke_engine.create_session(participants, session_config)

        # 建立后端会话ID到数据库会话ID的映射
        backend_session_id = qke_session_handle.handle_id if hasattr(qke_session_handle, 'handle_id') else str(qke_session_handle)
        self.backend_to_db_session_map[backend_session_id] = (session.id, conversation_id)

        # 保存引擎会话句柄，供 execute_qke_protocol 复用（避免重复创建独立会话）
        self.db_to_engine_session_map[session.id] = qke_session_handle

        # 记录会话成员
        for idx, user_id in enumerate(participant_ids):
            is_leader = idx < min(4, len(participant_ids))
            member = QKESessionMember(
                qke_session_id=session.id,
                user_id=user_id,
                logical_role="leader" if is_leader else "follower",
                threat_role="normal",  # 暂时都设为正常
                participant_order=idx + 1,
                status="joined"
            )
            self.db.add(member)

        # 记录事件
        await self._record_event(
            session.id,
            conversation_id,
            "session_created",
            "initiated",
            {
                "session_no": session_no,
                "participants": participant_ids,
                "key_length": key_length,
                "decoy_count": decoy_count
            }
        )

        # 广播QKE会话创建事件到管理端（通过 EventService）
        try:
            participants_info = []
            for idx, user_id in enumerate(participant_ids):
                user = self.db.query(User).filter(User.id == user_id).first()
                if user:
                    participants_info.append({
                        "user_id": user_id,
                        "username": user.username,
                        "role": "leader" if idx < min(4, len(participant_ids)) else "follower"
                    })

            asyncio.create_task(self.event_service.publish_event({
                "qke_session_id": session.id,
                "conversation_id": conversation_id,
                "event_type": "session_started",
                "event_stage": "initiated",
                "title": "QKE Session Started",
                "description": f"QKE会话已创建，参与者 {len(participant_ids)} 人",
                "severity": "info",
                "payload": {
                    "session_no": session_no,
                    "participants": participants_info,
                    "key_length": key_length,
                    "trigger_type": trigger_type
                },
                "timestamp": datetime.utcnow()
            }))
        except Exception as e:
            logger.error("记录QKE开始事件失败: %s", e)

        self.db.commit()
        self.db.refresh(session)

        return session

    async def execute_qke_protocol(self, session_id: int) -> Dict[str, Any]:
        """
        执行QKE协商 - 更新版本
        """
        session = self.db.query(QKESession).filter(QKESession.id == session_id).first()
        if not session:
            raise ValueError(f"QKE session {session_id} not found")

        # 更新会话状态
        session.status = "running"
        self.db.commit()

        # 记录开始事件
        await self._record_event(
            session.id,
            session.conversation_id,
            "protocol_start",
            "started",
            {"timestamp": datetime.utcnow().isoformat()}
        )

        # 启动进度跟踪任务
        progress_task = None
        try:
            # 创建并启动进度跟踪任务
            progress_task = asyncio.create_task(self._track_qke_progress(session.id, session.conversation_id))

            # 准备参与者配置
            participants = []
            members = self.db.query(QKESessionMember).filter(
                QKESessionMember.qke_session_id == session.id
            ).all()

            for idx, member in enumerate(members):
                participants.append(ParticipantConfig(
                    user_id=member.user_id,
                    is_leader=(member.logical_role == "leader")
                ))

            # 复用 create_qke_session 时保存的引擎会话句柄，避免创建独立会话导致映射断裂
            qke_session_handle = self.db_to_engine_session_map.get(session.id)
            if qke_session_handle is None:
                # 降级方案：如果映射不存在（如旧数据调用），则创建新会话
                session_config = SessionConfig(
                    key_length=session.key_length,
                    decoy_count=session.decoy_count,
                )
                qke_session_handle = self.qke_engine.create_session(participants, session_config)
            result = self.qke_engine.execute_protocol(qke_session_handle)

            if not result.success:
                raise RuntimeError(f"QKE protocol failed: {result.error_message}")

            # 更新会话信息
            session.final_key_fingerprint = result.fingerprint
            session.status = "completed"
            session.end_time = datetime.utcnow()
            session.latency_ms = int((session.end_time - session.start_time).total_seconds() * 1000)
            session.quantum_cost = result.statistics.get('quantum_cost', 0)
            session.classical_cost = result.statistics.get('classical_cost', 0)
            session.pauli_ops = result.statistics.get('pauli_ops', 0)
            session.total_quantum_ops = result.statistics.get('total_quantum_ops', 0)
            session.bit_flips = result.statistics.get('bit_flips', 0)
            session.entropy = result.entropy

            # 从协议引擎获取真实的QBER值
            session.qber = result.statistics.get('qber', 0.0)

            # 记录最终密钥（使用引擎的密钥材料功能）
            await self._store_final_key_via_engine(session)

            # 记录完成事件
            await self._record_event(
                session.id,
                session.conversation_id,
                "protocol_completed",
                "completed",
                {
                    "final_key_fingerprint": session.final_key_fingerprint,
                    "shared_key": "[REDACTED]",  # 不暴露明文密钥
                    "key_length": session.key_length,
                    "entropy": result.entropy,
                    "statistics": result.statistics
                }
            )

            # 广播QKE完成事件到管理端（通过 EventService）
            try:
                asyncio.create_task(self.event_service.publish_event({
                    "qke_session_id": session.id,
                    "conversation_id": session.conversation_id,
                    "event_type": "session_completed",
                    "event_stage": "completed",
                    "title": "QKE Session Completed",
                    "description": "量子密钥交换协议执行完成",
                    "severity": "info",
                    "payload": {
                        "session_no": session.session_no,
                        "final_key_length": session.key_length,
                        "final_key_fingerprint": session.final_key_fingerprint,
                        "entropy": result.entropy,
                        "statistics": result.statistics,
                        "latency_ms": session.latency_ms
                    },
                    "timestamp": datetime.utcnow()
                }))
            except Exception as e:
                logger.error("记录QKE完成事件失败: %s", e)

            # 更新会话状态
            session.status = "completed"
            self.db.commit()

            return {
                "session_id": session.id,
                "session_no": session.session_no,
                "status": "completed",
                "final_key_fingerprint": session.final_key_fingerprint,
                "entropy": result.entropy,
                "statistics": result.statistics
            }

        except Exception as e:
            # 记录错误
            session.status = "failed"
            session.fail_reason = str(e)
            session.end_time = datetime.utcnow()

            await self._record_event(
                session.id,
                session.conversation_id,
                "protocol_failed",
                "failed",
                {"error": str(e)}
            )

            self.db.commit()
            raise
        finally:
            # 确保进度跟踪任务被取消
            if progress_task and not progress_task.done():
                progress_task.cancel()
                try:
                    await progress_task
                except asyncio.CancelledError:
                    pass


    async def _store_final_key_via_engine(self, session: QKESession) -> None:
        """存储最终密钥 - 业务编排责任"""
        try:
            # 委托给密钥管理服务处理密钥轮次的创建和激活
            # 密钥管理服务负责：创建KeyEpoch记录、更新会话状态、处理密钥轮换逻辑
            success = await self._activate_key_epoch_via_management(
                session.conversation_id,
                session.id,
                session.final_key_fingerprint or "",
                session.key_length,
                session.entropy or 0.0,
                session.qber or 0.0
            )

            if success:
                # 更新会话状态为激活
                from app.models.v1_models import Conversation
                conversation = self.db.query(Conversation).filter(Conversation.id == session.conversation_id).first()
                if conversation:
                    conversation.qke_status = "active"
                    self.db.commit()
            else:
                logger.warning("[QKE]激活密钥轮次失败，会话 %s", session.id)

        except Exception as e:
            logger.warning("[QKE]存储最终密钥时出错: %s", e)
            raise

    async def _activate_key_epoch_via_management(self, conversation_id: int, qke_session_id: int,
                                               key_fingerprint: str, key_length: int,
                                               entropy: float, qber: float) -> bool:
        """通过密钥管理服务激活密钥轮次"""
        try:
            # 这里我们需要先轮换密钥（如果需要），然后激活
            # 检查是否应该轮换密钥
            should_rotate, reason = self.key_management_service.should_rotate_key(conversation_id)

            if should_rotate:
                # 执行密钥轮换
                self.key_management_service.rotate_key(conversation_id, reason)

            # 激活新生成的密钥轮次
            return self.key_management_service.activate_key_epoch(
                conversation_id, qke_session_id, key_fingerprint, key_length, entropy, qber
            )
        except Exception as e:
            logger.warning("[QKE]激活密钥轮次时出错: %s", e)
            return False

    async def _record_event(
        self,
        session_id: int,
        conversation_id: int,
        event_type: str,
        event_stage: str,
        details: Dict[str, Any]
    ) -> Optional[QKEEvent]:
        """
        记录QKE事件 - 委托给事件服务处理持久化和广播
        """
        # 准备事件数据
        event_data = {
            "qke_session_id": session_id,
            "conversation_id": conversation_id,
            "event_type": event_type,
            "event_stage": event_stage,
            "title": f"{event_type.replace('_', ' ').title()}",
            "description": details.get('description', ''),
            "severity": details.get('severity', 'info'),
            "payload": details,
            "event_time": datetime.utcnow()
        }

        # 使用事件服务处理持久化和广播
        await self.event_service.publish_event(event_data)

        # 为了保持与原接口的兼容性，我们返回None表示事件已处理
        # 实际应用中可能需要修改依赖此返回值的代码
        return None

    # ==================== 密钥管理接口方法 ====================

    async def derive_key_for_purpose(self, session_id: int, purpose: str,
                                   context: bytes, length: int = 32) -> Optional[bytes]:
        """为特定目的派生密钥 - 使用存储的会话数据"""
        session = self.db.query(QKESession).filter(QKESession.id == session_id).first()
        if not session:
            return None

        # 检查会话状态，只有完成状态才能派生密钥
        if session.status != "completed":
            logger.warning("[QKE]会话 %s 状态为 %s，无法派生密钥", session_id, session.status)
            return None

        # 获取存储的会话成员信息
        members = self.db.query(QKESessionMember).filter(
            QKESessionMember.qke_session_id == session_id
        ).all()

        if not members:
            logger.warning("[QKE]会话 %s 没有成员信息", session_id)
            return None

        # 构建参与者配置（基于存储的数据）
        participants = [
            ParticipantConfig(
                user_id=member.user_id,
                is_leader=(member.logical_role == "leader")
            )
            for member in members
        ]

        # 使用存储的会话参数（恶意节点模型已移除）
        session_config = SessionConfig(
            key_length=session.key_length,
            decoy_count=session.decoy_count,
        )

        # 创建QKE引擎会话句柄（用于获取密钥材料）
        qke_session_handle = self.qke_engine.create_session(participants, session_config)

        try:
            # 通过QKE引擎接口获取密钥材料句柄
            key_material_handle = self.qke_engine.get_key_material(qke_session_handle, purpose)

            # 使用QKE引擎派生密钥
            derived_key = self.qke_engine.derive_key(key_material_handle, context, length)

            # 记录密钥派生事件
            await self._record_event(
                session.id,
                session.conversation_id,
                "key_derived",
                "completed",
                {
                    "purpose": purpose,
                    "key_length": length,
                    "context_length": len(context) if context else 0,
                    "derived_from_session": session_id
                }
            )

            return derived_key

        except Exception as e:
            logger.warning("[QKE]派生密钥时出错: %s", e)
            await self._record_event(
                session.id,
                session.conversation_id,
                "key_derivation_failed",
                "failed",
                {"error": str(e), "purpose": purpose, "session_id": session_id}
            )
            return None

        finally:
            # 确保释放密钥材料句柄
            try:
                # 重新获取句柄以释放（确保释放的是正确的句柄）
                if 'key_material_handle' in locals():
                    self.qke_engine.release_key_material(key_material_handle)
            except Exception:
                pass  # 忽略释放错误

    def get_key_management_info(self, conversation_id: int) -> Dict[str, Any]:
        """获取密钥管理信息"""
        return self.key_management_service.get_key_management_stats(conversation_id)

    def check_key_rotation_needed(self, conversation_id: int) -> tuple:
        """检查是否需要轮换密钥"""
        return self.key_management_service.should_rotate_key(conversation_id)

    def initiate_key_rotation(self, conversation_id: int, reason: str = "scheduled") -> bool:
        """主动发起密钥轮换"""
        try:
            key_epoch = self.key_management_service.rotate_key(conversation_id, reason)
            return key_epoch is not None
        except Exception as e:
            logger.warning("[QKE]发起密钥轮换时出错: %s", e)
            return False

    async def _track_qke_progress(self, session_id: int, conversation_id: int):
        """
        跟踪QKE协商进度并定期发布进度事件
        """
        try:
            # 等待一段时间后开始跟踪，以避免在协商开始时就发布进度
            await asyncio.sleep(1)

            start_time = datetime.utcnow()
            progress_interval = 2  # 每2秒发布一次进度事件

            while True:
                # 检查会话状态
                session = self.db.query(QKESession).filter(QKESession.id == session_id).first()
                if not session:
                    break

                # 如果会话已经完成或失败，停止跟踪
                if session.status in ["completed", "failed"]:
                    break

                # 计算已用时间
                elapsed = (datetime.utcnow() - start_time).total_seconds()

                # 发布进度事件
                await self._record_event(
                    session_id,
                    conversation_id,
                    "protocol_progress",
                    "running",
                    {
                        "elapsed_time": elapsed,
                        "status": session.status,
                        "message": f"QKE协商进行中，已用时 {elapsed:.1f} 秒"
                    }
                )

                # 等待下次进度更新
                await asyncio.sleep(progress_interval)

        except asyncio.CancelledError:
            # 任务被取消，这是正常的
            pass
        except Exception as e:
            logger.warning("[QKE]跟踪QKE进度时出错: %s", e)