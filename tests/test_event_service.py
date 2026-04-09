"""
事件服务单元测试
覆盖: event_service.py
"""
import os
import json

os.environ["ENVIRONMENT"] = "test"
os.environ.setdefault("APP_TOKEN_SECRET", "test-secret-for-unit-tests-only")
os.environ.setdefault("DEBUG", "true")

import pytest
import asyncio
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


@pytest.fixture(autouse=True)
def db():
    Base.metadata.create_all(bind=engine)
    session = TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def event_service(db):
    from app.services.event_service import EventService
    return EventService(db)


# ==================== Event Publishing ====================

class TestPublishEvent:
    @pytest.mark.asyncio
    async def test_persist_event(self, event_service, db):
        await event_service.publish_event({
            "qke_session_id": 1,
            "conversation_id": 2,
            "event_type": "test_event",
            "event_stage": "test_stage",
            "title": "Test Event",
            "severity": "info",
            "payload": {"key": "value"},
            "timestamp": datetime.utcnow(),
        })
        # 给异步队列一点处理时间
        await asyncio.sleep(0.1)

        # 验证已持久化
        events = event_service.get_events_by_session(1)
        assert len(events) >= 1
        assert events[0]["event_type"] == "test_event"
        assert events[0]["title"] == "Test Event"

    @pytest.mark.asyncio
    async def test_publish_session_created(self, event_service):
        await event_service.publish_session_created(
            session_id=1,
            conversation_id=2,
            participants=[10, 20],
            key_length=256,
            decoy_count=4,
            trigger_type="initial",
        )
        await asyncio.sleep(0.1)
        events = event_service.get_events_by_session(1)
        assert len(events) >= 1
        assert events[0]["event_type"] == "session_created"

    @pytest.mark.asyncio
    async def test_publish_protocol_completed(self, event_service):
        await event_service.publish_protocol_completed(
            session_id=5,
            conversation_id=6,
            final_key_fingerprint="abc123",
            key_length=64,
            entropy=0.98,
            statistics={"latency": 0.12},
        )
        await asyncio.sleep(0.1)
        events = event_service.get_events_by_session(5)
        assert len(events) >= 1
        assert events[0]["event_type"] == "protocol_completed"
        payload = json.loads(events[0]["description"])
        assert payload["key_length"] == 64

    @pytest.mark.asyncio
    async def test_publish_protocol_failed(self, event_service):
        await event_service.publish_protocol_failed(
            session_id=99,
            conversation_id=100,
            error="connection lost",
        )
        await asyncio.sleep(0.1)
        events = event_service.get_events_by_session(99)
        assert len(events) >= 1
        assert events[0]["event_type"] == "protocol_failed"
        assert events[0]["severity"] == "error"


# ==================== Subscription ====================

class TestSubscribe:
    @pytest.mark.asyncio
    async def test_subscribe_and_receive(self, event_service):
        received = []

        def on_event(data):
            received.append(data)

        event_service.subscribe("custom_type", on_event)
        await event_service.publish_event({
            "qke_session_id": 1,
            "conversation_id": 1,
            "event_type": "custom_type",
            "event_stage": "test",
            "title": "Custom",
            "payload": {},
            "timestamp": datetime.utcnow(),
        })
        await asyncio.sleep(0.2)
        assert len(received) == 1
        assert received[0]["event_type"] == "custom_type"

    def test_unsubscribe(self, event_service):
        counter = [0]

        def cb(_):
            counter[0] += 1

        event_service.subscribe("x", cb)
        event_service.unsubscribe("x", cb)
        assert cb not in event_service._subscribers["x"]

    def test_subscribe_no_dup(self, event_service):
        def cb(_):
            pass

        event_service.subscribe("x", cb)
        event_service.subscribe("x", cb)  # Should not add duplicate
        count = len(event_service._subscribers["x"])
        assert count == 1


# ==================== Event Query ====================

class TestEventQuery:
    def test_get_events_by_conversation(self, event_service, db):
        from app.models.v1_models import QKEEvent
        db.add(QKEEvent(
            qke_session_id=1,
            conversation_id=42,
            event_type="msg_sent",
            event_stage="transport",
            severity="info",
            title="测试事件",
            detail_json=json.dumps({"msg": "hello"}),
            event_time=datetime.utcnow(),
        ))
        db.commit()
        events = event_service.get_events_by_conversation(42)
        assert len(events) >= 1
        assert events[0]["event_type"] == "msg_sent"

    def test_get_events_by_type(self, event_service, db):
        from app.models.v1_models import QKEEvent
        for i in range(3):
            db.add(QKEEvent(
                qke_session_id=i,
                conversation_id=i,
                event_type="session_created",
                event_stage="initiated",
                severity="info",
                title=f"事件 {i}",
                detail_json="{}",
                event_time=datetime.utcnow(),
            ))
        db.commit()
        events = event_service.get_events_by_type("session_created")
        assert len(events) >= 3

    def test_empty_query(self, event_service):
        events = event_service.get_events_by_session(9999)
        assert events == []
        events = event_service.get_events_by_conversation(9999)
        assert events == []


# ==================== Protocol Event Conversion ====================

class TestConvertProtocolEvent:
    def test_conversion(self):
        from app.services.event_service import convert_protocol_event_to_service_event
        from app.services.qke_engine import ProtocolEvent

        ev = ProtocolEvent(
            event_type="round_completed",
            event_stage="verify",
            title="测量完成",
            description="所有参与者完成测量",
            severity="info",
            payload={"round_no": 1},
            timestamp=datetime.utcnow(),
        )
        result = convert_protocol_event_to_service_event(ev, session_id=10, conversation_id=20)
        assert result["qke_session_id"] == 10
        assert result["conversation_id"] == 20
        assert result["event_type"] == "round_completed"
        assert result["payload"] == {"round_no": 1}
