from __future__ import annotations

from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from . import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    name = Column(String(128), nullable=False)
    code = Column(String(64), unique=True, nullable=True)
    manager_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sort_order = Column(Integer, default=0)
    status = Column(String(16), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    parent = relationship("Department", remote_side=[id], foreign_keys=[parent_id])



class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    real_name = Column(String(64), nullable=False)
    email = Column(String(128), nullable=True)
    phone = Column(String(32), nullable=True)
    avatar_url = Column(String(255), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True, index=True)
    title = Column(String(64), nullable=True)

    status = Column(String(16), default="active")  # active/locked/deleted
    online_status = Column(String(16), default="offline")  # online/offline/away/busy
    last_seen_at = Column(DateTime, nullable=True, index=True)
    last_login_at = Column(DateTime, nullable=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", foreign_keys=[department_id])


class UserDevice(Base):
    __tablename__ = "user_devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    device_id = Column(String(128), unique=True, nullable=False)
    device_name = Column(String(128), nullable=True)
    device_type = Column(String(32), nullable=True)  # web/pc/mobile
    os_name = Column(String(64), nullable=True)
    browser_name = Column(String(64), nullable=True)
    ip_address = Column(String(64), nullable=True)
    trust_level = Column(String(16), default="normal")
    last_active_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class UserQuantumIdentity(Base):
    __tablename__ = "user_quantum_identities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    identity_private_key = Column(String(255), nullable=False)
    identity_key_digest = Column(String(128), nullable=False)
    key_version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), index=True)
    remark_name = Column(String(64), nullable=True)
    group_name = Column(String(64), nullable=True)
    is_favorite = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_user_id])
    target = relationship("User", foreign_keys=[target_user_id])


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    conversation_no = Column(String(64), unique=True, nullable=False)
    type = Column(String(16), nullable=False)  # private/group/meeting/system
    name = Column(String(128), nullable=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    avatar_url = Column(String(255), nullable=True)
    description = Column(String(255), nullable=True)
    secure_mode = Column(String(16), default="qke")  # qke/classic/hybrid
    key_length = Column(Integer, default=64)  # 会话密钥长度（比特）
    current_key_epoch = Column(Integer, default=0)
    qke_status = Column(String(16), default="idle")  # idle/negotiating/active/failed/rotating
    member_count = Column(Integer, default=0)
    last_message_id = Column(Integer, nullable=True)
    last_message_at = Column(DateTime, nullable=True, index=True)
    status = Column(String(16), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_user_id])


class ConversationMember(Base):
    __tablename__ = "conversation_members"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id", name="uq_conversation_member"),)

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    member_role = Column(String(16), default="member")  # owner/admin/member
    join_source = Column(String(16), default="manual")
    nickname_in_group = Column(String(64), nullable=True)
    is_muted = Column(Boolean, default=False)
    mute_until = Column(DateTime, nullable=True)
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)
    status = Column(String(16), default="active")  # active/left/removed

    conversation = relationship("Conversation")
    user = relationship("User")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), index=True)
    sender_user_id = Column(Integer, ForeignKey("users.id"), index=True)
    message_type = Column(String(16), default="text")  # text/image/file/system/event
    plaintext_digest = Column(String(128), nullable=True)
    ciphertext = Column(Text, nullable=False)
    nonce = Column(String(128), nullable=False)
    aad = Column(String(255), nullable=True)
    encryption_alg = Column(String(32), default="AES-GCM")
    key_epoch = Column(Integer, nullable=False)
    message_seq = Column(Integer, nullable=False)
    client_msg_id = Column(String(64), nullable=True)
    send_status = Column(String(16), default="sent")  # sending/sent/failed/recalled
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation")
    sender = relationship("User")


class MessageReceipt(Base):
    __tablename__ = "message_receipts"
    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_message_receipt"),)

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)

    message = relationship("Message")
    user = relationship("User")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), index=True)
    title = Column(String(128), nullable=False)
    organizer_user_id = Column(Integer, ForeignKey("users.id"), index=True)
    scheduled_start_at = Column(DateTime, nullable=True)
    scheduled_end_at = Column(DateTime, nullable=True)
    actual_start_at = Column(DateTime, nullable=True)
    actual_end_at = Column(DateTime, nullable=True)
    secure_channel_mode = Column(String(16), default="qke")
    status = Column(String(16), default="scheduled")  # scheduled/running/ended/cancelled
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation")
    organizer = relationship("User")


class QKESession(Base):
    __tablename__ = "qke_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_no = Column(String(64), unique=True, nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), index=True)
    trigger_type = Column(String(16), nullable=False)  # initial/rekey/manual/member_change/risk
    scene_type = Column(String(16), nullable=False)  # private/group/meeting/demo
    protocol_name = Column(String(64), default="QKA-QKD-HYBRID")
    protocol_version = Column(String(32), default="v1")
    participant_count = Column(Integer, nullable=False)
    leader_count = Column(Integer, default=0)
    key_length = Column(Integer, nullable=False)
    decoy_count = Column(Integer, default=0)
    status = Column(String(16), default="created")
    start_time = Column(DateTime, default=datetime.utcnow, index=True)
    end_time = Column(DateTime, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    final_key_fingerprint = Column(String(128), nullable=True)
    entropy = Column(Float, nullable=True)
    qber = Column(Float, nullable=True)
    key_rate = Column(Float, nullable=True)
    quantum_cost = Column(Integer, default=0)
    classical_cost = Column(Integer, default=0)
    pauli_ops = Column(Integer, default=0)
    total_quantum_ops = Column(Integer, default=0)
    bit_flips = Column(Integer, default=0)
    fail_reason = Column(String(255), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
# 关系
    conversation = relationship("app.models.v1_models.Conversation")
    creator = relationship("app.models.v1_models.User", foreign_keys=[created_by])


class QKESessionMember(Base):
    __tablename__ = "qke_session_members"
    __table_args__ = (UniqueConstraint("qke_session_id", "user_id", name="uq_qke_session_member"),)

    id = Column(Integer, primary_key=True, index=True)
    qke_session_id = Column(Integer, ForeignKey("qke_sessions.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    logical_role = Column(String(16), nullable=False)  # leader/follower
    threat_role = Column(String(16), default="normal")  # normal (恶意节点模型已移除)
    participant_order = Column(Integer, nullable=True)
    private_key_digest = Column(String(128), nullable=True)
    shared_key_digest = Column(String(128), nullable=True)
    joined_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(16), default="joined")  # joined/running/synced/failed/left
# 关系
    session = relationship("app.models.v1_models.QKESession")
    user = relationship("app.models.v1_models.User")


class QKERound(Base):
    __tablename__ = "qke_rounds"
    __table_args__ = (UniqueConstraint("qke_session_id", "round_number", name="uq_qke_round"),)

    id = Column(Integer, primary_key=True, index=True)
    qke_session_id = Column(Integer, ForeignKey("qke_sessions.id"), index=True)
    round_number = Column(Integer, nullable=False)
    group_type = Column(String(32), nullable=True)
    state_type = Column(String(32), nullable=True)
    leader_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    participant_ids_json = Column(Text, nullable=True)
    qasm_text = Column(Text, nullable=True)
    circuit_diagram_url = Column(Text, nullable=True)
    qubits_used = Column(Integer, default=0)
    decoy_positions_json = Column(Text, nullable=True)
    decoy_bases_json = Column(Text, nullable=True)
    decoy_states_json = Column(Text, nullable=True)
    decoy_error_rate = Column(Float, nullable=True)
    diff_positions_json = Column(Text, nullable=True)
    total_bit_flips = Column(Integer, default=0)
    round_latency_ms = Column(Integer, nullable=True)
    round_status = Column(String(16), default="success")
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("app.models.v1_models.QKESession")
    leader = relationship("app.models.v1_models.User", foreign_keys=[leader_user_id])


class QKEEvent(Base):
    __tablename__ = "qke_events_v1"
    __table_args__ = (
        Index("ix_qke_events_type_stage", "event_type", "event_stage"),
        Index("ix_qke_events_severity_time", "severity", "event_time"),
    )

    id = Column(Integer, primary_key=True, index=True)
    qke_session_id = Column(Integer, ForeignKey("qke_sessions.id"), index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), index=True)
    round_number = Column(Integer, nullable=True, index=True)
    event_type = Column(String(32), nullable=False, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    event_stage = Column(String(32), nullable=False)
    severity = Column(String(16), default="info")  # info/warn/error
    title = Column(String(128), nullable=True)
    detail_json = Column(Text, nullable=True)
    event_time = Column(DateTime, default=datetime.utcnow, index=True)
# 关系
    session = relationship("app.models.v1_models.QKESession")
    conversation = relationship("app.models.v1_models.Conversation")
    actor = relationship("app.models.v1_models.User", foreign_keys=[actor_user_id])


class KeyEpoch(Base):
    __tablename__ = "key_epochs"
    __table_args__ = (
        UniqueConstraint("conversation_id", "epoch_no", name="uq_key_epoch"),
        Index("ix_key_epoch_conv_status", "conversation_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), index=True)
    qke_session_id = Column(Integer, ForeignKey("qke_sessions.id"), index=True)
    epoch_no = Column(Integer, nullable=False)
    key_fingerprint = Column(String(128), nullable=False)
    key_length = Column(Integer, nullable=False)
    entropy = Column(Float, nullable=True)
    qber = Column(Float, nullable=True)
    activated_at = Column(DateTime, default=datetime.utcnow)
    expired_at = Column(DateTime, nullable=True)
    rotate_reason = Column(String(64), nullable=True)
    status = Column(String(16), default="active")  # active/expired/revoked/pending

    conversation = relationship("Conversation")
    session = relationship("QKESession")


class ConversationKeyMaterial(Base):
    __tablename__ = "conversation_key_materials"
    __table_args__ = (UniqueConstraint("conversation_id", "epoch_no", name="uq_conversation_epoch_material"),)

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), index=True)
    epoch_no = Column(Integer, nullable=False)
    key_material_b64 = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation")


class QKEMetricSnapshot(Base):
    __tablename__ = "qke_metric_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    qke_session_id = Column(Integer, ForeignKey("qke_sessions.id"), index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), index=True)
    round_number = Column(Integer, nullable=True)
    metric_time = Column(DateTime, default=datetime.utcnow, index=True)
    latency_ms = Column(Integer, nullable=True)
    key_rate = Column(Float, nullable=True)
    entropy = Column(Float, nullable=True)
    qber = Column(Float, nullable=True)
    quantum_cost = Column(Integer, nullable=True)
    classical_cost = Column(Integer, nullable=True)
    bit_flips = Column(Integer, nullable=True)
    participant_count = Column(Integer, nullable=True)

    session = relationship("QKESession")
    conversation = relationship("Conversation")


class SecurityAlert(Base):
    __tablename__ = "security_alerts"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True, index=True)
    qke_session_id = Column(Integer, ForeignKey("qke_sessions.id"), nullable=True, index=True)
    alert_type = Column(String(32), nullable=False)
    severity = Column(String(16), default="medium")
    title = Column(String(128), nullable=True)
    detail_json = Column(Text, nullable=True)
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(16), default="open")  # open/resolved/ignored

    conversation = relationship("Conversation")
    session = relationship("QKESession")
    resolver = relationship("User", foreign_keys=[resolved_by])


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    operator_user_id = Column(Integer, ForeignKey("users.id"), index=True)
    target_type = Column(String(32), nullable=False)
    target_id = Column(String(64), nullable=False)
    action = Column(String(64), nullable=False)
    detail_json = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    operator = relationship("User", foreign_keys=[operator_user_id])


class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String(64), unique=True, nullable=False)
    config_value = Column(Text, nullable=True)
    description = Column(String(255), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)

    updater = relationship("User", foreign_keys=[updated_by])

