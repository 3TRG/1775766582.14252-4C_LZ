from __future__ import annotations

import base64
import hashlib
import json
import logging
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import get_db
from app.models.v1_models import (
    Contact,
    Conversation,
    ConversationKeyMaterial,
    ConversationMember,
    Message,
    QKEEvent,
    QKESession,
    User,
)
from app.schemas.auth import UserProfile
from app.schemas.chat_unified import (
    ConversationCreateRequest,
    ConversationCreateResponse,
    FriendAddRequest,
    FriendItem,
    FriendsResponse,
    GroupMessageSendRequest,
    MessageItem,
    P2PHistoryResponse,
    P2PMessageSendRequest,
)
from app.core.security import parse_access_token
from app.services.security_service import security_service
from app.services.chat_orchestrator import (
    add_qke_event,
    resolve_protocol_path,
    run_qke_and_activate_epoch,
)

router = APIRouter()


async def _broadcast_p2p_message_notification(
    conversation_id: int,
    message_id: int,
    sender_id: int,
    recipient_id: int,
    content: str,
):
    """后台任务：通过 WebSocket 实时通知对方有新消息"""
    try:
        from app.websocket.connection_manager import manager
        await manager.send_message_notification(
            conversation_id=conversation_id,
            message_id=message_id,
            sender_id=sender_id,
            content=content,
            participant_ids=[recipient_id],
        )
    except Exception as e:
        logging.warning("[WS广播] 发送消息通知失败: %s", e)


def _parse_bearer(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="missing_authorization")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="invalid_authorization")
    return authorization.split(" ", 1)[1].strip()


def get_current_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> User:
    token = _parse_bearer(authorization)
    try:
        payload = parse_access_token(token)
        user_id = int(payload["user_id"])
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_token")

    user = db.query(User).filter(User.id == user_id, User.status == "active").first()
    if not user:
        raise HTTPException(status_code=401, detail="user_not_found")
    return user


def _user_profile(user: User) -> UserProfile:
    return UserProfile(
        user_id=user.id,
        username=user.username,
        account=user.phone or "",
        online_status=user.online_status or "offline",
    )


def _is_member(db: Session, conversation_id: int, user_id: int) -> bool:
    return (
        db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
            ConversationMember.status == "active",
        )
        .first()
        is not None
    )


def _find_private_conversation(db: Session, user_a: int, user_b: int) -> Conversation | None:
    pairs = (
        db.query(Conversation.id)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .filter(
            Conversation.type == "private",
            ConversationMember.status == "active",
            ConversationMember.user_id.in_([user_a, user_b]),
        )
        .group_by(Conversation.id)
        .having(func.count(ConversationMember.user_id) == 2)
        .all()
    )
    if not pairs:
        return None
    conv_id = pairs[0][0]
    return db.query(Conversation).filter(Conversation.id == conv_id).first()




@router.get("/friends", response_model=FriendsResponse)
def list_friends(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    relations = (
        db.query(Contact, User)
        .join(User, Contact.target_user_id == User.id)
        .filter(Contact.owner_user_id == current_user.id)
        .order_by(Contact.id.desc())
        .all()
    )
    items = [
        FriendItem(
            user_id=u.id,
            username=u.username,
            account=u.phone or "",
            online_status=u.online_status or "offline",
        )
        for _, u in relations
    ]
    return FriendsResponse(items=items)


@router.post("/friends", response_model=FriendItem)
def add_friend(
    payload: FriendAddRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raw = payload.account_or_user_id.strip()
    target: User | None = None

    if raw.isdigit():
        target = db.query(User).filter(User.id == int(raw), User.status == "active").first()
        if not target:
            target = db.query(User).filter(User.phone == raw, User.status == "active").first()
    elif raw.startswith("u_") and raw[2:].isdigit():
        target = db.query(User).filter(User.phone == raw[2:], User.status == "active").first()
    else:
        target = db.query(User).filter(User.phone == raw, User.status == "active").first()

    if not target:
        raise HTTPException(status_code=404, detail="target_user_not_found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="cannot_add_self")

    exists = (
        db.query(Contact)
        .filter(Contact.owner_user_id == current_user.id, Contact.target_user_id == target.id)
        .first()
    )
    if not exists:
        db.add(Contact(owner_user_id=current_user.id, target_user_id=target.id))
    reverse = (
        db.query(Contact)
        .filter(Contact.owner_user_id == target.id, Contact.target_user_id == current_user.id)
        .first()
    )
    if not reverse:
        db.add(Contact(owner_user_id=target.id, target_user_id=current_user.id))
    db.commit()

    return FriendItem(
        user_id=target.id,
        username=target.username,
        account=target.phone or "",
        online_status=target.online_status or "offline",
    )


@router.post("/conversations", response_model=ConversationCreateResponse)
def create_conversation(
    payload: ConversationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member_ids = sorted(set([current_user.id, *payload.member_ids]))
    if payload.type == "private" and len(member_ids) != 2:
        raise HTTPException(status_code=400, detail="private_conversation_requires_2_members")
    if payload.type == "group" and len(member_ids) < 3:
        raise HTTPException(status_code=400, detail="group_conversation_requires_3_or_more_members")

    users = db.query(User).filter(User.id.in_(member_ids), User.status == "active").all()
    if len(users) != len(member_ids):
        raise HTTPException(status_code=400, detail="some_members_not_found")

    if payload.type == "private":
        existing = _find_private_conversation(db, member_ids[0], member_ids[1])
        if existing:
            return ConversationCreateResponse(
                conversation_id=existing.id,
                conversation_type=existing.type,
                member_ids=member_ids,
                key_epoch=existing.current_key_epoch or 0,
                protocol_path=resolve_protocol_path(len(member_ids)),
                qke_session_id=(
                    db.query(QKESession.id)
                    .filter(QKESession.conversation_id == existing.id)
                    .order_by(QKESession.id.desc())
                    .first()
                    or [0]
                )[0],
            )

    conv = Conversation(
        conversation_no=f"conv-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4)}",
        type=payload.type,
        name="私聊会话" if payload.type == "private" else f"群聊({len(member_ids)})",
        owner_user_id=current_user.id,
        secure_mode="qke",
        current_key_epoch=0,
        qke_status="negotiating",
        member_count=len(member_ids),
        status="active",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(conv)
    db.flush()

    for uid in member_ids:
        db.add(
            ConversationMember(
                conversation_id=conv.id,
                user_id=uid,
                member_role="owner" if uid == current_user.id else "member",
                joined_at=datetime.utcnow(),
                status="active",
            )
        )

    qke_session_id, epoch_no, protocol_path = run_qke_and_activate_epoch(
        db,
        conversation=conv,
        member_ids=member_ids,
        trigger_type="initial",
        created_by=current_user.id,
    )
    db.commit()

    return ConversationCreateResponse(
        conversation_id=conv.id,
        conversation_type=conv.type,
        member_ids=member_ids,
        key_epoch=epoch_no,
        protocol_path=protocol_path,
        qke_session_id=qke_session_id,
    )


@router.post("/messages/p2p", response_model=MessageItem)
def send_p2p_message(
    payload: P2PMessageSendRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_user = db.query(User).filter(User.id == payload.to_user_id, User.status == "active").first()
    if not target_user:
        raise HTTPException(status_code=404, detail="target_user_not_found")

    conversation = _find_private_conversation(db, current_user.id, target_user.id)
    if not conversation:
        conv_resp = create_conversation(
            ConversationCreateRequest(type="private", member_ids=[target_user.id]),
            current_user=current_user,
            db=db,
        )
        conversation = db.query(Conversation).filter(Conversation.id == conv_resp.conversation_id).first()

    if not conversation or not _is_member(db, conversation.id, current_user.id):
        raise HTTPException(status_code=403, detail="conversation_not_accessible")

    epoch_no = conversation.current_key_epoch or 0
    if epoch_no <= 0:
        raise HTTPException(status_code=409, detail="no_active_key_epoch")

    key_material = (
        db.query(ConversationKeyMaterial)
        .filter(
            ConversationKeyMaterial.conversation_id == conversation.id,
            ConversationKeyMaterial.epoch_no == epoch_no,
        )
        .first()
    )
    if not key_material:
        raise HTTPException(status_code=409, detail="missing_epoch_key_material")

    key = base64.b64decode(key_material.key_material_b64.encode("utf-8"))
    aad = f"conv:{conversation.id}|epoch:{epoch_no}"
    ciphertext, nonce = security_service.encrypt_message_aesgcm(key, payload.text, aad=aad)

    seq = (
        db.query(func.max(Message.message_seq))
        .filter(Message.conversation_id == conversation.id)
        .scalar()
        or 0
    ) + 1

    msg = Message(
        conversation_id=conversation.id,
        sender_user_id=current_user.id,
        message_type="text",
        plaintext_digest=hashlib.sha256(payload.text.encode("utf-8")).hexdigest()[:16],
        ciphertext=ciphertext,
        nonce=nonce,
        aad=aad,
        encryption_alg="AES-GCM",
        key_epoch=epoch_no,
        message_seq=seq,
        send_status="sent",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(msg)
    conversation.last_message_at = datetime.utcnow()
    conversation.updated_at = datetime.utcnow()

    latest_qke = (
        db.query(QKESession)
        .filter(QKESession.conversation_id == conversation.id)
        .order_by(QKESession.id.desc())
        .first()
    )
    if latest_qke:
        add_qke_event(
            db,
            qke_session_id=latest_qke.id,
            conversation_id=conversation.id,
            event_type="message_encrypted",
            event_stage="transport",
            title="消息已完成加密并入库",
            detail={"message_seq": seq, "algorithm": "AES-GCM", "epoch_no": epoch_no},
        )
        add_qke_event(
            db,
            qke_session_id=latest_qke.id,
            conversation_id=conversation.id,
            event_type="message_delivered",
            event_stage="transport",
            title="消息已投递",
            detail={"message_seq": seq},
        )

    db.commit()
    db.refresh(msg)

    # WebSocket 实时通知
    background_tasks.add_task(
        _broadcast_p2p_message_notification,
        conversation_id=conversation.id,
        message_id=msg.id,
        sender_id=current_user.id,
        recipient_id=target_user.id,
        content=payload.text,
    )

    return MessageItem(
        id=msg.id,
        conversation_id=conversation.id,
        from_user_id=current_user.id,
        to_user_id=target_user.id,
        message_type=msg.message_type,
        plaintext=payload.text,
        created_at=msg.created_at,
    )


@router.post("/messages/p2p/file", response_model=MessageItem)
async def send_p2p_file(
    background_tasks: BackgroundTasks,
    to_user_id: int = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_user = db.query(User).filter(User.id == to_user_id, User.status == "active").first()
    if not target_user:
        raise HTTPException(status_code=404, detail="target_user_not_found")

    conversation = _find_private_conversation(db, current_user.id, target_user.id)
    if not conversation:
        conv_resp = create_conversation(
            ConversationCreateRequest(type="private", member_ids=[target_user.id]),
            current_user=current_user,
            db=db,
        )
        conversation = db.query(Conversation).filter(Conversation.id == conv_resp.conversation_id).first()

    if not conversation or not _is_member(db, conversation.id, current_user.id):
        raise HTTPException(status_code=403, detail="conversation_not_accessible")

    epoch_no = conversation.current_key_epoch or 0
    if epoch_no <= 0:
        raise HTTPException(status_code=409, detail="no_active_key_epoch")

    key_material = (
        db.query(ConversationKeyMaterial)
        .filter(
            ConversationKeyMaterial.conversation_id == conversation.id,
            ConversationKeyMaterial.epoch_no == epoch_no,
        )
        .first()
    )
    if not key_material:
        raise HTTPException(status_code=409, detail="missing_epoch_key_material")

    raw_bytes = await file.read()
    max_bytes = 1024 * 1024
    if len(raw_bytes) > max_bytes:
        raise HTTPException(status_code=413, detail="file_too_large")

    file_name = (file.filename or "").strip() or "file"
    file_mime = (file.content_type or "").strip() or "application/octet-stream"

    payload_json = json.dumps(
        {
            "file_name": file_name,
            "file_mime": file_mime,
            "file_b64": base64.b64encode(raw_bytes).decode("utf-8"),
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )

    key = base64.b64decode(key_material.key_material_b64.encode("utf-8"))
    aad = f"conv:{conversation.id}|epoch:{epoch_no}|type:file"
    ciphertext, nonce = security_service.encrypt_message_aesgcm(key, payload_json, aad=aad)

    seq = (
        db.query(func.max(Message.message_seq))
        .filter(Message.conversation_id == conversation.id)
        .scalar()
        or 0
    ) + 1

    msg = Message(
        conversation_id=conversation.id,
        sender_user_id=current_user.id,
        message_type="file",
        plaintext_digest=hashlib.sha256(raw_bytes).hexdigest()[:16],
        ciphertext=ciphertext,
        nonce=nonce,
        aad=aad,
        encryption_alg="AES-GCM",
        key_epoch=epoch_no,
        message_seq=seq,
        send_status="sent",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(msg)
    conversation.last_message_at = datetime.utcnow()
    conversation.updated_at = datetime.utcnow()

    latest_qke = (
        db.query(QKESession)
        .filter(QKESession.conversation_id == conversation.id)
        .order_by(QKESession.id.desc())
        .first()
    )
    if latest_qke:
        add_qke_event(
            db,
            qke_session_id=latest_qke.id,
            conversation_id=conversation.id,
            event_type="file_encrypted",
            event_stage="transport",
            title="文件已完成加密并入库",
            detail={"message_seq": seq, "algorithm": "AES-GCM", "epoch_no": epoch_no, "file_name": file_name},
        )
        add_qke_event(
            db,
            qke_session_id=latest_qke.id,
            conversation_id=conversation.id,
            event_type="file_delivered",
            event_stage="transport",
            title="文件已投递",
            detail={"message_seq": seq, "file_name": file_name},
        )

    db.commit()
    db.refresh(msg)

    # 通过 WebSocket 实时通知对方有新消息
    background_tasks.add_task(
        _broadcast_p2p_message_notification,
        conversation_id=conversation.id,
        message_id=msg.id,
        sender_id=current_user.id,
        recipient_id=target_user.id,
        content=f"[文件] {file_name}",
    )

    return MessageItem(
        id=msg.id,
        conversation_id=conversation.id,
        from_user_id=current_user.id,
        to_user_id=target_user.id,
        message_type=msg.message_type,
        plaintext=f"[文件] {file_name}",
        file_name=file_name,
        file_mime=file_mime,
        file_b64=base64.b64encode(raw_bytes).decode("utf-8"),
        created_at=msg.created_at,
    )


@router.get("/messages/p2p/history", response_model=P2PHistoryResponse)
def get_p2p_history(
    with_user_id: int,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = _find_private_conversation(db, current_user.id, with_user_id)
    if not conversation:
        return P2PHistoryResponse(items=[])

    rows = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.message_seq.asc())
        .limit(max(1, min(limit, 500)))
        .all()
    )

    key_material_rows = (
        db.query(ConversationKeyMaterial)
        .filter(ConversationKeyMaterial.conversation_id == conversation.id)
        .all()
    )
    key_map = {
        km.epoch_no: base64.b64decode(km.key_material_b64.encode("utf-8"))
        for km in key_material_rows
    }

    items: list[MessageItem] = []
    for row in rows:
        key = key_map.get(row.key_epoch)
        plaintext = "[解密失败]"
        message_type = row.message_type or "text"
        file_name = None
        file_mime = None
        file_b64 = None
        if key:
            try:
                decrypted = security_service.decrypt_message_aesgcm(key, row.ciphertext, row.nonce, aad=row.aad or "")
                if message_type == "file":
                    meta = json.loads(decrypted)
                    file_name = meta.get("file_name") or "file"
                    file_mime = meta.get("file_mime") or "application/octet-stream"
                    file_b64 = meta.get("file_b64")
                    plaintext = f"[文件] {file_name}"
                else:
                    plaintext = decrypted
            except Exception:
                plaintext = "[解密失败]"
        partner_id = with_user_id if row.sender_user_id == current_user.id else row.sender_user_id
        items.append(
            MessageItem(
                id=row.id,
                conversation_id=row.conversation_id,
                from_user_id=row.sender_user_id,
                to_user_id=partner_id,
                message_type=message_type,
                plaintext=plaintext,
                file_name=file_name,
                file_mime=file_mime,
                file_b64=file_b64,
                created_at=row.created_at,
            )
        )
    return P2PHistoryResponse(items=items)


@router.get("/conversations/mine")
def list_my_conversations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Conversation)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .filter(ConversationMember.user_id == current_user.id, ConversationMember.status == "active")
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    items = []
    for c in rows:
        member_ids = [
            m.user_id
            for m in db.query(ConversationMember)
            .filter(ConversationMember.conversation_id == c.id, ConversationMember.status == "active")
            .all()
        ]
        items.append(
            {
                "conversation_id": c.id,
                "type": c.type,
                "name": c.name,
                "current_key_epoch": c.current_key_epoch,
                "qke_status": c.qke_status,
                "member_ids": member_ids,
            }
        )
    return {"items": items}


@router.post("/messages/group", response_model=MessageItem)
def send_group_message(
    payload: GroupMessageSendRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = db.query(Conversation).filter(
        Conversation.id == payload.conversation_id,
        Conversation.type == "group",
        Conversation.status == "active",
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="group_conversation_not_found")

    if not _is_member(db, conversation.id, current_user.id):
        raise HTTPException(status_code=403, detail="not_a_group_member")

    epoch_no = conversation.current_key_epoch or 0
    if epoch_no <= 0:
        raise HTTPException(status_code=409, detail="no_active_key_epoch")

    key_material = (
        db.query(ConversationKeyMaterial)
        .filter(
            ConversationKeyMaterial.conversation_id == conversation.id,
            ConversationKeyMaterial.epoch_no == epoch_no,
        )
        .first()
    )
    if not key_material:
        raise HTTPException(status_code=409, detail="missing_epoch_key_material")

    key = base64.b64decode(key_material.key_material_b64.encode("utf-8"))
    aad = f"conv:{conversation.id}|epoch:{epoch_no}|type:text"
    ciphertext, nonce = security_service.encrypt_message_aesgcm(key, payload.text, aad=aad)

    seq = (
        db.query(func.max(Message.message_seq))
        .filter(Message.conversation_id == conversation.id)
        .scalar()
        or 0
    ) + 1

    msg = Message(
        conversation_id=conversation.id,
        sender_user_id=current_user.id,
        message_type="text",
        plaintext_digest=hashlib.sha256(payload.text.encode("utf-8")).hexdigest()[:16],
        ciphertext=ciphertext,
        nonce=nonce,
        aad=aad,
        encryption_alg="AES-GCM",
        key_epoch=epoch_no,
        message_seq=seq,
        send_status="sent",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(msg)
    conversation.last_message_at = datetime.utcnow()
    conversation.updated_at = datetime.utcnow()

    latest_qke = (
        db.query(QKESession)
        .filter(QKESession.conversation_id == conversation.id)
        .order_by(QKESession.id.desc())
        .first()
    )
    if latest_qke:
        add_qke_event(
            db,
            qke_session_id=latest_qke.id,
            conversation_id=conversation.id,
            event_type="message_encrypted",
            event_stage="transport",
            title="群消息已完成加密并入库",
            detail={"message_seq": seq, "algorithm": "AES-GCM", "epoch_no": epoch_no},
        )
        add_qke_event(
            db,
            qke_session_id=latest_qke.id,
            conversation_id=conversation.id,
            event_type="message_delivered",
            event_stage="transport",
            title="群消息已投递",
            detail={"message_seq": seq},
        )

    db.commit()
    db.refresh(msg)

    # 获取群内其他成员ID用于广播通知
    member_ids = [
        m.user_id
        for m in db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation.id,
            ConversationMember.status == "active",
            ConversationMember.user_id != current_user.id,
        )
        .all()
    ]

    # 通过 WebSocket 广播群消息通知
    for recipient_id in member_ids:
        background_tasks.add_task(
            _broadcast_p2p_message_notification,
            conversation_id=conversation.id,
            message_id=msg.id,
            sender_id=current_user.id,
            recipient_id=recipient_id,
            content=payload.text,
        )

    # to_user_id 暂设为 0 表示群消息
    return MessageItem(
        id=msg.id,
        conversation_id=conversation.id,
        from_user_id=current_user.id,
        to_user_id=0,
        message_type=msg.message_type,
        plaintext=payload.text,
        created_at=msg.created_at,
    )


@router.post("/messages/group/file", response_model=MessageItem)
async def send_group_file(
    background_tasks: BackgroundTasks,
    conversation_id: int = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.type == "group",
        Conversation.status == "active",
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="group_conversation_not_found")

    if not _is_member(db, conversation.id, current_user.id):
        raise HTTPException(status_code=403, detail="not_a_group_member")

    epoch_no = conversation.current_key_epoch or 0
    if epoch_no <= 0:
        raise HTTPException(status_code=409, detail="no_active_key_epoch")

    key_material = (
        db.query(ConversationKeyMaterial)
        .filter(
            ConversationKeyMaterial.conversation_id == conversation.id,
            ConversationKeyMaterial.epoch_no == epoch_no,
        )
        .first()
    )
    if not key_material:
        raise HTTPException(status_code=409, detail="missing_epoch_key_material")

    raw_bytes = await file.read()
    max_bytes = 1024 * 1024  # 1MB limit
    if len(raw_bytes) > max_bytes:
        raise HTTPException(status_code=413, detail="file_too_large")

    file_name = (file.filename or "").strip() or "file"
    file_mime = (file.content_type or "").strip() or "application/octet-stream"

    payload_json = json.dumps(
        {
            "file_name": file_name,
            "file_mime": file_mime,
            "file_b64": base64.b64encode(raw_bytes).decode("utf-8"),
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )

    key = base64.b64decode(key_material.key_material_b64.encode("utf-8"))
    aad = f"conv:{conversation.id}|epoch:{epoch_no}|type:file"
    ciphertext, nonce = security_service.encrypt_message_aesgcm(key, payload_json, aad=aad)

    seq = (
        db.query(func.max(Message.message_seq))
        .filter(Message.conversation_id == conversation.id)
        .scalar()
        or 0
    ) + 1

    msg = Message(
        conversation_id=conversation.id,
        sender_user_id=current_user.id,
        message_type="file",
        plaintext_digest=hashlib.sha256(raw_bytes).hexdigest()[:16],
        ciphertext=ciphertext,
        nonce=nonce,
        aad=aad,
        encryption_alg="AES-GCM",
        key_epoch=epoch_no,
        message_seq=seq,
        send_status="sent",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(msg)
    conversation.last_message_at = datetime.utcnow()
    conversation.updated_at = datetime.utcnow()

    latest_qke = (
        db.query(QKESession)
        .filter(QKESession.conversation_id == conversation.id)
        .order_by(QKESession.id.desc())
        .first()
    )
    if latest_qke:
        add_qke_event(
            db,
            qke_session_id=latest_qke.id,
            conversation_id=conversation.id,
            event_type="file_encrypted",
            event_stage="transport",
            title="群文件已完成加密并入库",
            detail={"message_seq": seq, "algorithm": "AES-GCM", "epoch_no": epoch_no, "file_name": file_name},
        )
        add_qke_event(
            db,
            qke_session_id=latest_qke.id,
            conversation_id=conversation.id,
            event_type="file_delivered",
            event_stage="transport",
            title="群文件已投递",
            detail={"message_seq": seq, "file_name": file_name},
        )

    db.commit()
    db.refresh(msg)

    # WebSocket 广播群文件通知
    member_ids = [
        m.user_id
        for m in db.query(ConversationMember)
        .filter(
            ConversationMember.conversation_id == conversation.id,
            ConversationMember.status == "active",
            ConversationMember.user_id != current_user.id,
        )
        .all()
    ]
    for recipient_id in member_ids:
        background_tasks.add_task(
            _broadcast_p2p_message_notification,
            conversation_id=conversation.id,
            message_id=msg.id,
            sender_id=current_user.id,
            recipient_id=recipient_id,
            content=f"[文件] {file_name}",
        )

    return MessageItem(
        id=msg.id,
        conversation_id=conversation.id,
        from_user_id=current_user.id,
        to_user_id=0,
        message_type=msg.message_type,
        plaintext=f"[文件] {file_name}",
        file_name=file_name,
        file_mime=file_mime,
        file_b64=base64.b64encode(raw_bytes).decode("utf-8"),
        created_at=msg.created_at,
    )


@router.get("/messages/group/history", response_model=P2PHistoryResponse)
def get_group_history(
    conversation_id: int,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.type == "group",
        Conversation.status == "active",
    ).first()
    if not conversation:
        return P2PHistoryResponse(items=[])

    if not _is_member(db, conversation.id, current_user.id):
        raise HTTPException(status_code=403, detail="not_a_group_member")

    rows = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.message_seq.asc())
        .limit(max(1, min(limit, 500)))
        .all()
    )

    key_material_rows = (
        db.query(ConversationKeyMaterial)
        .filter(ConversationKeyMaterial.conversation_id == conversation.id)
        .all()
    )
    key_map = {
        km.epoch_no: base64.b64decode(km.key_material_b64.encode("utf-8"))
        for km in key_material_rows
    }

    items: list[MessageItem] = []
    for row in rows:
        key = key_map.get(row.key_epoch)
        plaintext = "[解密失败]"
        message_type = row.message_type or "text"
        file_name = None
        file_mime = None
        file_b64 = None
        if key:
            try:
                decrypted = security_service.decrypt_message_aesgcm(key, row.ciphertext, row.nonce, aad=row.aad or "")
                if message_type == "file":
                    meta = json.loads(decrypted)
                    file_name = meta.get("file_name") or "file"
                    file_mime = meta.get("file_mime") or "application/octet-stream"
                    file_b64 = meta.get("file_b64")
                    plaintext = f"[文件] {file_name}"
                else:
                    plaintext = decrypted
            except Exception:
                plaintext = "[解密失败]"
        sender_id = row.sender_user_id or 0
        items.append(
            MessageItem(
                id=row.id,
                conversation_id=row.conversation_id,
                from_user_id=sender_id,
                to_user_id=0,
                message_type=message_type,
                plaintext=plaintext,
                file_name=file_name,
                file_mime=file_mime,
                file_b64=file_b64,
                created_at=row.created_at,
            )
        )
    return P2PHistoryResponse(items=items)
