from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
import json
from datetime import datetime

from app.models import get_db
from app.models.models import Session as SessionModel, Participant, QKDRound, QKEEvent
from app.schemas.schemas import (
    SessionCreate, SessionResponse, RunRequest, RunResponse,
    ParticipantsResponse, RoundsResponse, ParticipantResponse, RoundResponse,
    AdminSessionsResponse, AdminSessionListItem, AdminSessionSnapshotResponse, QKEEventResponse
)
from app.services.security_service import security_service
from app.services.qke_engine.qke_core import QKEProtocol

router = APIRouter()

# ============================================================
# 路由分层说明
# ============================================================
# 本文件同时包含两套 API，历史原因及演进路径如下：
#
# 1. Legacy 仿真接口（/api/session/*）
#    - 创建 session → 运行 QKE 协议 → 返回完整协议结果
#    - 主要用于管理员前端（admin-frontend）的 QKE 过程可视化
#    - 路径：/session/create, /session/{id}/run, /session/{id}/participants, /session/{id}/rounds
#    - 管理端快照：/admin/sessions, /admin/sessions/{id}/snapshot
#
# 2. V1 业务接口（/api/v1/*）
#    - 认证：/v1/auth/*          → 用户注册/登录
#    - 聊天：/v1/chat/*          → 即时通讯（用户前端）
#    - 管理：/v1/admin/qke/*     → QKE 会话列表/详情（管理端 admin sub-router）
#    - 管理：/v1/admin/users/*   → 用户管理
#    - 管理：/v1/admin/dashboard/* → 仪表盘（用户概览/拓扑/详情）
#    - 管理：/v1/admin/qke_analysis/* → QKE 分析（会话/轮次/事件/密钥流）
#    - 管理：/v1/admin/statistics/* → 统计分析（KPI/趋势/图表）
#
# legacy 接口在 V1 接口完善前保留，后续逐步迁移。
# ============================================================

from app.api.v1.router import router as v1_router  # type: ignore

router.include_router(v1_router)

def _add_event(db: Session, *, session_id: str, seq: int, event_type: str, level: int, summary: str, details: dict | None = None):
    e = QKEEvent(
        session_id=session_id,
        seq=seq,
        event_type=event_type,
        level=level,
        summary=summary,
        details_json=json.dumps(details or {}, ensure_ascii=False),
        timestamp=datetime.utcnow()
    )
    db.add(e)

@router.post("/session/create", response_model=SessionResponse, deprecated=True)
async def create_session(session_data: SessionCreate, db: Session = Depends(get_db)):
    """
    [已废弃] 创建量子密钥分发会话

    请使用 V1 API: POST /api/v1/admin/qke/sessions
    此接口将在下一版本中移除。
    """
    session_id = str(uuid.uuid4())
    
    db_session = SessionModel(
        id=session_id,
        total_participants=session_data.participants,
        key_length=session_data.key_length,
        decoy_count=session_data.decoy_count
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    
    return SessionResponse(
        session_id=session_id,
        status='created',
        config={
            'participants': session_data.participants,
            'key_length': session_data.key_length,
            'decoy_count': session_data.decoy_count
        }
    )

@router.post("/session/{session_id}/run", response_model=RunResponse)
async def run_protocol(session_id: str, run_data: RunRequest, db: Session = Depends(get_db)):
    """运行量子密钥分发协议"""
    db_session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    protocol = QKEProtocol(
        num_participants=db_session.total_participants,
        m_value=db_session.key_length,
        decoy_count=db_session.decoy_count
    )
    
    participants = protocol.initialize_participants()

    # 管理端事件：初始化与选举
    seq = 1
    _add_event(db, session_id=session_id, seq=seq, event_type="system", level=1, summary="量子密钥分发系统初始化完成", details={
        "participants": len(participants),
        "keyLength": db_session.key_length,
        "decoyCount": db_session.decoy_count
    })
    seq += 1
    leaders = [p for p in participants if p.get("is_leader")]
    _add_event(db, session_id=session_id, seq=seq, event_type="election", level=2, summary=f"选出 {len(leaders)} 位领导者", details={
        "leaders": [{"id": p["id"]} for p in leaders]
    })
    seq += 1
    
    for p in participants:
        participant = Participant(
            session_id=session_id,
            participant_id=p['id'],
            original_id=f"P{p['id']}",
            is_leader=p['is_leader'],
            private_key=json.dumps(p['private_key']),
            joined_at=datetime.fromisoformat(p['joined_at']) if isinstance(p['joined_at'], str) else datetime.utcnow()
        )
        db.add(participant)
    
    db.commit()
    
    result = protocol.run_full_protocol()
    
    db_session.final_key = json.dumps(result['final_key'])
    db_session.key_rate = result['statistics'].get('key_rate', 0)
    db_session.latency = result['statistics']['latency']
    db_session.quantum_cost = result['statistics']['quantum_cost']
    db_session.pauli_ops = result['statistics']['pauli_ops']
    db_session.bit_flips = result['statistics']['bit_flips']
    db_session.total_quantum_ops = result['statistics']['total_quantum_ops']
    db_session.classical_cost = result['statistics']['classical_cost']
    db_session.status = 'completed'
    db_session.completed_at = datetime.utcnow()
    
    for round_data in result['rounds']:
        # 管理端事件：轮次开始/完成（最小可用：用仿真结果回放）
        round_num = round_data.get("round_number")
        is_qka = str(round_data.get("group_type", "")).startswith("QKA") or str(round_data.get("group_type", "")).startswith("QKA-")
        _add_event(db, session_id=session_id, seq=seq, event_type="qka" if is_qka else "qkd", level=2, summary=f"第 {round_num} 轮 {'QKA' if is_qka else 'QKD'} 开始", details={
            "round_number": round_num,
            "group_type": round_data.get("group_type"),
            "leader_id": round_data.get("leader_id"),
            "participants": round_data.get("participants", []),
            "state_type": round_data.get("state_type"),
            "qubits_used": round_data.get("qubits_used", 0),
        })
        seq += 1
        if round_data.get("key_synchronization"):
            _add_event(db, session_id=session_id, seq=seq, event_type="sync", level=3, summary="密钥同步", details=round_data.get("key_synchronization"))
            seq += 1
        _add_event(db, session_id=session_id, seq=seq, event_type="qka" if is_qka else "qkd", level=4, summary=f"第 {round_num} 轮完成", details={
            "round_number": round_num,
        })
        seq += 1

        qkd_round = QKDRound(
            session_id=session_id,
            round_number=round_data['round_number'],
            group_type=round_data['group_type'],
            leader_id=round_data.get('leader_id', 0) if isinstance(round_data.get('leader_id'), int) else 0,
            state_type=round_data['state_type'],
            circuit_diagram=round_data.get('circuit_img', '') or (round_data.get('circuits', [])[0].get('circuit_img', '') if round_data.get('circuits') else ''),
            qubits_used=round_data.get('qubits_used', 0),
            decoy_positions=json.dumps(round_data.get('decoy_info', {}).get('positions', [])),
            decoy_bases=json.dumps(round_data.get('decoy_info', {}).get('bases', [])),
            decoy_states=json.dumps(round_data.get('decoy_info', {}).get('states', [])),
            key_diff_positions=json.dumps(round_data.get('key_synchronization', {}).get('diff_positions', [])),
            bit_flips_count=round_data.get('key_synchronization', {}).get('total_bit_flips', 0)
        )
        db.add(qkd_round)
    
    for p in result['participants']:
        participant = db.query(Participant).filter(
            Participant.session_id == session_id,
            Participant.participant_id == p['id']
        ).first()
        if participant and p['shared_key']:
            participant.shared_key = json.dumps(p['shared_key'])
    
    db.commit()

    _add_event(db, session_id=session_id, seq=seq, event_type="stats", level=5, summary=f"最终密钥生成完成，长度 {len(result.get('final_key') or [])} 位", details={
        "keyLength": len(result.get("final_key") or []),
        "keyRate": result.get("statistics", {}).get("key_rate", 0),
        "latency": result.get("statistics", {}).get("latency", 0),
        "quantumCost": result.get("statistics", {}).get("quantum_cost", 0),
    })
    db.commit()
    
    # Sanitize result to avoid returning sensitive data (private_key, shared_key, final_key)
    sanitized_result = dict(result)
    sanitized_participants = []
    for p in result['participants']:
        safe_p = {k: v for k, v in p.items() if k not in ('private_key', 'shared_key')}
        safe_p['key_fingerprint'] = security_service.generate_key_fingerprint(
            json.dumps(p['shared_key']).encode()
        ) if p.get('shared_key') else None
        sanitized_participants.append(safe_p)
    sanitized_result['participants'] = sanitized_participants
    # Remove final_key from result - replace length-only placeholder
    if 'final_key' in sanitized_result:
        sanitized_result['final_key_length'] = len(sanitized_result.get('final_key') or [])
        sanitized_result['final_key'] = None

    return RunResponse(
        status='success',
        session_id=session_id,
        result=sanitized_result
    )

@router.get("/session/{session_id}/participants", response_model=ParticipantsResponse)
async def get_participants(session_id: str, db: Session = Depends(get_db)):
    """获取会话参与者信息"""
    participants = db.query(Participant).filter(Participant.session_id == session_id).all()
    
    return ParticipantsResponse(
        participants=[
            ParticipantResponse(
                id=p.participant_id,
                original_id=p.original_id,
                is_leader=p.is_leader,
                key_fingerprint=security_service.generate_key_fingerprint(
                    json.dumps(json.loads(p.shared_key)).encode()
                ) if p.shared_key else None,
                joined_at=p.joined_at.isoformat() if p.joined_at else None,
                left_at=p.left_at.isoformat() if p.left_at else None,
            )
            for p in participants
        ]
    )

@router.get("/session/{session_id}/rounds", response_model=RoundsResponse)
async def get_rounds(session_id: str, db: Session = Depends(get_db)):
    """获取会话的QKD轮次信息"""
    rounds = db.query(QKDRound).filter(
        QKDRound.session_id == session_id
    ).order_by(QKDRound.round_number).all()
    
    return RoundsResponse(
        rounds=[
            RoundResponse(
                round_number=r.round_number,
                group_type=r.group_type,
                leader_id=r.leader_id,
                state_type=r.state_type,
                circuit_diagram=r.circuit_diagram,
                qubits_used=r.qubits_used,
                decoy_info={
                    'positions': json.loads(r.decoy_positions) if r.decoy_positions else [],
                    'bases': json.loads(r.decoy_bases) if r.decoy_bases else [],
                    'states': json.loads(r.decoy_states) if r.decoy_states else [],
                    'count': len(json.loads(r.decoy_positions) if r.decoy_positions else [])
                } if r.decoy_positions else None,
                key_synchronization={
                    'diff_positions': json.loads(r.key_diff_positions) if r.key_diff_positions else [],
                    'total_bit_flips': r.bit_flips_count
                } if r.key_diff_positions else None,
                created_at=r.created_at.isoformat() if r.created_at else None
            )
            for r in rounds
        ]
    )


@router.get("/admin/sessions", response_model=AdminSessionsResponse)
async def admin_list_sessions(db: Session = Depends(get_db)):
    """管理端：会话列表（用于后台Page1/2/3选择数据源）"""
    sessions = db.query(SessionModel).order_by(SessionModel.created_at.desc()).limit(50).all()
    return AdminSessionsResponse(
        sessions=[
            AdminSessionListItem(
                session_id=s.id,
                status=s.status,
                created_at=s.created_at.isoformat() if s.created_at else None,
                completed_at=s.completed_at.isoformat() if s.completed_at else None,
                total_participants=s.total_participants,
                key_length=s.key_length,
                decoy_count=s.decoy_count
            )
            for s in sessions
        ]
    )


@router.get("/admin/sessions/{session_id}/snapshot", response_model=AdminSessionSnapshotResponse)
async def admin_session_snapshot(session_id: str, db: Session = Depends(get_db)):
    """管理端：会话快照（participants/rounds/statistics/events 一次取齐）"""
    db_session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    participants = db.query(Participant).filter(Participant.session_id == session_id).all()
    rounds = db.query(QKDRound).filter(QKDRound.session_id == session_id).order_by(QKDRound.round_number).all()
    events = db.query(QKEEvent).filter(QKEEvent.session_id == session_id).order_by(QKEEvent.seq).all()

    participants_resp = [
        ParticipantResponse(
            id=p.participant_id,
            original_id=p.original_id,
            is_leader=p.is_leader,
            is_malicious=p.is_malicious,
            is_hbc=p.is_hbc,
            key_fingerprint=security_service.generate_key_fingerprint(p.shared_key.encode()) if p.shared_key else None,
            joined_at=p.joined_at.isoformat() if p.joined_at else None,
            left_at=p.left_at.isoformat() if p.left_at else None
        )
        for p in participants
    ]

    rounds_resp = [
        RoundResponse(
            round_number=r.round_number,
            group_type=r.group_type,
            leader_id=r.leader_id,
            state_type=r.state_type,
            circuit_diagram=r.circuit_diagram,
            qubits_used=r.qubits_used,
            decoy_info={
                'positions': json.loads(r.decoy_positions) if r.decoy_positions else [],
                'bases': json.loads(r.decoy_bases) if r.decoy_bases else [],
                'states': json.loads(r.decoy_states) if r.decoy_states else [],
                'count': len(json.loads(r.decoy_positions) if r.decoy_positions else [])
            } if r.decoy_positions else None,
            key_synchronization={
                'diff_positions': json.loads(r.key_diff_positions) if r.key_diff_positions else [],
                'total_bit_flips': r.bit_flips_count
            } if r.key_diff_positions else None,
            created_at=r.created_at.isoformat() if r.created_at else None
        )
        for r in rounds
    ]

    events_resp = [
        QKEEventResponse(
            id=e.id,
            seq=e.seq,
            type=e.event_type,
            level=e.level,
            timestamp=e.timestamp.isoformat() if e.timestamp else datetime.utcnow().isoformat(),
            summary=e.summary,
            details=json.loads(e.details_json) if e.details_json else None
        )
        for e in events
    ]

    statistics = {
        "quantum_cost": db_session.quantum_cost or 0,
        "pauli_ops": db_session.pauli_ops or 0,
        "bit_flips": db_session.bit_flips or 0,
        "total_quantum_ops": db_session.total_quantum_ops or 0,
        "classical_cost": db_session.classical_cost or 0,
        "latency": db_session.latency or 0,
        "key_rate": db_session.key_rate or 0,
    }

    return AdminSessionSnapshotResponse(
        session_id=session_id,
        participants=participants_resp,
        rounds=rounds_resp,
        statistics=statistics,  # pydantic will validate into Statistics
        events=events_resp
    )
