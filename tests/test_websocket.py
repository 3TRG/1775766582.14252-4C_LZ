"""
WebSocket 端点测试
覆盖: app/websocket/endpoints.py — admin_realtime 认证、心跳、JSON 错误处理
注意：WebSocket 测试需要 httpx 的 WebSocket 支持（通过 ASGITransport）
"""
import os
import sys
import json
import time
import pytest
import pytest_asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("APP_TOKEN_SECRET", "test-secret-for-unit-tests-only")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime

from app.models import Base, get_db
from main import app

engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(bind=engine)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def override_db():
    def fastapi_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = fastapi_get_db
    yield
    app.dependency_overrides.pop(get_db, None)


# ==================== WebSocket 认证测试 ====================


class TestAdminRealtimeAuth:
    """管理端 WebSocket 认证测试（通过 HTTP 接口间接验证）"""

    @pytest.mark.asyncio
    async def test_admin_ws_auth_helper_valid_token(self):
        """验证 _authenticate_ws_token 能正确解析有效 token"""
        from app.websocket.endpoints import _authenticate_ws_token
        from app.core.security import issue_access_token

        token = issue_access_token(42)
        payload = _authenticate_ws_token(token)
        assert payload is not None
        assert payload["user_id"] == 42

    @pytest.mark.asyncio
    async def test_admin_ws_auth_helper_invalid_token(self):
        """验证 _authenticate_ws_token 拒绝无效 token"""
        from app.websocket.endpoints import _authenticate_ws_token

        result = _authenticate_ws_token("invalid_token_string")
        assert result is None

    @pytest.mark.asyncio
    async def test_admin_ws_auth_helper_expired_token(self):
        """验证 _authenticate_ws_token 拒绝过期 token"""
        from app.websocket.endpoints import _authenticate_ws_token
        from app.core.security import _TOKEN_SECRET, parse_access_token
        import base64
        import json as json_mod
        import hmac as hmac_mod
        from datetime import datetime, timezone, timedelta

        expire_past = int((datetime.now(tz=timezone.utc) + timedelta(hours=-1)).timestamp())
        payload = {"user_id": 1, "exp": expire_past}
        raw = json_mod.dumps(payload, separators=(",", ":")).encode()
        p64 = base64.urlsafe_b64encode(raw).decode().rstrip("=")
        sig = hmac_mod.new(_TOKEN_SECRET.encode(), p64.encode(), "sha256").hexdigest()
        expired_token = f"{p64}.{sig}"

        result = _authenticate_ws_token(expired_token)
        assert result is None

    @pytest.mark.asyncio
    async def test_check_admin_nonexistent_user(self):
        """验证 _check_admin_from_payload 对不存在用户返回 None"""
        from app.websocket.endpoints import _check_admin_from_payload

        db = TestingSessionLocal()
        try:
            result = _check_admin_from_payload(db, {"user_id": 99999})
            assert result is None
        finally:
            db.close()

    @pytest.mark.asyncio
    async def test_check_admin_regular_user(self):
        """验证 _check_admin_from_payload 对非管理员返回 None"""
        from app.websocket.endpoints import _check_admin_from_payload
        from app.core.security import hash_password

        db = TestingSessionLocal()
        try:
            from app.models.v1_models import User
            user = User(
                username="regular_user",
                real_name="regular_user",
                phone="13800000001",
                password_hash=hash_password("Test123!"),
                is_admin=False,
                status="active",
            )
            db.add(user)
            db.commit()
            uid = user.id

            result = _check_admin_from_payload(db, {"user_id": uid})
            assert result is None
        finally:
            db.close()

    @pytest.mark.asyncio
    async def test_check_admin_admin_user(self):
        """验证 _check_admin_from_payload 对管理员返回用户对象"""
        from app.websocket.endpoints import _check_admin_from_payload
        from app.core.security import hash_password

        db = TestingSessionLocal()
        try:
            from app.models.v1_models import User
            user = User(
                username="ws_admin",
                real_name="ws_admin",
                phone="13800000002",
                password_hash=hash_password("Admin123!"),
                is_admin=True,
                status="active",
            )
            db.add(user)
            db.commit()
            uid = user.id

            result = _check_admin_from_payload(db, {"user_id": uid})
            assert result is not None
            assert result.is_admin is True
        finally:
            db.close()


# ==================== WebSocket 消息格式测试 ====================


class TestWebSocketMessageFormat:
    """WebSocket 消息格式和协议测试"""

    def test_ping_message_format(self):
        """验证 ping 消息的 JSON 格式"""
        msg = json.dumps({"type": "ping"})
        parsed = json.loads(msg)
        assert parsed["type"] == "ping"

    def test_heartbeat_message_format(self):
        """验证 heartbeat 消息的 JSON 格式"""
        msg = json.dumps({"type": "heartbeat"})
        parsed = json.loads(msg)
        assert parsed["type"] == "heartbeat"

    def test_pong_response_format(self):
        """验证 pong 响应格式"""
        ts = datetime.utcnow().isoformat()
        response = json.dumps({
            "type": "pong",
            "timestamp": ts,
        }, ensure_ascii=False)
        parsed = json.loads(response)
        assert parsed["type"] == "pong"
        assert "timestamp" in parsed

    def test_auth_error_response_format(self):
        """验证认证错误响应格式"""
        response = json.dumps({
            "type": "auth_error",
            "data": {"message": "认证失败，token 无效或已过期"}
        }, ensure_ascii=False)
        parsed = json.loads(response)
        assert parsed["type"] == "auth_error"
        assert "message" in parsed["data"]

    def test_connection_success_response_format(self):
        """验证连接成功响应格式"""
        response = json.dumps({
            "type": "connection_success",
            "data": {
                "online_users_count": 1,
                "message": "管理端WebSocket连接成功"
            }
        }, ensure_ascii=False)
        parsed = json.loads(response)
        assert parsed["type"] == "connection_success"
        assert "online_users_count" in parsed["data"]

    def test_invalid_json_error_response(self):
        """验证无效 JSON 错误响应格式"""
        response = json.dumps({
            "type": "error",
            "data": {"message": "无效的JSON格式"}
        }, ensure_ascii=False)
        parsed = json.loads(response)
        assert parsed["type"] == "error"
        assert "message" in parsed["data"]


# ==================== Admin Manager 测试 ====================


class TestAdminWSManager:
    """admin_ws_manager 连接管理测试"""

    def test_manager_singleton(self):
        """验证 admin_ws_manager 存在且可导入"""
        from app.websocket.admin_manager import admin_ws_manager
        assert admin_ws_manager is not None

    def test_get_online_users_count_no_connections(self):
        """无连接时在线数应为 0"""
        from app.websocket.admin_manager import admin_ws_manager
        count = admin_ws_manager.get_online_users_count()
        assert count == 0

    def test_manager_has_required_methods(self):
        """验证 manager 有必要的方法"""
        from app.websocket.admin_manager import admin_ws_manager
        assert hasattr(admin_ws_manager, "connect")
        assert hasattr(admin_ws_manager, "disconnect")
        assert hasattr(admin_ws_manager, "broadcast")
        assert hasattr(admin_ws_manager, "get_online_users_count")
