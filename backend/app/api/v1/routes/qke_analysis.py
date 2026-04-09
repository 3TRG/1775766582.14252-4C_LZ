from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models import get_db
from app.models.models import (
    QKDRound as LegacyRound,
    QKEEvent as LegacyEvent,
    Participant as LegacyParticipant,
    Session as LegacySession,
)
from app.models.v1_models import (
    Conversation,
    KeyEpoch,
    QKEEvent,
    QKERound,
    QKESession,
    QKESessionMember,
    User,
)
from app.schemas.qke_analysis import (
    Page2EventsResponse,
    Page2KeyStreamResponse,
    Page2OverviewResponse,
    Page2ParticipantsResponse,
    Page2RoundDetail,
    Page2SessionsResponse,
)

router = APIRouter()


def _sha256_short(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:8]


def _ensure_demo_qke_session(db: Session) -> QKESession:
    """确保存在一条 qke_session（若为空则从 legacy session 映射）。"""
    qke = db.query(QKESession).order_by(QKESession.start_time.desc()).first()
    if qke:
        return qke

    # 需要先有 User/Conversation：直接复用 page1 的 demo 生成逻辑（复制最小逻辑）
    if not db.query(User).first():
        from .dashboard import _ensure_demo_data  # local import to avoid circular at import time
        _ensure_demo_data(db)

    qke = db.query(QKESession).order_by(QKESession.start_time.desc()).first()
    if qke:
        return qke

    # 极端情况：没有 legacy session，也没有 demo qke，则造一个空 qke
    conv = db.query(Conversation).first()
    if not conv:
        conv = Conversation(conversation_no="conv-1", type="group", name="默认群", secure_mode="qke")
        db.add(conv)
        db.flush()
    qke = QKESession(
        session_no="qke-1",
        conversation_id=conv.id,
        trigger_type="initial",
        scene_type="demo",
        participant_count=0,
        leader_count=0,
        key_length=128,
        decoy_count=16,
        status="created",
        start_time=datetime.utcnow(),
    )
    db.add(qke)
    db.commit()
    return qke


def _sync_legacy_into_v1(db: Session, qke: QKESession) -> None:
    """将 legacy 的 rounds/events 补到 v1 表（仅 demo 用，尽量幂等）。"""
    legacy = db.query(LegacySession).order_by(LegacySession.created_at.desc()).first()
    if not legacy:
        return

    # 如果 v1 rounds 已经存在则不重复写
    if db.query(QKERound).filter(QKERound.qke_session_id == qke.id).first():
        return

    # rounds
    l_rounds = (
        db.query(LegacyRound)
        .filter(LegacyRound.session_id == legacy.id)
        .order_by(LegacyRound.round_number)
        .all()
    )
    for r in l_rounds:
        db.add(
            QKERound(
                qke_session_id=qke.id,
                round_number=r.round_number,
                group_type=r.group_type,
                state_type=r.state_type,
                leader_user_id=None,
                participant_ids_json=None,
                qasm_text=None,
                circuit_diagram_url=r.circuit_diagram,
                qubits_used=r.qubits_used or 0,
                decoy_positions_json=r.decoy_positions,
                decoy_bases_json=r.decoy_bases,
                decoy_states_json=r.decoy_states,
                decoy_error_rate=r.decoy_error_rate,
                diff_positions_json=r.key_diff_positions,
                total_bit_flips=r.bit_flips_count or 0,
                round_latency_ms=None,
                round_status="success",
                started_at=r.created_at or datetime.utcnow(),
                finished_at=None,
            )
        )

    # events（从 legacy events 或生成）
    conv = db.query(Conversation).filter(Conversation.id == qke.conversation_id).first()
    conv_id = conv.id if conv else 1
    l_events = (
        db.query(LegacyEvent)
        .filter(LegacyEvent.session_id == legacy.id)
        .order_by(LegacyEvent.seq)
        .all()
    )
    if l_events:
        for e in l_events:
            # 粗略 stage 映射
            stage = "created"
            if e.event_type in ("election", "assign_role"):
                stage = "assign_role"
            elif e.event_type in ("qka", "qkd"):
                stage = "quantum_exchange"
            elif e.event_type in ("measurement",):
                stage = "measure"
            elif e.event_type in ("sync",):
                stage = "reconcile"
            elif e.event_type in ("verify",):
                stage = "verify"
            elif e.event_type in ("stats",):
                stage = "activate"

            db.add(
                QKEEvent(
                    qke_session_id=qke.id,
                    conversation_id=conv_id,
                    round_number=None,
                    event_type=e.event_type,
                    actor_user_id=None,
                    event_stage=stage,
                    severity="info",
                    title=e.summary or e.event_type,
                    detail_json=e.details_json,
                    event_time=e.timestamp or datetime.utcnow(),
                )
            )
    db.commit()


@router.get("/sessions", response_model=Page2SessionsResponse)
async def page2_sessions(
    status: Optional[str] = None,
    scene_type: Optional[str] = None,
    conversation_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    qke = _ensure_demo_qke_session(db)
    _sync_legacy_into_v1(db, qke)

    q = db.query(QKESession)
    if status:
        q = q.filter(QKESession.status == status)
    if scene_type:
        q = q.filter(QKESession.scene_type == scene_type)
    if conversation_id:
        q = q.filter(QKESession.conversation_id == conversation_id)

    total = q.count()
    sessions = q.order_by(QKESession.start_time.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for s in sessions:
        conv = db.query(Conversation).filter(Conversation.id == s.conversation_id).first()
        items.append(
            {
                "qke_session_id": s.id,
                "conversation_id": s.conversation_id,
                "conversation_name": (conv.name if conv else ""),
                "scene_type": s.scene_type,
                "status": s.status,
                "participant_count": s.participant_count,
                "trigger_type": s.trigger_type,
                "start_time": s.start_time.isoformat() if s.start_time else datetime.utcnow().isoformat(),
            }
        )

    return Page2SessionsResponse(total=total, items=items)


@router.get("/sessions/{qke_session_id}/overview", response_model=Page2OverviewResponse)
async def page2_overview(qke_session_id: int, db: Session = Depends(get_db)):
    qke = db.query(QKESession).filter(QKESession.id == qke_session_id).first()
    if not qke:
        raise HTTPException(status_code=404, detail="qke_session not found")
    conv = db.query(Conversation).filter(Conversation.id == qke.conversation_id).first()

    # current round/stage：取最新 event
    last_ev = (
        db.query(QKEEvent)
        .filter(QKEEvent.qke_session_id == qke.id)
        .order_by(QKEEvent.event_time.desc())
        .first()
    )
    current_stage = last_ev.event_stage if last_ev else "created"
    current_round = last_ev.round_number or 0 if last_ev else 0
    if current_round == 0:
        last_round = (
            db.query(QKERound)
            .filter(QKERound.qke_session_id == qke.id)
            .order_by(QKERound.round_number.desc())
            .first()
        )
        current_round = last_round.round_number if last_round else 1

    return Page2OverviewResponse(
        qke_session_id=qke.id,
        conversation={
            "id": conv.id if conv else qke.conversation_id,
            "name": conv.name if conv else "",
            "type": conv.type if conv else "group",
        },
        status=qke.status,
        protocol_name=qke.protocol_name,
        protocol_version=qke.protocol_version,
        participant_count=qke.participant_count,
        leader_count=qke.leader_count,
        current_round=current_round,
        current_stage=current_stage,
        key_length=qke.key_length,
        decoy_count=qke.decoy_count,
        start_time=qke.start_time.isoformat() if qke.start_time else datetime.utcnow().isoformat(),
    )


@router.get("/sessions/{qke_session_id}/participants", response_model=Page2ParticipantsResponse)
async def page2_participants(qke_session_id: int, db: Session = Depends(get_db)):
    qke = db.query(QKESession).filter(QKESession.id == qke_session_id).first()
    if not qke:
        raise HTTPException(status_code=404, detail="qke_session not found")
    members = (
        db.query(QKESessionMember)
        .filter(QKESessionMember.qke_session_id == qke.id)
        .order_by(QKESessionMember.participant_order.asc().nullslast(), QKESessionMember.id.asc())
        .all()
    )
    items = []
    for m in members:
        u = db.query(User).filter(User.id == m.user_id).first()
        items.append(
            {
                "user_id": m.user_id,
                "real_name": u.real_name if u else f"U{m.user_id}",
                "logical_role": m.logical_role,
                "threat_role": m.threat_role,
                "participant_order": m.participant_order or 0,
                "private_key_digest": (m.private_key_digest[:8] if m.private_key_digest else None),
                "shared_key_digest": (m.shared_key_digest[:8] if m.shared_key_digest else None),
                "status": m.status,
                "current_round_status": "completed" if m.status in ("synced", "completed") else "pending",
                "error_contribution": 0.01,  # 恶意节点模型已移除，所有参与者均为正常角色
            }
        )
    return Page2ParticipantsResponse(items=items)


@router.get("/sessions/{qke_session_id}/events", response_model=Page2EventsResponse)
async def page2_events(
    qke_session_id: int,
    round_number: Optional[int] = None,
    limit: int = 100,
    cursor: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(QKEEvent).filter(QKEEvent.qke_session_id == qke_session_id).order_by(QKEEvent.event_time.asc(), QKEEvent.id.asc())
    if round_number is not None:
        q = q.filter(QKEEvent.round_number == round_number)
    events = q.limit(limit).all()

    items = []
    for e in events:
        detail = json.loads(e.detail_json) if e.detail_json else {}
        items.append(
            {
                "id": e.id,
                "event_time": e.event_time.isoformat() if e.event_time else datetime.utcnow().isoformat(),
                "round_number": e.round_number,
                "event_stage": e.event_stage,
                "event_type": e.event_type,
                "severity": e.severity,
                "title": e.title or e.event_type,
                "detail": detail,
            }
        )
    return Page2EventsResponse(items=items, next_cursor=None)


@router.get("/sessions/{qke_session_id}/rounds", response_model=list[Page2RoundDetail])
async def page2_rounds(qke_session_id: int, db: Session = Depends(get_db)):
    rounds = (
        db.query(QKERound)
        .filter(QKERound.qke_session_id == qke_session_id)
        .order_by(QKERound.round_number.asc())
        .all()
    )
    out = []
    for r in rounds:
        out.append(
            Page2RoundDetail(
                round_number=r.round_number,
                group_type=r.group_type or "",
                state_type=r.state_type or "",
                leader_user_id=r.leader_user_id,
                participants=json.loads(r.participant_ids_json) if r.participant_ids_json else [],
                qasm_text=r.qasm_text,
                circuit_diagram_url=r.circuit_diagram_url,
                qubits_used=r.qubits_used or 0,
                decoy_info={
                    "positions": json.loads(r.decoy_positions_json) if r.decoy_positions_json else [],
                    "bases": json.loads(r.decoy_bases_json) if r.decoy_bases_json else [],
                    "states": json.loads(r.decoy_states_json) if r.decoy_states_json else [],
                    "count": len(json.loads(r.decoy_positions_json)) if r.decoy_positions_json else 0,
                }
                if r.decoy_positions_json
                else None,
                key_synchronization={
                    "diff_positions": json.loads(r.diff_positions_json) if r.diff_positions_json else [],
                    "total_bit_flips": r.total_bit_flips or 0,
                }
                if r.diff_positions_json
                else None,
                round_latency_ms=r.round_latency_ms,
                round_status=r.round_status or "success",
            )
        )
    return out


@router.get("/sessions/{qke_session_id}/rounds/{round_number}", response_model=Page2RoundDetail)
async def page2_round_detail(qke_session_id: int, round_number: int, db: Session = Depends(get_db)):
    r = (
        db.query(QKERound)
        .filter(QKERound.qke_session_id == qke_session_id, QKERound.round_number == round_number)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="round not found")
    return Page2RoundDetail(
        round_number=r.round_number,
        group_type=r.group_type or "",
        state_type=r.state_type or "",
        leader_user_id=r.leader_user_id,
        participants=json.loads(r.participant_ids_json) if r.participant_ids_json else [],
        qasm_text=r.qasm_text,
        circuit_diagram_url=r.circuit_diagram_url,
        qubits_used=r.qubits_used or 0,
        decoy_info={
            "positions": json.loads(r.decoy_positions_json) if r.decoy_positions_json else [],
            "bases": json.loads(r.decoy_bases_json) if r.decoy_bases_json else [],
            "states": json.loads(r.decoy_states_json) if r.decoy_states_json else [],
            "count": len(json.loads(r.decoy_positions_json)) if r.decoy_positions_json else 0,
        }
        if r.decoy_positions_json
        else None,
        key_synchronization={
            "diff_positions": json.loads(r.diff_positions_json) if r.diff_positions_json else [],
            "total_bit_flips": r.total_bit_flips or 0,
        }
        if r.diff_positions_json
        else None,
        round_latency_ms=r.round_latency_ms,
        round_status=r.round_status or "success",
    )


@router.get("/sessions/{qke_session_id}/key-stream", response_model=Page2KeyStreamResponse)
async def page2_key_stream(qke_session_id: int, db: Session = Depends(get_db)):
    qke = db.query(QKESession).filter(QKESession.id == qke_session_id).first()
    if not qke:
        raise HTTPException(status_code=404, detail="qke_session not found")
    epoch = (
        db.query(KeyEpoch)
        .filter(KeyEpoch.qke_session_id == qke.id)
        .order_by(KeyEpoch.epoch_no.desc())
        .first()
    )
    epoch_no = epoch.epoch_no if epoch else 0
    key_length = epoch.key_length if epoch else qke.key_length
    fp = epoch.key_fingerprint if epoch else _sha256_short(qke.session_no)
    preview_bits = (fp * 16)[:16] + "...."
    return Page2KeyStreamResponse(
        epoch_no=epoch_no,
        key_length=key_length,
        preview_bits=preview_bits,
        entropy=epoch.entropy if epoch else qke.entropy,
        qber=epoch.qber if epoch else qke.qber,
        privacy_amplification_ratio=0.75,
        status="pending" if qke.status in ("running", "preparing") else "active",
    )

