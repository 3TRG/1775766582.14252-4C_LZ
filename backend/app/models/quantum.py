from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, Float, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from . import Base


class QuantumPrivateKey(Base):
    """量子私钥表 - 存储用户和会话的量子私钥"""
    __tablename__ = 'quantum_private_keys'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id'), nullable=True, index=True)
    qke_session_id = Column(Integer, ForeignKey('qke_sessions.id'), nullable=True, index=True)
    key_type = Column(String(20), nullable=False, index=True)  # identity, session, epoch, message
    key_version = Column(Integer, default=1)
    key_material = Column(Text, nullable=False)  # 加密存储的私钥材料
    key_digest = Column(String(128), nullable=False, index=True)
    key_length = Column(Integer, nullable=False)
    status = Column(String(20), default='active', index=True)  # active, expired, revoked
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    expired_at = Column(DateTime, nullable=True, index=True)
    rotation_trigger = Column(String(64), nullable=True)  # initial, member_change, time_based, risk_based
    
    # 索引
    __table_args__ = (
        Index('idx_user_key', 'user_id', 'key_type', 'status'),
        Index('idx_conversation_key', 'conversation_id', 'key_type', 'status'),
        Index('idx_qke_session_key', 'qke_session_id', 'key_type'),
    )
    
    # 关系
    user = relationship('app.models.v1_models.User', backref='quantum_keys')
    conversation = relationship('app.models.v1_models.Conversation', backref='quantum_keys')
    qke_session = relationship('app.models.v1_models.QKESession', backref='quantum_keys')


class KeyDerivation(Base):
    """密钥派生记录 - 跟踪密钥派生过程"""
    __tablename__ = 'key_derivations'
    
    id = Column(Integer, primary_key=True, index=True)
    parent_key_id = Column(Integer, ForeignKey('quantum_private_keys.id'), nullable=True, index=True)
    child_key_id = Column(Integer, ForeignKey('quantum_private_keys.id'), nullable=False, index=True)
    derivation_algorithm = Column(String(32), nullable=False)  # HKDF, PBKDF2, etc.
    derivation_info = Column(Text, nullable=True)  # 派生参数
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    parent_key = relationship('app.models.quantum.QuantumPrivateKey', foreign_keys=[parent_key_id], backref='child_derivations')
    child_key = relationship('app.models.quantum.QuantumPrivateKey', foreign_keys=[child_key_id], backref='parent_derivation')


class QuantumResource(Base):
    """量子资源管理 - 跟踪量子操作和资源消耗"""
    __tablename__ = 'quantum_resources'
    
    id = Column(Integer, primary_key=True, index=True)
    qke_session_id = Column(Integer, ForeignKey('qke_sessions.id'), nullable=True, index=True)
    resource_type = Column(String(32), nullable=False)  # qubit, circuit, measurement, etc.
    resource_count = Column(Integer, nullable=False)
    operation_type = Column(String(32), nullable=False)  # create, measure, teleport, etc.
    quantum_cost = Column(Integer, nullable=False)  # 量子操作成本
    classical_cost = Column(Integer, nullable=False)  # 经典计算成本
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # 关系
    qke_session = relationship('app.models.v1_models.QKESession', backref='quantum_resources')


class EntropyAnalysis(Base):
    """熵值分析记录 - 存储密钥的熵值分析结果"""
    __tablename__ = 'entropy_analyses'
    
    id = Column(Integer, primary_key=True, index=True)
    key_id = Column(Integer, ForeignKey('quantum_private_keys.id'), nullable=True, index=True)
    qke_session_id = Column(Integer, ForeignKey('qke_sessions.id'), nullable=True, index=True)
    key_fingerprint = Column(String(128), nullable=False, index=True)
    shannon_entropy = Column(Float, nullable=False)
    min_entropy = Column(Float, nullable=False)
    conditional_entropy = Column(Float, nullable=True)
    entropy_ratio = Column(Float, nullable=False)  # 相对于最大熵的比例
    analysis_method = Column(String(32), nullable=False)  # shannon, min, etc.
    analysis_timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # 关系
    key = relationship('app.models.quantum.QuantumPrivateKey', backref='entropy_analyses')
    qke_session = relationship('app.models.v1_models.QKESession', backref='entropy_analyses')
