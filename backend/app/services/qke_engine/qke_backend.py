"""
QKE后端抽象层
定义量子后端的标准接口，支持不同的量子计算后端（本地模拟器、真实量子硬件等）
参考启科QuPot+Runtime的多后端支持理念
"""

import abc
import hashlib
import logging
import secrets

logger = logging.getLogger(__name__)
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime

from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

from .qke_interface import (
    ParticipantConfig, SessionConfig, SessionHandle, KeyMaterialHandle,
    ProtocolResult, ProtocolEvent, SessionStatus, QKEEngineInterface
)
from .qke_core import QKEProtocol, QuantumCore


class QuantumBackend(abc.ABC):
    """量子后端抽象基类"""

    @abc.abstractmethod
    def create_session(self,
                      participants: List[ParticipantConfig],
                      session_config: SessionConfig) -> str:
        """创建会话并返回会话ID"""
        pass

    @abc.abstractmethod
    def execute_protocol(self, session_id: str) -> Dict[str, Any]:
        """执行QKE协商"""
        pass

    @abc.abstractmethod
    def get_key_material(self, session_id: str, purpose: str) -> Dict[str, Any]:
        """获取密钥材料句柄"""
        pass

    @abc.abstractmethod
    def derive_key(self, key_material: Dict[str, Any],
                  context: bytes, length: int = 32) -> bytes:
        """从密钥材料派生密钥"""
        pass

    @abc.abstractmethod
    def release_key_material(self, key_material: Dict[str, Any]) -> None:
        """释放密钥材料句柄"""
        pass

    @abc.abstractmethod
    def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """获取会话状态"""
        pass

    @abc.abstractmethod
    def get_protocol_events(self,
                           session_id: str,
                           start_time: Optional[datetime] = None,
                           end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """获取协商过程事件"""
        pass

    @abc.abstractmethod
    def health_check(self) -> bool:
        """健康检查"""
        pass

    def set_event_callback(self, callback: Callable[[str, str, str, str, Dict[str, Any]], None]) -> None:
        """设置事件回调函数，用于实时事件通知

        Args:
            callback: 函数签名为 callback(session_id, event_type, event_stage, title, details)
        """
        pass


class LocalSimulatorBackend(QuantumBackend):
    """
    本地模拟器后端
    当前默认实现，使用经典计算模拟量子操作
    未来可扩展为支持真实量子硬件或专用加速器
    """

    def __init__(self):
        self.core = QuantumCore()
        self.active_sessions: Dict[str, QKEProtocol] = {}
        self.session_events: Dict[str, List[Dict[str, Any]]] = {}
        self.session_metadata: Dict[str, Dict[str, Any]] = {}
        self.key_materials: Dict[str, Dict[str, Any]] = {}  # handle_id -> key_material_info
        self.event_callback: Optional[Callable[[str, str, str, str, Dict[str, Any]], None]] = None

    def create_session(self,
                      participants: List[ParticipantConfig],
                      session_config: SessionConfig) -> str:
        """创建会话并返回会话ID"""
        session_id = f"qke_{secrets.token_hex(16)}"

        # 转换参与者配置为QKEProtocol所需格式
        qke_participants = []
        for p in participants:
            qke_participants.append({
                'user_id': p.user_id,
                'is_leader': p.is_leader
            })

        # 创建QKE协议实例
        protocol = QKEProtocol(
            num_participants=len(participants),
            m_value=session_config.key_length,
            decoy_count=session_config.decoy_count
        )

        # 初始化参与者（恶意节点模型已移除，所有参与者均为正常角色）
        protocol.initialize_participants()

        # 存储会话信息
        self.active_sessions[session_id] = protocol
        self.session_events[session_id] = []
        self.session_metadata[session_id] = {
            'config': session_config,
            'participants': participants,
            'created_at': datetime.now(),
            'status': 'created'
        }

        # 记录会话创建事件
        self._record_event(session_id, 'session_created', 'created',
                         f"QKE会话已创建，参与者数: {len(participants)}, 密钥长度: {session_config.key_length}",
                         {'participant_count': len(participants), 'key_length': session_config.key_length})

        return session_id

    def execute_protocol(self, session_id: str) -> Dict[str, Any]:
        """执行QKE协商"""
        if session_id not in self.active_sessions:
            raise ValueError(f"Session {session_id} not found")

        protocol = self.active_sessions[session_id]
        metadata = self.session_metadata[session_id]

        # 更新状态
        metadata['status'] = 'running'
        self._record_event(session_id, 'protocol_start', 'started',
                         "QKE协商开始", {'timestamp': datetime.now().isoformat()})

        try:
            # 执行完整协议
            result = protocol.run_full_protocol()

            # 更新会话信息
            metadata['status'] = 'completed'
            metadata['completed_at'] = datetime.now()
            metadata['result'] = result

            # 计算熵值
            entropy_info = protocol.calculate_entropy()
            metadata['entropy'] = entropy_info['shannon_entropy']

            # 记录完成事件
            self._record_event(session_id, 'protocol_completed', 'completed',
                             "QKE协商完成",
                             {
                                 'final_key_fingerprint': protocol.get_final_key_fingerprint(),
                                 'key_length': metadata['config'].key_length,
                                 'entropy': entropy_info,
                                 'statistics': result['statistics']
                             })

            return {
                'success': True,
                'session_id': session_id,
                'key_length': metadata['config'].key_length,
                'entropy': entropy_info['shannon_entropy'],
                'qber': result['statistics'].get('qber', 0.0),
                'statistics': result['statistics'],
                'fingerprint': protocol.get_final_key_fingerprint()
            }

        except Exception as e:
            metadata['status'] = 'failed'
            metadata['error'] = str(e)
            self._record_event(session_id, 'protocol_failed', 'failed',
                             f"QKE协商失败: {str(e)}", {'error': str(e)})
            raise

    def get_key_material(self, session_id: str, purpose: str) -> Dict[str, Any]:
        """获取密钥材料句柄"""
        if session_id not in self.active_sessions:
            raise ValueError(f"Session {session_id} not found")

        metadata = self.session_metadata[session_id]
        if metadata['status'] != 'completed':
            raise ValueError(f"Session {session_id} not completed yet")

        # 生成密钥材料句柄 - 不暴露明文密钥
        material_id = f"km_{session_id}_{purpose}_{secrets.token_hex(8)}"

        # 存储密钥材料信息
        self.key_materials[material_id] = {
            'session_id': session_id,
            'purpose': purpose,
            'created_at': datetime.now(),
            'released': False
        }

        return {
            'handle_id': material_id,
            'session_id': session_id,
            'purpose': purpose,
            'created_at': datetime.now()
        }

    def derive_key(self, key_material: Dict[str, Any],
                  context: bytes, length: int = 32) -> bytes:
        """从密钥材料派生密钥"""
        session_id = key_material['session_id']
        handle_id = key_material['handle_id']
        purpose = key_material['purpose']

        # 检查句柄是否有效
        if handle_id not in self.key_materials:
            raise ValueError("Invalid key material handle")

        km_info = self.key_materials[handle_id]
        if km_info['session_id'] != session_id or km_info['purpose'] != purpose:
            raise ValueError("Key material handle mismatch")

        if km_info.get('released', False):
            raise ValueError("Key material has been released")

        protocol = self.active_sessions[session_id]
        if not protocol.final_key:
            raise ValueError("No final key available")

        # 获取会话密钥
        session_key = ''.join(str(bit) for bit in protocol.final_key)

        # Use standard HKDF for key derivation (matches security_service.py approach)
        info = f"{purpose}|{context.hex() if isinstance(context, bytes) else str(context)}".encode('utf-8')
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=length,
            salt=None,
            info=info,
            backend=default_backend(),
        )
        return hkdf.derive(session_key.encode('utf-8'))

    def release_key_material(self, key_material: Dict[str, Any]) -> None:
        """释放密钥材料句柄"""
        handle_id = key_material['handle_id']
        if handle_id in self.key_materials:
            # 标记为已释放
            self.key_materials[handle_id]['released'] = True
            self.key_materials[handle_id]['released_at'] = datetime.now()

    def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """获取会话状态"""
        if session_id not in self.session_metadata:
            raise ValueError(f"Session {session_id} not found")

        metadata = self.session_metadata[session_id]
        protocol = self.active_sessions.get(session_id)

        status_info = {
            'session_id': session_id,
            'status': metadata['status'],
            'participant_count': len(metadata['participants']),
            'key_length': metadata['config'].key_length,
            'created_at': metadata['created_at'],
            'updated_at': metadata.get('updated_at', metadata['created_at']),
            'completed_at': metadata.get('completed_at'),
            'entropy': metadata.get('entropy'),
            'qber': metadata.get('qber', 0.0),
            'statistics': metadata.get('result', {}).get('statistics', {}) if metadata.get('result') else {}
        }

        return status_info

    def get_protocol_events(self,
                           session_id: str,
                           start_time: Optional[datetime] = None,
                           end_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """获取协商过程事件"""
        if session_id not in self.session_events:
            raise ValueError(f"Session {session_id} not found")

        events = self.session_events[session_id]

        # 时间过滤
        if start_time:
            events = [e for e in events if e['timestamp'] >= start_time]
        if end_time:
            events = [e for e in events if e['timestamp'] <= end_time]

        return events

    def _record_event(self, session_id: str, event_type: str, event_stage: str,
                     title: str, details: Dict[str, Any] = None):
        """记录事件"""
        if session_id not in self.session_events:
            self.session_events[session_id] = []

        event = {
            'event_id': f"evt_{session_id}_{len(self.session_events[session_id])}",
            'event_type': event_type,
            'event_stage': event_stage,
            'title': title,
            'description': details.get('description', '') if details else '',
            'timestamp': datetime.now(),
            'severity': details.get('severity', 'info') if details else 'info',
            'payload': details or {}
        }

        self.session_events[session_id].append(event)

        # 如果设置了事件回调，则触发回调以实现实时事件通知
        if self.event_callback:
            try:
                self.event_callback(session_id, event_type, event_stage, title, details or {})
            except Exception as e:
                # 避免回调错误影响事件记录
                logger.warning("事件回调执行失败: %s", e)

    def health_check(self) -> bool:
        """健康检查"""
        return True  # 本地模拟器始终健康
