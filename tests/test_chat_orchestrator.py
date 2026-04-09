"""
聊天编排服务单元测试
覆盖: app/services/chat_orchestrator.py — QKE 协商编排、辅助函数
"""
import os
import json

os.environ["ENVIRONMENT"] = "test"
os.environ.setdefault("APP_TOKEN_SECRET", "test-secret-for-unit-tests-only")

import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


@pytest.fixture(autouse=True)
def db():
    """每个测试使用独立的 DB 表结构"""
    Base.metadata.create_all(bind=engine)
    session = TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


# ==================== 辅助函数测试 ====================


class TestResolveProtocolPath:
    """协议路径选择测试"""

    def test_2_participants_bell(self):
        from app.services.chat_orchestrator import resolve_protocol_path
        assert resolve_protocol_path(2) == "Bell-2"

    def test_1_participant_bell(self):
        from app.services.chat_orchestrator import resolve_protocol_path
        assert resolve_protocol_path(1) == "Bell-2"

    def test_3_participants_ghz3(self):
        from app.services.chat_orchestrator import resolve_protocol_path
        assert resolve_protocol_path(3) == "GHZ-3"

    def test_4_participants_ghz4(self):
        from app.services.chat_orchestrator import resolve_protocol_path
        assert resolve_protocol_path(4) == "GHZ-4+QKD"

    def test_5_participants_ghz4(self):
        from app.services.chat_orchestrator import resolve_protocol_path
        assert resolve_protocol_path(5) == "GHZ-4+QKD"

    def test_10_participants_ghz4(self):
        from app.services.chat_orchestrator import resolve_protocol_path
        assert resolve_protocol_path(10) == "GHZ-4+QKD"


class TestAddQkeEvent:
    """QKE 事件记录测试"""

    def test_event_is_persisted(self, db):
        from app.services.chat_orchestrator import add_qke_event
        add_qke_event(
            db,
            qke_session_id=1,
            conversation_id=2,
            event_type="session_created",
            event_stage="created",
            title="QKE会话已创建",
            detail={"participant_count": 3},
        )
        db.flush()

        from app.models.v1_models import QKEEvent
        events = db.query(QKEEvent).filter(QKEEvent.qke_session_id == 1).all()
        assert len(events) == 1
        assert events[0].event_type == "session_created"
        assert events[0].title == "QKE会话已创建"
        assert json.loads(events[0].detail_json) == {"participant_count": 3}

    def test_event_with_round_number(self, db):
        from app.services.chat_orchestrator import add_qke_event
        add_qke_event(
            db,
            qke_session_id=1,
            conversation_id=1,
            event_type="round_started",
            event_stage="quantum_exchange",
            title="第1轮开始",
            round_number=1,
        )
        db.flush()

        from app.models.v1_models import QKEEvent
        event = db.query(QKEEvent).first()
        assert event.round_number == 1

    def test_event_with_severity(self, db):
        from app.services.chat_orchestrator import add_qke_event
        add_qke_event(
            db,
            qke_session_id=1,
            conversation_id=1,
            event_type="protocol_failed",
            event_stage="verify",
            title="协议失败",
            severity="error",
        )
        db.flush()

        from app.models.v1_models import QKEEvent
        event = db.query(QKEEvent).first()
        assert event.severity == "error"


class TestBuildLightweightRounds:
    """轻量轮次构建测试"""

    def test_returns_rounds_and_metrics(self):
        from app.services.chat_orchestrator import build_lightweight_rounds
        rounds, metrics = build_lightweight_rounds(2, 64)
        assert len(rounds) >= 1
        assert "latency_ms" in metrics
        assert "quantum_cost" in metrics
        assert "classical_cost" in metrics

    def test_bell_state_for_2_participants(self):
        from app.services.chat_orchestrator import build_lightweight_rounds
        rounds, _ = build_lightweight_rounds(2, 64)
        assert rounds[0]["state_type"] == "Bell"
        assert rounds[0]["group_type"] == "Bell-2"

    def test_ghz3_state_for_3_participants(self):
        from app.services.chat_orchestrator import build_lightweight_rounds
        rounds, _ = build_lightweight_rounds(3, 64)
        assert rounds[0]["state_type"] == "GHZ-3"
        assert rounds[0]["group_type"] == "GHZ-3"

    def test_round_has_required_fields(self):
        from app.services.chat_orchestrator import build_lightweight_rounds
        rounds, _ = build_lightweight_rounds(4, 128)
        r = rounds[0]
        assert "round_number" in r
        assert "group_type" in r
        assert "state_type" in r
        assert "participants" in r
        assert "qubits_used" in r
        assert "diff_positions" in r


# ==================== 核心编排方法测试 ====================


class TestRunQkeAndActivateEpoch:
    """完整 QKE 编排流程集成测试"""

    def _create_test_conversation(self, db, conv_type="private"):
        """辅助方法：创建测试会话"""
        import secrets as sec
        from app.models.v1_models import Conversation
        conv = Conversation(
            conversation_no=f"conv-test-{sec.token_hex(4)}",
            type=conv_type,
            status="active",
            current_key_epoch=0,
            key_length=64,
        )
        db.add(conv)
        db.flush()
        return conv

    def test_creates_qke_session_and_epoch(self, db):
        """验证完整编排流程创建 QKE 会话和密钥轮次"""
        from app.services.chat_orchestrator import run_qke_and_activate_epoch
        from app.models.v1_models import QKESession, KeyEpoch

        conv = self._create_test_conversation(db)
        qke_id, epoch_no, protocol_path = run_qke_and_activate_epoch(
            db,
            conversation=conv,
            member_ids=[1, 2],
            trigger_type="initial",
            created_by=1,
        )
        db.flush()

        assert qke_id > 0
        assert epoch_no == 1
        assert protocol_path == "Bell-2"

        # 验证 QKE 会话记录
        qke_session = db.query(QKESession).filter(QKESession.id == qke_id).first()
        assert qke_session is not None
        assert qke_session.status == "completed"
        assert qke_session.final_key_fingerprint is not None

        # 验证 KeyEpoch 记录
        epoch = db.query(KeyEpoch).filter(
            KeyEpoch.conversation_id == conv.id
        ).first()
        assert epoch is not None
        assert epoch.epoch_no == 1
        assert epoch.status == "active"

    def test_conversation_key_status_updated(self, db):
        """验证会话的密钥状态被正确更新"""
        from app.services.chat_orchestrator import run_qke_and_activate_epoch

        conv = self._create_test_conversation(db)
        run_qke_and_activate_epoch(
            db,
            conversation=conv,
            member_ids=[1, 2],
            trigger_type="initial",
            created_by=1,
        )
        db.flush()

        assert conv.current_key_epoch == 1
        assert conv.qke_status == "active"

    def test_creates_qke_events(self, db):
        """验证编排过程中记录了多个 QKE 事件"""
        from app.services.chat_orchestrator import run_qke_and_activate_epoch
        from app.models.v1_models import QKEEvent

        conv = self._create_test_conversation(db)
        run_qke_and_activate_epoch(
            db,
            conversation=conv,
            member_ids=[1, 2],
            trigger_type="initial",
            created_by=1,
        )
        db.flush()

        events = db.query(QKEEvent).filter(
            QKEEvent.conversation_id == conv.id
        ).all()
        event_types = [e.event_type for e in events]
        assert "session_created" in event_types
        assert "participants_resolved" in event_types
        assert "leaders_elected" in event_types
        assert "key_generated" in event_types
        assert "epoch_activated" in event_types

    def test_group_3_participants(self, db):
        """3人场景使用 GHZ-3 协议"""
        from app.services.chat_orchestrator import run_qke_and_activate_epoch

        conv = self._create_test_conversation(db, "group")
        _, _, protocol_path = run_qke_and_activate_epoch(
            db,
            conversation=conv,
            member_ids=[1, 2, 3],
            trigger_type="initial",
            created_by=1,
        )
        assert protocol_path == "GHZ-3"

    def test_group_4_participants(self, db):
        """4人场景使用 GHZ-4+QKD 协议"""
        from app.services.chat_orchestrator import run_qke_and_activate_epoch

        conv = self._create_test_conversation(db, "group")
        _, _, protocol_path = run_qke_and_activate_epoch(
            db,
            conversation=conv,
            member_ids=[1, 2, 3, 4],
            trigger_type="initial",
            created_by=1,
        )
        assert protocol_path == "GHZ-4+QKD"

    def test_rekey_increments_epoch(self, db):
        """密钥轮换时 epoch 编号递增"""
        from app.services.chat_orchestrator import run_qke_and_activate_epoch

        conv = self._create_test_conversation(db)
        # 初始协商
        run_qke_and_activate_epoch(
            db, conversation=conv, member_ids=[1, 2],
            trigger_type="initial", created_by=1,
        )
        db.flush()
        assert conv.current_key_epoch == 1

        # 密钥轮换
        _, epoch_no, _ = run_qke_and_activate_epoch(
            db, conversation=conv, member_ids=[1, 2],
            trigger_type="rekey", created_by=1,
        )
        db.flush()
        assert epoch_no == 2
        assert conv.current_key_epoch == 2

    def test_creates_session_members(self, db):
        """验证 QKESessionMember 记录被创建"""
        from app.services.chat_orchestrator import run_qke_and_activate_epoch
        from app.models.v1_models import QKESessionMember

        conv = self._create_test_conversation(db)
        qke_id, _, _ = run_qke_and_activate_epoch(
            db, conversation=conv, member_ids=[10, 20],
            trigger_type="initial", created_by=10,
        )
        db.flush()

        members = db.query(QKESessionMember).filter(
            QKESessionMember.qke_session_id == qke_id
        ).all()
        assert len(members) == 2
        member_ids = {m.user_id for m in members}
        assert member_ids == {10, 20}

    def test_creates_conversation_key_material(self, db):
        """验证 ConversationKeyMaterial 被创建"""
        from app.services.chat_orchestrator import run_qke_and_activate_epoch
        from app.models.v1_models import ConversationKeyMaterial

        conv = self._create_test_conversation(db)
        run_qke_and_activate_epoch(
            db, conversation=conv, member_ids=[1, 2],
            trigger_type="initial", created_by=1,
        )
        db.flush()

        km = db.query(ConversationKeyMaterial).filter(
            ConversationKeyMaterial.conversation_id == conv.id
        ).first()
        assert km is not None
        assert km.epoch_no == 1
        assert km.key_material_b64 is not None


# ==================== 熵值估算测试 ====================


class TestEntropyEstimation:
    """熵值计算辅助函数测试"""

    def test_uniform_distribution_high_entropy(self):
        from app.services.chat_orchestrator import _estimate_entropy
        # 均匀分布的比特串熵值接近 1.0
        bits = "01" * 50  # 100位交替01
        entropy = _estimate_entropy(bits)
        assert entropy > 0.9

    def test_all_same_low_entropy(self):
        from app.services.chat_orchestrator import _estimate_entropy
        # 全0的比特串熵值为 0
        bits = "0" * 100
        entropy = _estimate_entropy(bits)
        assert entropy == pytest.approx(0.0, abs=0.01)

    def test_empty_string_zero_entropy(self):
        from app.services.chat_orchestrator import _estimate_entropy
        assert _estimate_entropy("") == 0.0
