"""
QKE Engine Adapter
将纯QKE协议核心适配到标准接口
参考启科QuPot+Runtime的适配器思想，使得不同后端可以通过统一接口访问
"""

import hashlib
import json
import secrets
from typing import List, Optional, Dict, Any
from datetime import datetime

from .qke_interface import (
    ParticipantConfig, SessionConfig, SessionHandle, KeyMaterialHandle,
    ProtocolResult, ProtocolEvent, SessionStatus, QKEEngineInterface
)
from .qke_core import QKEProtocol, QuantumCore
from .qke_backend import LocalSimulatorBackend


class QKEEngineAdapter(QKEEngineInterface):
    """
    QKE引擎适配器
    将后端实现适配到标准接口
    """

    def __init__(self, backend: Optional[Any] = None):
        """
        初始化适配器

        Args:
            backend: 后端实现，如果为None则使用本地模拟器
        """
        self.backend = backend or LocalSimulatorBackend()

    def create_session(self,
                      participants: List[ParticipantConfig],
                      session_config: SessionConfig) -> SessionHandle:
        """创建QKE会话"""
        session_id = self.backend.create_session(participants, session_config)
        return SessionHandle(session_id)

    def execute_protocol(self, session_handle: SessionHandle) -> ProtocolResult:
        """执行QKE协商"""
        result = self.backend.execute_protocol(session_handle.session_id)

        return ProtocolResult(
            success=result['success'],
            session_handle=session_handle if result['success'] else None,
            key_length=result.get('key_length', 0),
            entropy=result.get('entropy'),
            qber=result.get('qber'),
            statistics=result.get('statistics', {}),
            error_message=None if result['success'] else result.get('error')
        )

    def get_key_material(self,
                        session_handle: SessionHandle,
                        purpose: str) -> KeyMaterialHandle:
        """获取密钥材料句柄"""
        key_material = self.backend.get_key_material(session_handle.session_id, purpose)
        return KeyMaterialHandle(
            handle_id=key_material['handle_id'],
            session_id=key_material['session_id'],
            purpose=key_material['purpose']
        )

    def derive_key(self,
                  key_material_handle: KeyMaterialHandle,
                  context: bytes,
                  length: int = 32) -> bytes:
        """派生密钥"""
        # 构造后端需要的密钥材料格式
        key_material = {
            'session_id': key_material_handle.session_id,
            'handle_id': key_material_handle.handle_id,
            'purpose': key_material_handle.purpose
        }
        return self.backend.derive_key(key_material, context, length)

    def release_key_material(self, key_material_handle: KeyMaterialHandle) -> None:
        """释放密钥材料句柄"""
        # 构造后端需要的格式
        key_material = {
            'session_id': key_material_handle.session_id,
            'handle_id': key_material_handle.handle_id
        }
        self.backend.release_key_material(key_material)

    def get_session_status(self, session_handle: SessionHandle) -> SessionStatus:
        """获取会话状态"""
        status_dict = self.backend.get_session_status(session_handle.session_id)

        return SessionStatus(
            session_handle=session_handle,
            status=status_dict['status'],
            participant_count=status_dict['participant_count'],
            key_length=status_dict['key_length'],
            created_at=status_dict['created_at'],
            updated_at=status_dict['updated_at'],
            completed_at=status_dict.get('completed_at'),
            entropy=status_dict.get('entropy'),
            qber=status_dict.get('qber'),
            statistics=status_dict.get('statistics', {})
        )

    def get_protocol_events(self,
                           session_handle: SessionHandle,
                           start_time: Optional[datetime] = None,
                           end_time: Optional[datetime] = None) -> List[ProtocolEvent]:
        """获取协商过程事件"""
        events_dict = self.backend.get_protocol_events(
            session_handle.session_id, start_time, end_time)

        events = []
        for event_dict in events_dict:
            events.append(ProtocolEvent(
                event_id=event_dict['event_id'],
                event_type=event_dict['event_type'],
                event_stage=event_dict['event_stage'],
                timestamp=event_dict['timestamp'],
                title=event_dict['title'],
                description=event_dict.get('description', ''),
                severity=event_dict.get('severity', 'info'),
                payload=event_dict.get('payload', {})
            ))

        return events

    def health_check(self) -> bool:
        """健康检查"""
        return self.backend.health_check()


# 工厂函数，便于创建不同类型的引擎实例
def create_qke_engine(backend_type: str = "local_simulator") -> QKEEngineInterface:
    """
    创建QKE引擎实例

    Args:
        backend_type: 后端类型，目前仅支持"local_simulator"

    Returns:
        QKEEngineInterface: QKE引擎实例
    """
    if backend_type == "local_simulator":
        return QKEEngineAdapter(LocalSimulatorBackend())
    else:
        raise ValueError(f"Unsupported backend type: {backend_type}")
