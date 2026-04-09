"""
事件流服务
实现事件发布/订阅机制，支持实时监控和历史查询
参考微服务架构中的事件驱动设计
"""

import json
import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Callable, Any, Optional
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.v1_models import QKEEvent, QKESession, Conversation, User
from app.services.qke_engine import ProtocolEvent
from app.websocket.admin_manager import admin_ws_manager

logger = logging.getLogger(__name__)


class EventService:
    """事件流服务 - 负责事件的发布、订阅和持久化"""

    # Class-level shared subscribers so all EventService instances see the same subscriptions
    _shared_subscribers: Dict[str, List[Callable]] = defaultdict(list)

    def __init__(self, db: Session):
        self.db = db
        # Use the class-level shared subscribers instead of instance-level
        # This ensures all instances share the same subscriber list
        # 事件队列用于异步处理
        self._event_queue: asyncio.Queue = asyncio.Queue()
        # 处理任务
        self._processing_task: Optional[asyncio.Task] = None
        self._is_running = False

    async def start(self):
        """启动事件处理器"""
        if not self._is_running:
            self._is_running = True
            self._processing_task = asyncio.create_task(self._process_events())

    async def stop(self):
        """停止事件处理器"""
        self._is_running = False
        if self._processing_task:
            self._processing_task.cancel()
            try:
                await self._processing_task
            except asyncio.CancelledError:
                pass

    async def _process_events(self):
        """处理事件队列中的事件"""
        while self._is_running:
            try:
                # 等待事件，带超时以便可以检查_is_running
                event_data = await asyncio.wait_for(self._event_queue.get(), timeout=1.0)
                await self._handle_event(event_data)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error("处理事件时出错: %s", e)

    async def _handle_event(self, event_data: Dict[str, Any]):
        """处理单个事件"""
        event_type = event_data.get("event_type")
        if event_type in self._shared_subscribers:
            # 通知所有订阅者
            for callback in self._shared_subscribers[event_type]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(event_data)
                    else:
                        callback(event_data)
                except Exception as e:
                    logger.error("事件回调执行出错: %s", e)

        # 通过WebSocket广播事件到管理端
        try:
            # 准备广播数据
            broadcast_data = {
                "type": "qke_event",
                "data": {
                    "session_id": event_data.get("qke_session_id"),
                    "conversation_id": event_data.get("conversation_id"),
                    "event_type": event_type,
                    "event_stage": event_data.get("event_stage"),
                    "title": event_data.get("title", ""),
                    "description": event_data.get("description", ""),
                    "severity": event_data.get("severity", "info"),
                    "payload": event_data.get("payload", {}),
                    "timestamp": event_data.get("timestamp", datetime.utcnow()).isoformat()
                }
            }

            # 广播到管理端
            await admin_ws_manager.notify_qke_event(broadcast_data)
        except Exception as e:
            logger.error("WebSocket广播事件出错: %s", e)

    def subscribe(self, event_type: str, callback: Callable):
        """订阅特定类型的事件"""
        if callback not in self._shared_subscribers[event_type]:
            self._shared_subscribers[event_type].append(callback)

    def unsubscribe(self, event_type: str, callback: Callable):
        """取消订阅特定类型的事件"""
        if callback in self._shared_subscribers[event_type]:
            self._shared_subscribers[event_type].remove(callback)

    async def publish_event(self, event_data: Dict[str, Any]):
        """发布事件（持久化 + 异步广播）"""
        # 确保事件处理器已启动（懒启动）
        if not self._is_running:
            await self.start()
        # 1. 持久化到数据库
        await self._persist_event(event_data)
        # 2. 放入队列以便异步处理
        await self._event_queue.put(event_data)

    async def _persist_event(self, event_data: Dict[str, Any]):
        """将事件持久化到数据库"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # 从event_data中提取必要信息
                qke_session_id = event_data.get("qke_session_id")
                conversation_id = event_data.get("conversation_id")
                event_type = event_data.get("event_type")
                event_stage = event_data.get("event_stage")
                title = event_data.get("title", "")
                description = event_data.get("description", "")
                severity = event_data.get("severity", "info")
                payload = event_data.get("payload", {})
                timestamp = event_data.get("timestamp", datetime.utcnow())

                event = QKEEvent(
                    qke_session_id=qke_session_id,
                    conversation_id=conversation_id,
                    event_type=event_type,
                    event_stage=event_stage,
                    severity=severity,
                    title=title,
                    detail_json=json.dumps(payload, ensure_ascii=False),
                    event_time=timestamp
                )

                self.db.add(event)
                self.db.commit()
                return  # Success, exit the retry loop
            except Exception as e:
                logger.error("持久化事件出错 (尝试 %d/%d): %s", attempt + 1, max_retries, e)
                self.db.rollback()
                if attempt == max_retries - 1:  # Last attempt
                    logger.error("持久化事件失败，已达到最大重试次数: %s", e)
                    raise
                # Wait briefly before retrying (exponential backoff)
                await asyncio.sleep(0.5 * (2 ** attempt))

    # ==================== 公开的事件发布方法 ====================

    async def publish_session_created(self, session_id: int, conversation_id: int,
                                    participants: List[int], key_length: int,
                                    decoy_count: int, trigger_type: str):
        """发布会话创建事件"""
        await self.publish_event({
            "qke_session_id": session_id,
            "conversation_id": conversation_id,
            "event_type": "session_created",
            "event_stage": "initiated",
            "title": "QKE会话已创建",
            "description": f"创建了包含{len(participants)}个参与者的QKE会话",
            "severity": "info",
            "payload": {
                "participants": participants,
                "key_length": key_length,
                "decoy_count": decoy_count,
                "trigger_type": trigger_type
            },
            "timestamp": datetime.utcnow()
        })

    async def publish_protocol_started(self, session_id: int, conversation_id: int):
        """发布协商开始事件"""
        await self.publish_event({
            "qke_session_id": session_id,
            "conversation_id": conversation_id,
            "event_type": "protocol_start",
            "event_stage": "started",
            "title": "QKE协商已开始",
            "description": "量子密钥协商协议开始执行",
            "severity": "info",
            "payload": {
                "timestamp": datetime.utcnow().isoformat()
            },
            "timestamp": datetime.utcnow()
        })

    async def publish_protocol_completed(self, session_id: int, conversation_id: int,
                                       final_key_fingerprint: str, key_length: int,
                                       entropy: float, statistics: Dict[str, Any]):
        """发布协商完成事件"""
        await self.publish_event({
            "qke_session_id": session_id,
            "conversation_id": conversation_id,
            "event_type": "protocol_completed",
            "event_stage": "completed",
            "title": "QKE协商已完成",
            "description": f"成功生成{key_length}位密钥",
            "severity": "info",
            "payload": {
                "final_key_fingerprint": final_key_fingerprint,
                "key_length": key_length,
                "entropy": entropy,
                "statistics": statistics
            },
            "timestamp": datetime.utcnow()
        })

    async def publish_protocol_failed(self, session_id: int, conversation_id: int,
                                    error: str):
        """发布协商失败事件"""
        await self.publish_event({
            "qke_session_id": session_id,
            "conversation_id": conversation_id,
            "event_type": "protocol_failed",
            "event_stage": "failed",
            "title": "QKE协商失败",
            "description": f"协商过程中发生错误: {error}",
            "severity": "error",
            "payload": {
                "error": error
            },
            "timestamp": datetime.utcnow()
        })

    async def publish_key_derived(self, session_id: int, conversation_id: int,
                                purpose: str, key_length: int):
        """发布密钥派生事件"""
        await self.publish_event({
            "qke_session_id": session_id,
            "conversation_id": conversation_id,
            "event_type": "key_derived",
            "event_stage": "completed",
            "title": f"为{purpose}派生了密钥",
            "description": f"成功派生了{key_length*8}位{purpose}密钥",
            "severity": "info",
            "payload": {
                "purpose": purpose,
                "key_length": key_length
            },
            "timestamp": datetime.utcnow()
        })

    # ==================== 事件查询方法 ====================

    def get_events_by_session(self, session_id: int, limit: int = 100) -> List[Dict[str, Any]]:
        """获取指定会话的事件"""
        events = self.db.query(QKEEvent)\
            .filter(QKEEvent.qke_session_id == session_id)\
            .order_by(QKEEvent.event_time.desc())\
            .limit(limit)\
            .all()

        return [
            {
                "id": event.id,
                "event_type": event.event_type,
                "event_stage": event.event_stage,
                "title": event.title,
                "description": event.detail_json,
                "severity": event.severity,
                "timestamp": event.event_time.isoformat() if event.event_time else None,
                "payload": json.loads(event.detail_json) if event.detail_json else {}
            }
            for event in events
        ]

    def get_events_by_conversation(self, conversation_id: int, limit: int = 100) -> List[Dict[str, Any]]:
        """获取指定对话的事件"""
        events = self.db.query(QKEEvent)\
            .filter(QKEEvent.conversation_id == conversation_id)\
            .order_by(QKEEvent.event_time.desc())\
            .limit(limit)\
            .all()

        return [
            {
                "id": event.id,
                "event_type": event.event_type,
                "event_stage": event.event_stage,
                "title": event.title,
                "description": event.detail_json,
                "severity": event.severity,
                "timestamp": event.event_time.isoformat() if event.event_time else None,
                "payload": json.loads(event.detail_json) if event.detail_json else {}
            }
            for event in events
        ]

    def get_events_by_type(self, event_type: str, limit: int = 100) -> List[Dict[str, Any]]:
        """获取指定类型的事件"""
        events = self.db.query(QKEEvent)\
            .filter(QKEEvent.event_type == event_type)\
            .order_by(QKEEvent.event_time.desc())\
            .limit(limit)\
            .all()

        return [
            {
                "id": event.id,
                "event_type": event.event_type,
                "event_stage": event.event_stage,
                "title": event.title,
                "description": event.detail_json,
                "severity": event.severity,
                "timestamp": event.event_time.isoformat() if event.event_time else None,
                "payload": json.loads(event.detail_json) if event.detail_json else {}
            }
            for event in events
        ]


# 便利函数：从引擎事件转换为服务事件
def convert_protocol_event_to_service_event(protocol_event: ProtocolEvent,
                                          session_id: int, conversation_id: int) -> Dict[str, Any]:
    """将引擎协议事件转换为服务事件格式"""
    return {
        "qke_session_id": session_id,
        "conversation_id": conversation_id,
        "event_type": protocol_event.event_type,
        "event_stage": protocol_event.event_stage,
        "title": protocol_event.title,
        "description": protocol_event.description,
        "severity": protocol_event.severity,
        "payload": protocol_event.payload,
        "timestamp": protocol_event.timestamp
    }
