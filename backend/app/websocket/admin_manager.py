"""
管理端WebSocket管理器
用于向管理端实时广播用户状态、QKE进程等信息
"""
import logging
from typing import Dict, List, Set
from fastapi import WebSocket
import json
from datetime import datetime

logger = logging.getLogger(__name__)


class AdminWebSocketManager:
    """管理端WebSocket连接管理器"""
    
    def __init__(self):
        # 存储所有管理端连接
        self.admin_connections: List[WebSocket] = []
        # 存储用户ID到角色的映射
        self.user_roles: Dict[int, str] = {}  # user_id -> 'leader' | 'follower'
        # 存储在线用户ID集合
        self.online_users: Set[int] = set()
        # 存储用户信息缓存
        self.user_info_cache: Dict[int, dict] = {}
    
    async def connect(self, websocket: WebSocket):
        """管理端连接（调用方需先 websocket.accept()）"""
        self.admin_connections.append(websocket)
        logger.debug("管理端连接建立，当前连接数: %d", len(self.admin_connections))
    
    def disconnect(self, websocket: WebSocket):
        """管理端断开连接"""
        if websocket in self.admin_connections:
            self.admin_connections.remove(websocket)
            logger.debug("管理端连接断开，当前连接数: %d", len(self.admin_connections))
    
    async def broadcast(self, message: dict):
        """向所有管理端广播消息"""
        if not self.admin_connections:
            logger.debug("没有管理端连接，跳过广播")
            return

        message_json = json.dumps(message, ensure_ascii=False, default=str)
        logger.debug("广播消息: %s", message_json[:200])
        disconnected = []
        
        for i, connection in enumerate(self.admin_connections):
            try:
                await connection.send_text(message_json)
                logger.debug("消息已发送到连接 %d", i+1)
            except Exception as e:
                logger.warning("发送消息到连接 %d 失败: %s", i+1, e)
                disconnected.append(connection)
        
        # 清理断开的连接
        for conn in disconnected:
            self.disconnect(conn)
    
    async def notify_user_registered(self, user_data: dict):
        """通知管理端有新用户注册"""
        await self.broadcast({
            "type": "user_registered",
            "data": {
                "user_id": user_data["user_id"],
                "username": user_data["username"],
                "phone": user_data.get("phone"),
                "email": user_data.get("email"),
                "role": user_data.get("role", "follower"),  # 默认角色为follower
                "created_at": user_data.get("created_at"),
                "is_online": False
            },
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def notify_user_login(self, user_data: dict):
        """通知管理端用户登录"""
        self.online_users.add(user_data["user_id"])
        await self.broadcast({
            "type": "user_login",
            "data": {
                "user_id": user_data["user_id"],
                "username": user_data["username"],
                "role": user_data.get("role", "follower"),
                "is_online": True,
                "login_at": datetime.utcnow().isoformat()
            },
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def notify_user_logout(self, user_data: dict):
        """通知管理端用户登出"""
        user_id = user_data.get("user_id")
        username = user_data.get("username", "")
        self.online_users.discard(user_id)
        await self.broadcast({
            "type": "user_logout",
            "data": {
                "user_id": user_id,
                "username": username,
                "is_online": False,
                "logout_at": datetime.utcnow().isoformat()
            },
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def notify_qke_event(self, event_data: dict):
        """通知管理端QKE事件"""
        await self.broadcast({
            "type": "qke_event",
            "data": event_data,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def notify_qke_started(self, session_data: dict):
        """通知管理端QKE会话开始"""
        await self.broadcast({
            "type": "qke_started",
            "data": {
                "session_id": session_data["session_id"],
                "conversation_id": session_data.get("conversation_id"),
                "participants": session_data.get("participants", []),
                "started_at": datetime.utcnow().isoformat()
            },
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def notify_qke_progress(self, progress_data: dict):
        """通知管理端QKE进度更新"""
        await self.broadcast({
            "type": "qke_progress",
            "data": progress_data,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def notify_qke_completed(self, session_data: dict):
        """通知管理端QKE会话完成"""
        await self.broadcast({
            "type": "qke_completed",
            "data": {
                "session_id": session_data["session_id"],
                "final_key_length": session_data.get("final_key_length"),
                "statistics": session_data.get("statistics"),
                "completed_at": datetime.utcnow().isoformat()
            },
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def set_user_role(self, user_id: int, role: str):
        """设置用户角色"""
        self.user_roles[user_id] = role
    
    def get_user_role(self, user_id: int) -> str:
        """获取用户角色"""
        return self.user_roles.get(user_id, "follower")
    
    def cache_user_info(self, user_id: int, user_info: dict):
        """缓存用户信息"""
        self.user_info_cache[user_id] = user_info
    
    def get_cached_user_info(self, user_id: int) -> dict:
        """获取缓存的用户信息"""
        return self.user_info_cache.get(user_id, {})
    
    def is_user_online(self, user_id: int) -> bool:
        """检查用户是否在线"""
        return user_id in self.online_users
    
    def get_online_users_count(self) -> int:
        """获取在线用户数量"""
        return len(self.online_users)


# 全局管理端WebSocket管理器实例
admin_ws_manager = AdminWebSocketManager()
