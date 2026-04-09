from fastapi import WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
import json
import logging
from typing import Dict, Any

from app.models import get_db
from app.core.security import parse_access_token
from app.services.chat_service import ChatService
from app.services.auth_service import get_user_by_id
from .connection_manager import ConnectionManager
from app.models.v1_models import Conversation, ConversationMember, User

logger = logging.getLogger(__name__)

logger = logging.getLogger(__name__)

logger = logging.getLogger(__name__)

# 全局连接管理器
manager = ConnectionManager()


async def user_websocket_handler(
    websocket: WebSocket,
    token: str,
    db: Session = Depends(get_db)
):
    """
    用户端WebSocket处理器
    """
    # 验证token
    try:
        payload = parse_access_token(token)
        user_id = int(payload["user_id"])
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    # 验证用户是否存在
    user = get_user_by_id(db, user_id)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    # 连接WebSocket
    await manager.connect(websocket, user_id)
    
    # 更新用户在线状态
    user.online_status = "online"
    user.last_seen_at = manager._get_current_time()
    db.commit()
    
    # 发送在线状态更新
    await manager.send_status_update(user_id, "online")
    
    try:
        while True:
            # 接收消息
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # 处理不同类型的消息
            message_type = message.get("type")
            message_data = message.get("data", {})
            
            if message_type == "send_message":
                await handle_send_message(db, user_id, message_data)
            elif message_type == "mark_read":
                await handle_mark_read(db, user_id, message_data)
            elif message_type == "typing":
                await handle_typing(user_id, message_data)
            elif message_type == "get_online_users":
                await handle_get_online_users(user_id)
            elif message_type == "ping":
                await handle_ping(websocket)
            else:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "data": {
                        "message": "未知的消息类型"
                    }
                }, ensure_ascii=False))
    
    except WebSocketDisconnect:
        # 处理连接断开
        manager.disconnect(websocket)
        # 更新用户离线状态
        user = get_user_by_id(db, user_id)
        if user:
            user.online_status = "offline"
            user.last_seen_at = manager._get_current_time()
            db.commit()
            # 发送离线状态更新
            await manager.send_status_update(user_id, "offline")
            # 通知管理端用户下线
            from app.websocket.admin_manager import admin_ws_manager
            await admin_ws_manager.notify_user_logout({
                "user_id": user_id,
                "username": user.username,
            })
    except Exception as e:
        logger.error("WebSocket错误: %s", e)
        manager.disconnect(websocket)


async def handle_send_message(db: Session, user_id: int, data: Dict[str, Any]):
    """
    处理发送消息
    """
    conversation_id_raw = data.get("conversation_id")
    content = data.get("content")
    message_type = data.get("message_type", "text")

    if not conversation_id_raw or not content:
        return

    chat_service = ChatService(db)

    try:
        # 前端传入的 conversation_id 实际上是对方的 user ID
        # 需要查找或创建对应的私聊会话
        conversation_id = await _resolve_or_create_conversation(
            db=db,
            sender_id=user_id,
            conversation_id_raw=conversation_id_raw,
            chat_service=chat_service,
        )

        # 发送消息
        message = await chat_service.send_message(
            sender_id=user_id,
            conversation_id=conversation_id,
            content=content,
            message_type=message_type,
        )

        # 获取会话成员并广播（排除发送者，避免重复）
        members = chat_service._get_conversation_members(conversation_id)
        participant_ids = [m.user_id for m in members if m.user_id != user_id]

        if participant_ids:
            await manager.send_message_notification(
                conversation_id=conversation_id,
                message_id=message.id,
                sender_id=user_id,
                content=content,
                participant_ids=participant_ids,
            )
    except Exception as e:
        logger.warning("发送消息失败: %s", e)


async def _resolve_or_create_conversation(
    db: Session, sender_id: int, conversation_id_raw, chat_service: ChatService
):
    """解析会话ID：先尝试按会话ID查找，找不到则当作对方 user_id 查找/创建私聊会话"""
    conv_id_val = int(conversation_id_raw) if (
        isinstance(conversation_id_raw, int) or
        (isinstance(conversation_id_raw, str) and conversation_id_raw.isdigit())
    ) else None

    if conv_id_val is not None:
        # 先尝试作为会话ID查找
        conv = db.query(Conversation).filter(
            Conversation.id == conv_id_val,
            Conversation.type == "private",
            Conversation.status == "active",
        ).first()

        if conv:
            member = db.query(ConversationMember).filter(
                ConversationMember.conversation_id == conv.id,
                ConversationMember.user_id == sender_id,
                ConversationMember.status == "active",
            ).first()
            if member:
                return conv.id

        # 否则当作 user_id 处理，查找已有私聊会话
        pairs = db.query(Conversation.id).join(
            ConversationMember, ConversationMember.conversation_id == Conversation.id
        ).filter(
            Conversation.type == "private",
            ConversationMember.status == "active",
            ConversationMember.user_id.in_([sender_id, conv_id_val]),
        ).group_by(
            Conversation.id
        ).having(
            func.count(ConversationMember.user_id) == 2
        ).all()

        if pairs:
            return pairs[0][0]

        # 没有现有会话，创建新的
        target_user = db.query(User).filter(
            User.id == conv_id_val, User.status == "active"
        ).first()
        if target_user:
            conv = await chat_service.create_conversation(
                creator_id=sender_id,
                participant_ids=[target_user.id],
                type="private",
            )
            return conv.id

    raise ValueError("无法解析会话ID")


async def handle_mark_read(db: Session, user_id: int, data: Dict[str, Any]):
    """
    处理标记已读
    """
    message_id = data.get("message_id")
    conversation_id = data.get("conversation_id")
    
    if not message_id:
        return
    
    from app.models.v1_models import MessageReceipt
    
    # 更新消息回执
    receipt = db.query(MessageReceipt).filter(
        MessageReceipt.message_id == message_id,
        MessageReceipt.user_id == user_id
    ).first()
    
    if receipt and not receipt.read_at:
        receipt.read_at = manager._get_current_time()
        db.commit()
        
        # 发送已读通知
        if conversation_id:
            # 这里可以发送已读通知给其他成员
            pass


async def handle_typing(user_id: int, data: Dict[str, Any]):
    """
    处理正在输入
    """
    conversation_id = data.get("conversation_id")
    is_typing = data.get("is_typing", False)
    
    if not conversation_id:
        return
    
    # 发送正在输入通知
    typing_notification = {
        "type": "typing",
        "data": {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "is_typing": is_typing,
            "timestamp": manager._get_current_time().isoformat()
        }
    }
    
    # 这里应该获取会话成员并广播
    # 暂时只实现基本结构


async def handle_get_online_users(user_id: int):
    """
    处理获取在线用户
    """
    online_users = manager.get_online_users()
    
    # 发送在线用户列表
    await manager.send_personal_message(
        {
            "type": "online_users",
            "data": {
                "online_users": online_users,
                "timestamp": manager._get_current_time().isoformat()
            }
        },
        user_id
    )


async def handle_ping(websocket: WebSocket):
    """
    处理心跳
    """
    await websocket.send_text(json.dumps({
        "type": "pong",
        "data": {
            "timestamp": manager._get_current_time().isoformat()
        }
    }, ensure_ascii=False))
