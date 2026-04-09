from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models import get_db
from app.models.models import Session as LegacySession, Participant as LegacyParticipant
from app.models.v1_models import (
    Conversation,
    ConversationMember,
    Department,
    KeyEpoch,
    QKESession,
    QKESessionMember,
    SecurityAlert,
    User,
    UserDevice,
)
from app.schemas.dashboard import (
    Page1SummaryResponse,
    Page1TopologyResponse,
    Page1UsersResponse,
    Page1UserDetailResponse,
)

router = APIRouter()


def _sha256_short(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:8]


def _ensure_demo_data(db: Session) -> None:
    """当新业务表为空时，从 legacy session 生成一份最小 demo 数据。"""
    if db.query(User).first():
        return

    # 部门
    dep = Department(name="研发部", code="RD", status="active")
    db.add(dep)
    db.flush()

    # 取一条 legacy session 作为 demo 数据源
    legacy = db.query(LegacySession).order_by(LegacySession.created_at.desc()).first()
    if not legacy:
        # 没有 legacy，就生成空壳用户
        for i in range(1, 6):
            u = User(
                username=f"user{i}",
                password_hash=_sha256_short("password"),
                real_name=f"用户{i}",
                department_id=dep.id,
                online_status="offline",
                status="active",
            )
            db.add(u)
        db.commit()
        return

    # 用户与设备：用 legacy participants 映射
    lps = db.query(LegacyParticipant).filter(LegacyParticipant.session_id == legacy.id).all()
    users: list[User] = []
    for p in lps:
        u = User(
            username=f"p{p.participant_id}",
            password_hash=_sha256_short("password"),
            real_name=p.original_id or f"P{p.participant_id}",
            department_id=dep.id,
            online_status="online",
            last_seen_at=datetime.utcnow(),
            last_login_at=datetime.utcnow() - timedelta(hours=1),
            status="active",
        )
        db.add(u)
        users.append(u)
    db.flush()

    for u in users:
        db.add(
            UserDevice(
                user_id=u.id,
                device_id=f"dev-{u.id}",
                device_name="Web-Chrome",
                device_type="web",
                os_name="Windows",
                browser_name="Chrome",
                ip_address="127.0.0.1",
                trust_level="normal",
                last_active_at=datetime.utcnow(),
            )
        )

    # 对话（群聊）
    conv = Conversation(
        conversation_no=f"conv-{legacy.id[:8]}",
        type="group",
        name="安全项目群",
        owner_user_id=users[0].id if users else None,
        secure_mode="qke",
        current_key_epoch=0,
        qke_status="idle",
        member_count=len(users),
        status="active",
    )
    db.add(conv)
    db.flush()

    for u in users:
        db.add(
            ConversationMember(
                conversation_id=conv.id,
                user_id=u.id,
                member_role="member",
                status="active",
            )
        )

    # QKE session（映射 legacy session 统计）
    qke = QKESession(
        session_no=f"qke-{legacy.id[:8]}",
        conversation_id=conv.id,
        trigger_type="initial",
        scene_type="demo",
        participant_count=len(users),
        leader_count=max(1, min(2, len(users))),
        key_length=legacy.key_length or 128,
        decoy_count=legacy.decoy_count or 16,
        status="active" if legacy.status == "completed" else "running",
        start_time=legacy.created_at or datetime.utcnow(),
        end_time=legacy.completed_at,
        latency_ms=int((legacy.latency or 0) * 1000) if legacy.latency is not None else None,
        entropy=None,
        qber=None,
        key_rate=legacy.key_rate,
        quantum_cost=legacy.quantum_cost or 0,
        classical_cost=legacy.classical_cost or 0,
        pauli_ops=legacy.pauli_ops or 0,
        total_quantum_ops=legacy.total_quantum_ops or 0,
        bit_flips=legacy.bit_flips or 0,
    )
    db.add(qke)
    db.flush()

    # qke members（从 legacy participant 类型映射）
    for idx, (u, p) in enumerate(zip(users, lps), start=1):
        logical_role = "leader" if p.is_leader else "follower"
        # 恶意节点模型已移除，所有参与者均为正常角色
        threat_role = "normal"
        db.add(
            QKESessionMember(
                qke_session_id=qke.id,
                user_id=u.id,
                logical_role=logical_role,
                threat_role=threat_role,
                participant_order=idx,
                private_key_digest=_sha256_short(p.private_key or ""),
                shared_key_digest=_sha256_short(p.shared_key or "") if p.shared_key else None,
                status="synced" if legacy.status == "completed" else "running",
            )
        )

    # key epoch
    epoch = KeyEpoch(
        conversation_id=conv.id,
        qke_session_id=qke.id,
        epoch_no=1,
        key_fingerprint=_sha256_short(legacy.final_key or "final_key"),
        key_length=legacy.key_length or 128,
        entropy=None,
        qber=None,
        status="active",
    )
    db.add(epoch)
    conv.current_key_epoch = 1
    conv.qke_status = "active"

    # 恶意节点模型已移除，不再生成恶意节点检测告警

    db.commit()


@router.get("/summary", response_model=Page1SummaryResponse)
async def page1_summary(db: Session = Depends(get_db)):
    _ensure_demo_data(db)

    online_users = db.query(User).filter(User.online_status == "online").count()
    offline_users = db.query(User).filter(User.online_status != "online").count()
    negotiating_conversations = db.query(Conversation).filter(Conversation.qke_status == "negotiating").count()
    active_secure_conversations = db.query(Conversation).filter(Conversation.qke_status == "active").count()
    open_alerts = db.query(SecurityAlert).filter(SecurityAlert.status == "open").count()

    # 近似指标（无 metric_snapshots 时先从 qke_sessions 聚合）
    sessions = db.query(QKESession).all()
    avg_entropy = float(sum((s.entropy or 0) for s in sessions) / len(sessions)) if sessions else 0.0
    avg_latency_ms = int(sum((s.latency_ms or 0) for s in sessions) / len(sessions)) if sessions else 0

    return Page1SummaryResponse(
        online_users=online_users,
        offline_users=offline_users,
        negotiating_conversations=negotiating_conversations,
        active_secure_conversations=active_secure_conversations,
        today_rekey_count=0,
        open_alerts=open_alerts,
        avg_entropy=avg_entropy,
        avg_negotiation_latency_ms=avg_latency_ms,
    )


@router.get("/users", response_model=Page1UsersResponse)
async def page1_users(
    page: int = 1,
    page_size: int = 20,
    department_id: Optional[int] = None,
    online_status: Optional[str] = None,
    qke_status: Optional[str] = None,
    keyword: Optional[str] = None,
    risk_level: Optional[str] = None,
    db: Session = Depends(get_db),
):
    _ensure_demo_data(db)
    q = db.query(User)
    if department_id:
        q = q.filter(User.department_id == department_id)
    if online_status:
        q = q.filter(User.online_status == online_status)
    if keyword:
        q = q.filter((User.real_name.contains(keyword)) | (User.username.contains(keyword)))
    total = q.count()
    users = q.order_by(User.id).offset((page - 1) * page_size).limit(page_size).all()

    # 关联：当前会话/epoch/status（先用该用户参与的第一条会话）
    items = []
    for u in users:
        dep_name = None
        if u.department_id:
            dep = db.query(Department).filter(Department.id == u.department_id).first()
            dep_name = dep.name if dep else None

        member = (
            db.query(ConversationMember, Conversation)
            .join(Conversation, ConversationMember.conversation_id == Conversation.id)
            .filter(ConversationMember.user_id == u.id)
            .first()
        )
        conv_ref = None
        key_epoch = 0
        latest_qke_status = "idle"
        latest_time = None
        if member:
            conv = member[1]
            conv_ref = {"id": conv.id, "name": conv.name or f"Conversation {conv.id}"}
            key_epoch = conv.current_key_epoch or 0
            latest_qke_status = conv.qke_status or "idle"
            # 最近协商：取 qke_sessions 最近一条
            qkes = (
                db.query(QKESession)
                .filter(QKESession.conversation_id == conv.id)
                .order_by(QKESession.start_time.desc())
                .first()
            )
            latest_time = qkes.start_time.isoformat() if qkes and qkes.start_time else None

        device = db.query(UserDevice).filter(UserDevice.user_id == u.id).order_by(UserDevice.last_active_at.desc()).first()
        current_device = device.device_name if device else None

        items.append(
            {
                "user_id": u.id,
                "username": u.username,
                "real_name": u.real_name,
                "department": dep_name,
                "online_status": u.online_status,
                "current_device": current_device,
                "current_conversation": conv_ref,
                "current_key_epoch": key_epoch,
                "latest_qke_status": latest_qke_status,
                "latest_negotiation_time": latest_time,
                "risk_tags": [] if not risk_level else ["watch"],
                "last_seen_at": u.last_seen_at.isoformat() if u.last_seen_at else None,
            }
        )

    return Page1UsersResponse(total=total, items=items)


@router.get("/topology", response_model=Page1TopologyResponse)
async def page1_topology(conversation_id: int, db: Session = Depends(get_db)):
    _ensure_demo_data(db)
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="conversation not found")

    # 取最近一条 qke session
    qke = (
        db.query(QKESession)
        .filter(QKESession.conversation_id == conv.id)
        .order_by(QKESession.start_time.desc())
        .first()
    )

    # 节点：按 qke_session_members
    nodes = []
    edges = []
    if qke:
        members = db.query(QKESessionMember).filter(QKESessionMember.qke_session_id == qke.id).all()
        for m in members:
            u = db.query(User).filter(User.id == m.user_id).first()
            nodes.append(
                {
                    "user_id": m.user_id,
                    "label": u.real_name if u else f"U{m.user_id}",
                    "logical_role": m.logical_role,
                    "threat_role": m.threat_role,
                    "online_status": (u.online_status if u else "offline"),
                    "risk_score": 0.12,  # 恶意节点模型已移除，所有参与者均为正常角色
                }
            )
        # 边：leader 与其他人连线
        leaders = [m.user_id for m in members if m.logical_role == "leader"]
        followers = [m.user_id for m in members if m.logical_role != "leader"]
        for i, f in enumerate(followers):
            if leaders:
                edges.append({"source": leaders[i % len(leaders)], "target": f, "relation": "qke_exchange", "status": conv.qke_status})

    return Page1TopologyResponse(
        conversation={"id": conv.id, "name": conv.name or "", "type": conv.type},
        nodes=nodes,
        edges=edges,
    )


@router.get("/users/{user_id}/detail", response_model=Page1UserDetailResponse)
async def page1_user_detail(user_id: int, db: Session = Depends(get_db)):
    _ensure_demo_data(db)
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="user not found")

    dep_name = None
    if u.department_id:
        dep = db.query(Department).filter(Department.id == u.department_id).first()
        dep_name = dep.name if dep else None

    devices = db.query(UserDevice).filter(UserDevice.user_id == u.id).order_by(UserDevice.last_active_at.desc()).limit(5).all()
    dev_items = [
        {"device_name": d.device_name or "Unknown", "trust_level": d.trust_level, "last_active_at": d.last_active_at.isoformat() if d.last_active_at else None}
        for d in devices
    ]

    # recent conversations
    convs = (
        db.query(Conversation)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .filter(ConversationMember.user_id == u.id)
        .order_by(Conversation.last_message_at.desc().nullslast(), Conversation.id.desc())
        .limit(5)
        .all()
    )
    conv_items = [
        {
            "conversation_id": c.id,
            "conversation_name": c.name or "",
            "qke_status": c.qke_status,
            "key_epoch": c.current_key_epoch or 0,
        }
        for c in convs
    ]

    qkes = (
        db.query(QKESession)
        .join(Conversation, Conversation.id == QKESession.conversation_id)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .filter(ConversationMember.user_id == u.id)
        .order_by(QKESession.start_time.desc())
        .limit(5)
        .all()
    )
    qke_items = [{"qke_session_id": s.id, "status": s.status, "entropy": s.entropy, "qber": s.qber} for s in qkes]

    return Page1UserDetailResponse(
        user={
            "id": u.id,
            "real_name": u.real_name,
            "department": dep_name,
            "online_status": u.online_status,
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        },
        devices=dev_items,
        recent_conversations=conv_items,
        recent_qke_sessions=qke_items,
    )


@router.post("/users/{user_id}/force-rekey")
async def page1_force_rekey(user_id: int, db: Session = Depends(get_db)):
    _ensure_demo_data(db)
    # V1：仅返回成功（后续接入 qke_orchestrator 触发 rekey）
    return {"status": "ok"}


@router.post("/users/{user_id}/mark-watch")
async def page1_mark_watch(user_id: int, db: Session = Depends(get_db)):
    _ensure_demo_data(db)
    return {"status": "ok"}

