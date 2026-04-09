from sqlalchemy import Column, String, Integer, Boolean, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from . import Base

class Session(Base):
    """量子密钥分发会话"""
    __tablename__ = 'sessions'
    
    id = Column(String(36), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(20), default='running')
    total_participants = Column(Integer)
    key_length = Column(Integer)
    decoy_count = Column(Integer)
    final_key = Column(Text)
    key_rate = Column(Float)
    latency = Column(Float)
    
    # 资源统计
    quantum_cost = Column(Integer)
    pauli_ops = Column(Integer)
    bit_flips = Column(Integer)
    total_quantum_ops = Column(Integer)
    classical_cost = Column(Integer)
    
    participants = relationship('app.models.models.Participant', back_populates='session')
    rounds = relationship('app.models.models.QKDRound', back_populates='session')
    events = relationship('app.models.models.QKEEvent', back_populates='session')

class Participant(Base):
    """参与者信息"""
    __tablename__ = 'participants'

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey('sessions.id'))
    participant_id = Column(Integer)
    original_id = Column(String(10))
    is_leader = Column(Boolean, default=False)

    private_key = Column(Text)
    shared_key = Column(Text)
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)

    session = relationship('app.models.models.Session', back_populates='participants')

class QKDRound(Base):
    """QKD轮次记录"""
    __tablename__ = 'qkd_rounds'
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey('sessions.id'))
    round_number = Column(Integer)
    group_type = Column(String(20))
    leader_id = Column(Integer)
    
    state_type = Column(String(20))
    circuit_diagram = Column(Text)
    qubits_used = Column(Integer)
    
    decoy_positions = Column(Text)
    decoy_bases = Column(Text)
    decoy_states = Column(Text)
    decoy_error_rate = Column(Float)
    
    key_diff_positions = Column(Text)
    bit_flips_count = Column(Integer)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    session = relationship('app.models.models.Session', back_populates='rounds')


class QKEEvent(Base):
    """管理端/回放用事件流（协议过程）"""
    __tablename__ = 'qke_events'

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey('sessions.id'), index=True)

    seq = Column(Integer, index=True)
    event_type = Column(String(30), index=True)
    level = Column(Integer, default=1)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    summary = Column(Text)
    details_json = Column(Text)

    session = relationship('app.models.models.Session', back_populates='events')