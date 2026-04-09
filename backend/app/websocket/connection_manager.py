import logging
from typing import Dict, List, Optional
from fastapi import WebSocket
import json
from datetime import datetime

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket连接管理器"""
    
    def __init__(self):
        # 用户ID到WebSocket连接的映射
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # WebSocket到用户ID的映射，用于快速查找
        self.connection_to_user: Dict[WebSocket, int] = {}
    
    def _get_current_time(self):
        """
        获取当前时间
        """
        return datetime.utcnow()
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """
        连接WebSocket
        """
        await websocket.accept()
        
        # 添加到用户的连接列表
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        
        # 记录连接到用户的映射
        self.connection_to_user[websocket] = user_id
        
        # 发送连接成功消息
        await self.send_personal_message(
            {
                "type": "connection_success",
                "data": {
                    "user_id": user_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "message": "WebSocket连接成功"
                }
            },
            user_id
        )
    
    def disconnect(self, websocket: WebSocket):
        """
        断开WebSocket连接
        """
        if websocket in self.connection_to_user:
            user_id = self.connection_to_user[websocket]
            
            # 从用户的连接列表中移除
            if user_id in self.active_connections:
                self.active_connections[user_id].remove(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
            
            # 移除连接映射
            del self.connection_to_user[websocket]
    
    async def send_personal_message(self, message: dict, user_id: int):
        """
        发送个人消息
        """
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(json.dumps(message, ensure_ascii=False))
                except Exception as e:
                    logging.debug("发送消息失败: %s", e)
                    # 移除无效连接
                    self.disconnect(connection)
    
    async def broadcast_to_conversation(self, message: dict, participant_ids: List[int]):
        """
        广播消息到会话成员
        """
        for user_id in participant_ids:
            await self.send_personal_message(message, user_id)
    
    async def send_message_notification(
        self,
        conversation_id: int,
        message_id: int,
        sender_id: int,
        content: str,
        participant_ids: List[int]
    ):
        """
        发送消息通知
        """
        notification = {
            "type": "new_message",
            "data": {
                "conversation_id": conversation_id,
                "message_id": message_id,
                "sender_id": sender_id,
                "content": content,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        await self.broadcast_to_conversation(notification, participant_ids)
    
    async def send_status_update(self, user_id: int, status: str):
        """
        发送状态更新
        """
        update = {
            "type": "status_update",
            "data": {
                "user_id": user_id,
                "status": status,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        # 这里应该广播给用户的联系人
        # 暂时只发送给用户自己
        await self.send_personal_message(update, user_id)
    
    def get_online_users(self) -> List[int]:
        """
        获取在线用户列表
        """
        return list(self.active_connections.keys())
    
    def is_user_online(self, user_id: int) -> bool:
        """
        检查用户是否在线
        """
        return user_id in self.active_connections
    
    def get_user_connections(self, user_id: int) -> List[WebSocket]:
        """
        获取用户的所有连接
        """
        return self.active_connections.get(user_id, [])
