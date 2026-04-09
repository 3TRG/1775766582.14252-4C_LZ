"""
QKE Engine 单元测试
覆盖: app/services/qke_engine/
"""
import os
import pytest

os.environ["ENVIRONMENT"] = "test"
os.environ.setdefault("APP_TOKEN_SECRET", "test-secret-for-unit-tests-only")

from app.services.qke_engine import (
    create_qke_engine,
    ParticipantConfig,
    SessionConfig
)


class TestQKEEngine:

    @pytest.fixture(autouse=True)
    def setup(self):
        self.engine = create_qke_engine("local_simulator")
        self.participants = [
            ParticipantConfig(user_id=1, is_leader=True),
            ParticipantConfig(user_id=2, is_leader=False),
            ParticipantConfig(user_id=3, is_leader=False),
            ParticipantConfig(user_id=4, is_leader=True)
        ]
        self.session_config = SessionConfig(
            key_length=256,
            decoy_count=4
        )

    def test_create_session(self):
        session_handle = self.engine.create_session(self.participants, self.session_config)
        assert session_handle is not None
        assert session_handle.session_id.startswith("qke_")

    def test_execute_protocol(self):
        session_handle = self.engine.create_session(self.participants, self.session_config)
        result = self.engine.execute_protocol(session_handle)
        assert result.success is True
        assert result.session_handle.session_id == session_handle.session_id
        assert result.key_length == 256
        assert 0.0 <= result.entropy <= 1.0
        assert "quantum_cost" in result.statistics
        assert "classical_cost" in result.statistics

    def test_get_key_material_and_derive_key(self):
        session_handle = self.engine.create_session(self.participants, self.session_config)
        result = self.engine.execute_protocol(session_handle)
        assert result.success

        key_material_handle = self.engine.get_key_material(session_handle, "message_encryption")
        assert key_material_handle.purpose == "message_encryption"
        assert key_material_handle.session_id == session_handle.session_id

        derived_key = self.engine.derive_key(key_material_handle, b"test_context", 32)
        assert isinstance(derived_key, bytes)
        assert len(derived_key) == 32

        self.engine.release_key_material(key_material_handle)

    def test_get_session_status(self):
        session_handle = self.engine.create_session(self.participants, self.session_config)
        status = self.engine.get_session_status(session_handle)
        assert status.session_handle.session_id == session_handle.session_id
        assert status.status == "created"
        assert status.participant_count == 4
        assert status.key_length == 256

        self.engine.execute_protocol(session_handle)
        status = self.engine.get_session_status(session_handle)
        assert status.status == "completed"
        assert status.completed_at is not None

    def test_get_protocol_events(self):
        session_handle = self.engine.create_session(self.participants, self.session_config)
        events = self.engine.get_protocol_events(session_handle)
        assert len(events) == 1
        assert events[0].event_type == "session_created"

        self.engine.execute_protocol(session_handle)
        events = self.engine.get_protocol_events(session_handle)
        assert len(events) > 1

        first_event = events[0]
        assert first_event.event_id is not None
        assert first_event.timestamp is not None

        timestamps = [e.timestamp for e in events]
        assert timestamps == sorted(timestamps)

    def test_health_check(self):
        assert self.engine.health_check() is True

    def test_invalid_session_operations(self):
        class FakeHandle:
            session_id = "fake_session_id"

        fake_handle = FakeHandle()
        with pytest.raises(ValueError):
            self.engine.execute_protocol(fake_handle)
        with pytest.raises(ValueError):
            self.engine.get_key_material(fake_handle, "message_encryption")
        with pytest.raises(ValueError):
            self.engine.get_session_status(fake_handle)
        with pytest.raises(ValueError):
            self.engine.get_protocol_events(fake_handle)
