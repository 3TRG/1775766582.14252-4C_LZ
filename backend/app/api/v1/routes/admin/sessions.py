from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from app.models import get_db
from app.models.v1_models import QKESession, QKEEvent, QKERound, Conversation
from app.models.quantum import EntropyAnalysis, QuantumResource
from app.services.qke_service import QKEService

router = APIRouter()


@router.get("/sessions", response_model=List[dict])
async def get_qke_sessions(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    scene_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    获取QKE会话列表
    """
    query = db.query(QKESession)
    
    if status:
        query = query.filter(QKESession.status == status)
    if scene_type:
        query = query.filter(QKESession.scene_type == scene_type)
    
    sessions = query.order_by(QKESession.start_time.desc()).offset(skip).limit(limit).all()
    
    result = []
    for session in sessions:
        # 获取关联的会话信息
        conversation = db.query(Conversation).filter(
            Conversation.id == session.conversation_id
        ).first()
        
        result.append({
            "session_id": session.id,
            "session_no": session.session_no,
            "conversation_id": session.conversation_id,
            "conversation_name": conversation.name if conversation else None,
            "trigger_type": session.trigger_type,
            "scene_type": session.scene_type,
            "participant_count": session.participant_count,
            "key_length": session.key_length,
            "status": session.status,
            "start_time": session.start_time.isoformat(),
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "latency_ms": session.latency_ms,
            "final_key_fingerprint": session.final_key_fingerprint
        })
    
    return result


@router.get("/sessions/{session_id}", response_model=dict)
async def get_qke_session_detail(
    session_id: int,
    db: Session = Depends(get_db)
):
    """
    获取QKE会话详情
    """
    session = db.query(QKESession).filter(QKESession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    # 获取关联的会话信息
    conversation = db.query(Conversation).filter(
        Conversation.id == session.conversation_id
    ).first()
    
    # 获取会话成员
    from app.models.v1_models import QKESessionMember, User
    members = db.query(QKESessionMember, User).join(
        User, QKESessionMember.user_id == User.id
    ).filter(
        QKESessionMember.qke_session_id == session_id
    ).all()
    
    member_list = []
    for member, user in members:
        member_list.append({
            "user_id": user.id,
            "username": user.username,
            "real_name": user.real_name,
            "logical_role": member.logical_role,
            "threat_role": member.threat_role,
            "status": member.status,
            "joined_at": member.joined_at.isoformat(),
            "completed_at": member.completed_at.isoformat() if member.completed_at else None
        })
    
    # 获取轮次信息
    rounds = db.query(QKERound).filter(
        QKERound.qke_session_id == session_id
    ).order_by(QKERound.round_number).all()
    
    round_list = []
    for r in rounds:
        participant_ids = []
        if r.participant_ids_json:
            try:
                participant_ids = json.loads(r.participant_ids_json) or []
            except Exception:
                participant_ids = []
        diff_positions = []
        if r.diff_positions_json:
            try:
                diff_positions = json.loads(r.diff_positions_json) or []
            except Exception:
                diff_positions = []
        round_list.append({
            "round_number": r.round_number,
            "group_type": r.group_type,
            "state_type": r.state_type,
            "leader_user_id": r.leader_user_id,
            "participants": participant_ids,
            "qubits_used": r.qubits_used,
            "diff_positions": diff_positions,
            "total_bit_flips": r.total_bit_flips,
            "round_latency_ms": r.round_latency_ms,
            "round_status": r.round_status,
            "started_at": r.started_at.isoformat(),
            "finished_at": r.finished_at.isoformat() if r.finished_at else None
        })
    
    # 获取熵值分析
    entropy_analyses = db.query(EntropyAnalysis).filter(
        EntropyAnalysis.qke_session_id == session_id
    ).all()
    
    entropy_list = []
    for analysis in entropy_analyses:
        entropy_list.append({
            "key_fingerprint": analysis.key_fingerprint,
            "shannon_entropy": analysis.shannon_entropy,
            "min_entropy": analysis.min_entropy,
            "entropy_ratio": analysis.entropy_ratio,
            "analysis_method": analysis.analysis_method,
            "analysis_timestamp": analysis.analysis_timestamp.isoformat()
        })
    
    return {
        "session": {
            "id": session.id,
            "session_no": session.session_no,
            "conversation_id": session.conversation_id,
            "conversation_name": conversation.name if conversation else None,
            "trigger_type": session.trigger_type,
            "scene_type": session.scene_type,
            "protocol_name": session.protocol_name,
            "protocol_version": session.protocol_version,
            "participant_count": session.participant_count,
            "leader_count": session.leader_count,
            "key_length": session.key_length,
            "decoy_count": session.decoy_count,
            "status": session.status,
            "start_time": session.start_time.isoformat(),
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "latency_ms": session.latency_ms,
            "final_key_fingerprint": session.final_key_fingerprint,
            "entropy": session.entropy,
            "qber": session.qber,
            "key_rate": session.key_rate,
            "quantum_cost": session.quantum_cost,
            "classical_cost": session.classical_cost,
            "pauli_ops": session.pauli_ops,
            "total_quantum_ops": session.total_quantum_ops,
            "bit_flips": session.bit_flips,
            "fail_reason": session.fail_reason
        },
        "members": member_list,
        "rounds": round_list,
        "entropy_analyses": entropy_list
    }


@router.get("/sessions/{session_id}/events", response_model=List[dict])
async def get_qke_session_events(
    session_id: int,
    event_type: Optional[str] = None,
    round_number: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    获取QKE会话事件
    """
    query = db.query(QKEEvent).filter(QKEEvent.qke_session_id == session_id)
    
    if event_type:
        query = query.filter(QKEEvent.event_type == event_type)
    if round_number is not None:
        query = query.filter(QKEEvent.round_number == round_number)
    
    events = query.order_by(QKEEvent.event_time).offset(skip).limit(limit).all()
    
    result = []
    for event in events:
        result.append({
            "event_id": event.id,
            "event_type": event.event_type,
            "event_stage": event.event_stage,
            "round_number": event.round_number,
            "severity": event.severity,
            "title": event.title,
            "detail": event.detail_json,
            "event_time": event.event_time.isoformat()
        })
    
    return result


@router.get("/sessions/{session_id}/statistics", response_model=dict)
async def get_qke_session_statistics(
    session_id: int,
    db: Session = Depends(get_db)
):
    """
    获取QKE会话统计信息
    """
    qke_service = QKEService(db)
    try:
        statistics = await qke_service.get_session_statistics(session_id)
        return statistics
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/conversations", response_model=List[dict])
async def get_conversations(
    skip: int = 0,
    limit: int = 50,
    type: Optional[str] = None,
    qke_status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    获取会话列表
    """
    query = db.query(Conversation)
    
    if type:
        query = query.filter(Conversation.type == type)
    if qke_status:
        query = query.filter(Conversation.qke_status == qke_status)
    
    conversations = query.order_by(Conversation.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for conv in conversations:
        # 获取最新的QKE会话
        latest_qke_session = db.query(QKESession).filter(
            QKESession.conversation_id == conv.id
        ).order_by(QKESession.start_time.desc()).first()
        
        result.append({
            "conversation_id": conv.id,
            "conversation_no": conv.conversation_no,
            "type": conv.type,
            "name": conv.name,
            "owner_user_id": conv.owner_user_id,
            "member_count": conv.member_count,
            "qke_status": conv.qke_status,
            "current_key_epoch": conv.current_key_epoch,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "created_at": conv.created_at.isoformat(),
            "latest_qke_session_id": latest_qke_session.id if latest_qke_session else None,
            "latest_qke_status": latest_qke_session.status if latest_qke_session else None
        })
    
    return result


@router.get("/statistics/summary", response_model=dict)
async def get_statistics_summary(db: Session = Depends(get_db)):
    """
    获取系统统计摘要
    """
    from sqlalchemy import func
    
    # 会话统计
    total_conversations = db.query(func.count(Conversation.id)).scalar() or 0
    active_conversations = db.query(func.count(Conversation.id)).filter(
        Conversation.status == "active"
    ).scalar() or 0
    
    # QKE会话统计
    total_qke_sessions = db.query(func.count(QKESession.id)).scalar() or 0
    completed_qke_sessions = db.query(func.count(QKESession.id)).filter(
        QKESession.status == "completed"
    ).scalar() or 0
    failed_qke_sessions = db.query(func.count(QKESession.id)).filter(
        QKESession.status == "failed"
    ).scalar() or 0
    
    # 平均指标
    avg_latency = db.query(func.avg(QKESession.latency_ms)).filter(
        QKESession.status == "completed"
    ).scalar() or 0
    avg_entropy = db.query(func.avg(QKESession.entropy)).filter(
        QKESession.status == "completed"
    ).scalar() or 0
    avg_key_rate = db.query(func.avg(QKESession.key_rate)).filter(
        QKESession.status == "completed"
    ).scalar() or 0
    
    return {
        "conversations": {
            "total": total_conversations,
            "active": active_conversations
        },
        "qke_sessions": {
            "total": total_qke_sessions,
            "completed": completed_qke_sessions,
            "failed": failed_qke_sessions,
            "success_rate": (completed_qke_sessions / total_qke_sessions * 100) if total_qke_sessions > 0 else 0
        },
        "average_metrics": {
            "latency_ms": float(avg_latency),
            "entropy": float(avg_entropy),
            "key_rate": float(avg_key_rate)
        }
    }
