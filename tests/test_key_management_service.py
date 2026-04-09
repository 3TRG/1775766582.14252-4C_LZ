"""
密钥管理服务和事件服务单元测试
覆盖: key_management_service.py + event_service.py
"""
import os

os.environ["ENVIRONMENT"] = "test"
os.environ.setdefault("APP_TOKEN_SECRET", "test-secret-for-unit-tests-only")
os.environ.setdefault("DEBUG", "true")

import pytest
from datetime import datetime, timedelta
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


@pytest.fixture
def service(db):
    """创建 KeyManagementService 实例"""
    from app.services.key_management_service import KeyManagementService
    return KeyManagementService(db)


# ==================== KeyManagementService ====================

class TestShouldRotateKey:
    def test_no_conversation(self, service, db):
        should, reason = service.should_rotate_key(9999)
        assert should is False

    def test_no_active_epoch(self, service, db):
        from app.models.v1_models import Conversation
        conv = Conversation(type="private", status="active", current_key_epoch=0)
        db.add(conv)
        db.commit()
        should, reason = service.should_rotate_key(conv.id)
        assert should is True
        assert "No active" in reason

    def test_key_not_expired(self, service, db):
        from app.models.v1_models import Conversation, KeyEpoch
        conv = Conversation(type="private", status="active", current_key_epoch=1, key_length=256)
        db.add(conv)
        db.flush()
        epoch = KeyEpoch(
            conversation_id=conv.id,
            epoch_no=1,
            status="active",
            activated_at=datetime.utcnow(),
        )
        db.add(epoch)
        db.commit()
        should, reason = service.should_rotate_key(conv.id)
        assert should is False
        assert "valid" in reason

    def test_key_expired_by_age(self, service, db):
        from app.models.v1_models import Conversation, KeyEpoch
        conv = Conversation(type="private", status="active", current_key_epoch=1, key_length=256)
        db.add(conv)
        db.flush()
        # 设置激活时间为 25 小时前（超过默认 24 小时）
        old_time = datetime.utcnow() - timedelta(hours=25)
        epoch = KeyEpoch(conversation_id=conv.id, epoch_no=1, status="active", activated_at=old_time)
        db.add(epoch)
        db.commit()
        should, reason = service.should_rotate_key(conv.id)
        assert should is True
        assert "exceeds lifetime" in reason


class TestKeyRotation:
    def test_rotate_key(self, service, db):
        from app.models.v1_models import Conversation, KeyEpoch
        conv = Conversation(type="private", status="active", current_key_epoch=1, key_length=256)
        db.add(conv)
        db.flush()
        epoch = KeyEpoch(conversation_id=conv.id, epoch_no=1, status="active",
                        activated_at=datetime.utcnow(), key_length=64)
        db.add(epoch)
        db.commit()

        result = service.rotate_key(conv.id, reason="scheduled")
        assert result is not None
        assert result.epoch_no == 2
        assert result.status == "pending"

    def test_rotate_key_nonexistent_conv(self, service):
        result = service.rotate_key(9999)
        assert result is None


class TestActivateKeyEpoch:
    def test_activate_epoch(self, service, db):
        from app.models.v1_models import Conversation, KeyEpoch
        conv = Conversation(type="private", status="negotiating", current_key_epoch=1, key_length=256)
        db.add(conv)
        db.flush()
        epoch = KeyEpoch(conversation_id=conv.id, epoch_no=1, status="pending")
        db.add(epoch)
        db.commit()

        ok = service.activate_key_epoch(conv.id, qke_session_id=42, key_fingerprint="abcdef12",
                                        key_length=256, entropy=0.98)
        assert ok is True
        db.refresh(epoch)
        assert epoch.status == "active"
        assert epoch.qke_session_id == 42
        assert epoch.entropy == 0.98

    def test_activate_missing_conv(self, service):
        ok = service.activate_key_epoch(9999, 1, "fp", 256, 0.9)
        assert ok is False


class TestExpireKeyEpoch:
    def test_expire(self, service, db):
        from app.models.v1_models import Conversation, KeyEpoch
        conv = Conversation(type="private", status="active", current_key_epoch=1, key_length=256)
        db.add(conv)
        db.flush()
        epoch = KeyEpoch(conversation_id=conv.id, epoch_no=1, status="active")
        db.add(epoch)
        db.commit()

        ok = service.expire_key_epoch(conv.id, 1, "time_expired")
        assert ok is True
        db.refresh(epoch)
        assert epoch.status == "expired"

    def test_expire_nonexistent(self, service, db):
        ok = service.expire_key_epoch(9999, 1)
        assert ok is False


class TestRevokeKeyEpoch:
    def test_revoke(self, service, db):
        from app.models.v1_models import Conversation, KeyEpoch
        conv = Conversation(type="private", status="active", current_key_epoch=1, key_length=256)
        db.add(conv)
        db.flush()
        epoch = KeyEpoch(conversation_id=conv.id, epoch_no=1, status="active")
        db.add(epoch)
        db.commit()

        ok = service.revoke_key_epoch(conv.id, 1, "security_risk")
        assert ok is True
        db.refresh(epoch)
        assert epoch.status == "revoked"


class TestEntropyTrend:
    def test_empty_trend(self, service, db):
        from app.models.v1_models import Conversation
        conv = Conversation(type="private", status="active")
        db.add(conv)
        db.commit()
        trend = service.get_entropy_trend(conv.id)
        assert trend == []


class TestSecureKeyDeletion:
    def test_secure_delete(self, service):
        data = bytearray(b"secret_key_here")
        original = bytes(data)
        service.secure_delete_key_material(data)
        assert data == bytearray(len(original))


class TestForwardSecrecy:
    def test_deterministic(self, service):
        k1 = service.derive_key_with_forward_secrecy(b"base_key", 1, "message")
        k2 = service.derive_key_with_forward_secrecy(b"base_key", 1, "message")
        assert k1 == k2

    def test_different_epochs(self, service):
        k1 = service.derive_key_with_forward_secrecy(b"base_key", 1, "message")
        k2 = service.derive_key_with_forward_secrecy(b"base_key", 2, "message")
        assert k1 != k2

    def test_output_32_bytes(self, service):
        k = service.derive_key_with_forward_secrecy(b"x", 0, "msg")
        assert len(k) == 32  # SHA256


class TestKeyManagementStats:
    def test_stats_empty_conversation(self, service, db):
        stats = service.get_key_management_stats(9999)
        assert stats == {}

    def test_stats_basic(self, service, db):
        from app.models.v1_models import Conversation, KeyEpoch
        conv = Conversation(type="private", status="active", current_key_epoch=1, key_length=64)
        db.add(conv)
        db.flush()
        epoch = KeyEpoch(conversation_id=conv.id, epoch_no=1, status="active",
                        key_length=64, entropy=0.95)
        db.add(epoch)
        db.commit()

        stats = service.get_key_management_stats(conv.id)
        assert stats["total_epochs"] == 1
        assert stats["active_epochs"] == 1
        assert stats["average_entropy"] == pytest.approx(0.95, abs=0.01)
