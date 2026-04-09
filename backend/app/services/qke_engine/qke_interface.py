# QKE Engine Standard Interface
# 根据国盾琨腾密码服务管理平台的标准化服务理念设计
# 为业务层提供统一的量子密钥协商能力调用接口

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import datetime


class ParticipantConfig:
    """参与者配置"""
    def __init__(self, user_id: int, is_leader: bool = False):
        self.user_id = user_id
        self.is_leader = is_leader


class SessionConfig:
    """会话配置"""
    def __init__(self,
                 key_length: int = 256,
                 decoy_count: int = 4,
                 protocol_name: str = "QKE-STANDARD",
                 protocol_version: str = "v1"):
        self.key_length = key_length
        self.decoy_count = decoy_count
        self.protocol_name = protocol_name
        self.protocol_version = protocol_version


class SessionHandle:
    """会话句柄 - 不暴露底层实现"""
    def __init__(self, session_id: str):
        self.session_id = session_id

    def __eq__(self, other):
        return isinstance(other, SessionHandle) and self.session_id == other.session_id

    def __hash__(self):
        return hash(self.session_id)


class KeyMaterialHandle:
    """密钥材料句柄 - 用于安全派生，不暴露明文密钥"""
    def __init__(self, handle_id: str, session_id: str, purpose: str):
        self.handle_id = handle_id
        self.session_id = session_id
        self.purpose = purpose

    def __eq__(self, other):
        return (isinstance(other, KeyMaterialHandle) and
                self.handle_id == other.handle_id and
                self.session_id == other.session_id and
                self.purpose == other.purpose)

    def __hash__(self):
        return hash((self.handle_id, self.session_id, self.purpose))


class ProtocolResult:
    """协商结果"""
    def __init__(self,
                 success: bool,
                 session_handle: Optional[SessionHandle] = None,
                 key_length: int = 0,
                 entropy: Optional[float] = None,
                 qber: Optional[float] = None,
                 statistics: Optional[Dict[str, Any]] = None,
                 error_message: Optional[str] = None,
                 fingerprint: Optional[str] = None):
        self.success = success
        self.session_handle = session_handle
        self.key_length = key_length
        self.entropy = entropy
        self.qber = qber
        self.statistics = statistics or {}
        self.error_message = error_message
        self.fingerprint = fingerprint


class ProtocolEvent:
    """协商过程事件"""
    def __init__(self,
                 event_id: str,
                 event_type: str,
                 event_stage: str,
                 timestamp: datetime,
                 title: str,
                 description: str = "",
                 severity: str = "info",
                 payload: Optional[Dict[str, Any]] = None):
        self.event_id = event_id
        self.event_type = event_type
        self.event_stage = event_stage
        self.timestamp = timestamp
        self.title = title
        self.description = description
        self.severity = severity
        self.payload = payload or {}


class SessionStatus:
    """会话状态"""
    def __init__(self,
                 session_handle: SessionHandle,
                 status: str,  # created, running, completed, failed, rotating
                 participant_count: int,
                 key_length: int,
                 created_at: datetime,
                 updated_at: datetime,
                 completed_at: Optional[datetime] = None,
                 entropy: Optional[float] = None,
                 qber: Optional[float] = None,
                 statistics: Optional[Dict[str, Any]] = None):
        self.session_handle = session_handle
        self.status = status
        self.participant_count = participant_count
        self.key_length = key_length
        self.created_at = created_at
        self.updated_at = updated_at
        self.completed_at = completed_at
        self.entropy = entropy
        self.qber = qber
        self.statistics = statistics or {}


class QKEEngineInterface(ABC):
    """
    量子密钥协商引擎标准接口
    参考国盾琨腾密码服务管理平台的标准化服务理念
    业务层仅通过此接口与QKE引擎交互，不需要了解量子协议细节
    """

    @abstractmethod
    def create_session(self,
                      participants: List[ParticipantConfig],
                      session_config: SessionConfig) -> SessionHandle:
        """
        创建QKE会话

        Args:
            participants: 参与者列表
            session_config: 会话配置

        Returns:
            SessionHandle: 会话句柄

        Raises:
            ValueError: 参数无效时
            RuntimeError: 创建失败时
        """
        pass

    @abstractmethod
    def execute_protocol(self, session_handle: SessionHandle) -> ProtocolResult:
        """
        执行QKE协商

        Args:
            session_handle: 会话句柄

        Returns:
            ProtocolResult: 协商结果，包含是否成功以及相关统计信息
        """
        pass

    @abstractmethod
    def get_key_material(self,
                        session_handle: SessionHandle,
                        purpose: str) -> KeyMaterialHandle:
        """
        获取用于特定目的的密钥材料句柄
        重要：不暴露明文密钥，仅返回用于派生的句柄

        Args:
            session_handle: 会话句柄
            purpose: 使用目的，如 "message_encryption", "file_encryption", "authentication" 等

        Returns:
            KeyMaterialHandle: 密钥材料句柄

        Raises:
            ValueError: 目的无效或会话未完成时
        """
        pass

    @abstractmethod
    def derive_key(self,
                  key_material_handle: KeyMaterialHandle,
                  context: bytes,
                  length: int = 32) -> bytes:
        """
        从密钥材料派生特定用途的密钥
        参考国盾文章的一致密钥派生理念

        Args:
            key_material_handle: 密钥材料句柄
            context: 派生上下文（如消息序号、时间戳等）
            length: 所需密钥长度（字节）

        Returns:
            bytes: 派生的密钥

        Raises:
            ValueError: 参数无效时
        """
        pass

    @abstractmethod
    def release_key_material(self, key_material_handle: KeyMaterialHandle) -> None:
        """
        释放密钥材料句柄
        使用完毕后应及时释放以避免资源泄漏

        Args:
            key_material_handle: 要释放的密钥材料句柄
        """
        pass

    @abstractmethod
    def get_session_status(self, session_handle: SessionHandle) -> SessionStatus:
        """
        获取会话当前状态

        Args:
            session_handle: 会话句柄

        Returns:
            SessionStatus: 会话状态信息
        """
        pass

    @abstractmethod
    def get_protocol_events(self,
                           session_handle: SessionHandle,
                           start_time: Optional[datetime] = None,
                           end_time: Optional[datetime] = None) -> List[ProtocolEvent]:
        """
        获取协商过程事件（用于审计和可视化）
        参考国盾文章的全过程可监控理念

        Args:
            session_handle: 会话句柄
            start_time: 开始时间（可选，None表示从开始）
            end_time: 结束时间（可选，None表示到结束）

        Returns:
            List[ProtocolEvent]: 协商事件列表，按时间顺序排序
        """
        pass

    @abstractmethod
    def health_check(self) -> bool:
        """
        健康检查

        Returns:
            bool: 引擎是否健康可用
        """
        pass