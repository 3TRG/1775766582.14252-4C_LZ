import json
import logging
from datetime import datetime

from fastapi import APIRouter, WebSocket, Depends, Query
from sqlalchemy.orm import Session as OrmSession

from app.models import get_db, SessionLocal
from app.models.models import QKEEvent as LegacyQKEEvent
from app.models.v1_models import QKEEvent as V1QKEEvent, User
from app.websocket.user_handler import user_websocket_handler
from app.websocket.admin_manager import admin_ws_manager
from app.core.security import parse_access_token

router = APIRouter()
logger = logging.getLogger(__name__)


def _authenticate_ws_token(token: str) -> dict | None:
    """验证 WebSocket 连接的 JWT token，成功返回 payload，失败返回 None"""
    try:
        return parse_access_token(token)
    except (ValueError, Exception):
        return None


def _check_admin_from_payload(db: OrmSession, payload: dict) -> User | None:
    """从 JWT payload 检查用户是否为管理员"""
    user_id = payload.get("user_id")
    if not user_id:
        return None
    user = db.query(User).filter(User.id == int(user_id), User.status == "active").first()
    if user and user.is_admin:
        return user
    return None


@router.websocket("/api/admin/ws/sessions/{session_id}/events")
async def admin_events_ws(websocket: WebSocket, session_id: str):
    """
    管理端：会话事件推送（Legacy）
    - 连接后先推送该 session 已落库事件（legacy QKEEvent）
    - 然后注册为实时连接，后续增量事件也会推送
    """
    await websocket.accept()
    db: OrmSession = SessionLocal()
    try:
        # 推送历史事件
        events = db.query(LegacyQKEEvent).filter(
            LegacyQKEEvent.session_id == session_id
        ).order_by(LegacyQKEEvent.seq).all()
        for e in events:
            await websocket.send_text(json.dumps({
                "id": e.id,
                "seq": e.seq,
                "type": e.event_type,
                "level": e.level,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                "summary": e.summary,
                "details": json.loads(e.details_json) if e.details_json else None
            }, ensure_ascii=False))
        # 注册为实时连接，接收后续事件
        await admin_ws_manager.connect(websocket)
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat()
                }, ensure_ascii=False))
    except Exception as e:
        logger.warning("[WS] admin_events_ws 连接异常 (session=%s): %s", session_id, e)
    finally:
        admin_ws_manager.disconnect(websocket)
        db.close()


@router.websocket("/ws/admin/page2/{qke_session_id}")
async def ws_admin_page2(websocket: WebSocket, qke_session_id: int):
    """
    设计稿对应：WS /ws/admin/page2/{qke_session_id}
    - 连接后推送该 qke_session 的历史事件（v1 QKEEvent）
    - 然后注册为实时连接，后续增量事件也会推送
    """
    await websocket.accept()
    db: OrmSession = SessionLocal()
    try:
        # 推送历史事件
        events = (
            db.query(V1QKEEvent)
            .filter(V1QKEEvent.qke_session_id == qke_session_id)
            .order_by(V1QKEEvent.event_time.asc(), V1QKEEvent.id.asc())
            .all()
        )
        for e in events:
            await websocket.send_text(json.dumps({
                "type": "qke_event",
                "data": {
                    "event_type": e.event_type,
                    "round_number": e.round_number,
                    "event_stage": e.event_stage,
                    "event_time": e.event_time.isoformat() if e.event_time else None,
                    "detail": json.loads(e.detail_json) if e.detail_json else {},
                    "severity": e.severity,
                    "title": e.title,
                }
            }, ensure_ascii=False))
        # 注册为实时连接，接收后续事件
        await admin_ws_manager.connect(websocket)
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat()
                }, ensure_ascii=False))
    except Exception as e:
        logger.warning("[WS] admin_page2 连接异常 (session=%s): %s", qke_session_id, e)
    finally:
        admin_ws_manager.disconnect(websocket)
        db.close()


@router.websocket("/ws/user")
async def user_websocket(
    websocket: WebSocket,
    token: str,
    db=Depends(get_db)
):
    """用户端WebSocket连接，委托给user_handler处理"""
    await user_websocket_handler(websocket, token, db)


@router.websocket("/ws/admin/realtime")
async def admin_realtime_ws(
    websocket: WebSocket,
    token: str | None = Query(default=None),
):
    """管理端实时WebSocket连接 - 通用监控通道

    认证方式：通过 query 参数传递 JWT token，例如 ws://host/ws/admin/realtime?token=xxx
    如果认证失败，连接会被关闭。
    """
    # 认证检查
    # TODO: 当管理端前端实现登录流程后，应强制要求 token
    # 目前阶段：如果提供了 token 则验证，未提供则记录警告但允许连接
    admin_user = None
    if token:
        payload = _authenticate_ws_token(token)
        if payload:
            db: OrmSession = SessionLocal()
            try:
                admin_user = _check_admin_from_payload(db, payload)
            finally:
                db.close()

            if not admin_user:
                await websocket.accept()
                await websocket.send_text(json.dumps({
                    "type": "auth_error",
                    "data": {"message": "需要管理员权限"}
                }, ensure_ascii=False))
                await websocket.close(code=4003, reason="forbidden")
                return
        else:
            await websocket.accept()
            await websocket.send_text(json.dumps({
                "type": "auth_error",
                "data": {"message": "认证失败，token 无效或已过期"}
            }, ensure_ascii=False))
            await websocket.close(code=4001, reason="invalid_token")
            return
    else:
        logger.warning("[WS] admin_realtime 连接未携带 token，建议管理端实现认证后传递 ?token= 参数")

    await websocket.accept()
    await admin_ws_manager.connect(websocket)
    try:
        welcome_msg = f"管理端WebSocket连接成功，欢迎 {admin_user.username}" if admin_user else "管理端WebSocket连接成功（未认证）"
        await websocket.send_text(json.dumps({
            "type": "connection_success",
            "data": {
                "online_users_count": admin_ws_manager.get_online_users_count(),
                "message": welcome_msg
            }
        }, ensure_ascii=False))

        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "data": {"message": "无效的JSON格式"}
                }, ensure_ascii=False))
                continue

            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat()
                }, ensure_ascii=False))
            elif message.get("type") == "heartbeat":
                await websocket.send_text(json.dumps({
                    "type": "heartbeat_ack",
                    "timestamp": datetime.utcnow().isoformat()
                }, ensure_ascii=False))
    except Exception as e:
        logger.info("[WS] admin_realtime 连接关闭: %s", e)
    finally:
        admin_ws_manager.disconnect(websocket)
