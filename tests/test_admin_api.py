"""
管理端 API 端点集成测试
覆盖: /api/v1/admin/alerts、/api/v1/admin/keys/epochs 等
"""
import os
import sys
import time
import pytest
import pytest_asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("APP_TOKEN_SECRET", "test-secret-for-unit-tests-only")

from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime

from app.models import Base, get_db
from main import app

# 使用 StaticPool 确保所有连接共享同一个内存数据库
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
# 启用外键约束
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingSessionLocal = sessionmaker(bind=engine)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    """在测试开始前创建所有表"""
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def override_db():
    """让 FastAPI 依赖注入返回测试数据库 session"""
    def fastapi_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = fastapi_get_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


_UNIQUE_COUNTER = [0]


def _unique_ts() -> str:
    _UNIQUE_COUNTER[0] += 1
    base = str(int(time.time()))
    return f"{base}{_UNIQUE_COUNTER[0]:04d}"


async def _create_admin_user(client: AsyncClient) -> dict:
    """创建一个管理员用户并返回 {user_id, account, token}"""
    from app.core.security import hash_password
    ts = _unique_ts()
    phone = f"1{ts[-10:]}"  # 11位手机号
    # 直接在数据库中创建管理员用户
    db = TestingSessionLocal()
    try:
        from app.models.v1_models import User
        user = User(
            username=f"admin_{ts[-6:]}",
            real_name=f"admin_{ts[-6:]}",
            phone=phone,
            password_hash=hash_password("Admin123!"),
            is_admin=True,
            status="active",
        )
        db.add(user)
        db.commit()
        user_id = user.id
    finally:
        db.close()

    # 直接签发 token（不走 login 流程，避免手机号验证等限制）
    from app.core.security import issue_access_token
    token = issue_access_token(user_id)
    return {"user_id": user_id, "account": phone, "token": token}


async def _create_normal_user(client: AsyncClient) -> dict:
    """创建一个普通用户并返回 {user_id, account, token}"""
    ts = _unique_ts()
    phone = f"1{ts[-10:]}"  # 11位手机号
    resp = await client.post("/api/v1/auth/register", json={
        "username": f"user_{ts[-6:]}",
        "account": phone,
        "password": "Test123!",
    })
    assert resp.status_code == 200, f"注册失败: {resp.text}"
    user_id = resp.json()["user"]["user_id"]

    resp = await client.post("/api/v1/auth/login", json={
        "account": phone,
        "password": "Test123!",
    })
    assert resp.status_code == 200, f"登录失败: {resp.text}"
    token = resp.json()["access_token"]
    return {"user_id": user_id, "account": phone, "token": token}


def _auth(token: str):
    return {"Authorization": f"Bearer {token}"}


# ==================== 告警 API 测试 ====================


class TestAlertsAPI:
    """管理端安全告警 API 测试"""

    async def test_list_alerts_empty(self, client: AsyncClient):
        """空告警列表"""
        admin = await _create_admin_user(client)
        resp = await client.get("/api/v1/admin/alerts", headers=_auth(admin["token"]))
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert isinstance(data["data"], list)

    async def test_list_alerts_with_data(self, client: AsyncClient):
        """有告警数据时返回列表"""
        admin = await _create_admin_user(client)
        # 直接插入测试告警
        db = TestingSessionLocal()
        try:
            from app.models.v1_models import SecurityAlert
            db.add(SecurityAlert(
                alert_type="qber_anomaly",
                severity="warning",
                title="QBER 异常检测",
                detail_json='{"qber": 0.15}',
                detected_at=datetime.utcnow(),
                status="active",
            ))
            db.commit()
        finally:
            db.close()

        resp = await client.get("/api/v1/admin/alerts", headers=_auth(admin["token"]))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["data"]) >= 1
        assert data["data"][0]["alert_type"] == "qber_anomaly"

    async def test_list_alerts_filter_by_status(self, client: AsyncClient):
        """按状态筛选告警"""
        admin = await _create_admin_user(client)
        resp = await client.get(
            "/api/v1/admin/alerts?status=active",
            headers=_auth(admin["token"]),
        )
        assert resp.status_code == 200

    async def test_acknowledge_alert(self, client: AsyncClient):
        """确认告警"""
        admin = await _create_admin_user(client)
        # 插入告警
        db = TestingSessionLocal()
        try:
            from app.models.v1_models import SecurityAlert
            alert = SecurityAlert(
                alert_type="entropy_low",
                severity="warning",
                title="熵值过低",
                status="active",
                detected_at=datetime.utcnow(),
            )
            db.add(alert)
            db.commit()
            alert_id = alert.id
        finally:
            db.close()

        resp = await client.post(
            f"/api/v1/admin/alerts/{alert_id}/acknowledge",
            headers=_auth(admin["token"]),
        )
        assert resp.status_code == 200
        assert "已确认" in resp.json()["message"]

    async def test_resolve_alert(self, client: AsyncClient):
        """解决告警"""
        admin = await _create_admin_user(client)
        db = TestingSessionLocal()
        try:
            from app.models.v1_models import SecurityAlert
            alert = SecurityAlert(
                alert_type="key_expired",
                severity="info",
                title="密钥过期",
                status="active",
                detected_at=datetime.utcnow(),
            )
            db.add(alert)
            db.commit()
            alert_id = alert.id
        finally:
            db.close()

        resp = await client.post(
            f"/api/v1/admin/alerts/{alert_id}/resolve",
            headers=_auth(admin["token"]),
        )
        assert resp.status_code == 200
        assert "已解决" in resp.json()["message"]

    async def test_acknowledge_nonexistent_alert(self, client: AsyncClient):
        """确认不存在的告警返回 404"""
        admin = await _create_admin_user(client)
        resp = await client.post(
            "/api/v1/admin/alerts/99999/acknowledge",
            headers=_auth(admin["token"]),
        )
        assert resp.status_code == 404

    async def test_non_admin_cannot_access(self, client: AsyncClient):
        """非管理员无法访问告警 API"""
        user = await _create_normal_user(client)
        resp = await client.get("/api/v1/admin/alerts", headers=_auth(user["token"]))
        assert resp.status_code == 403

    async def test_no_auth_returns_error(self, client: AsyncClient):
        """未认证请求返回 422（缺少 header）或 401"""
        resp = await client.get("/api/v1/admin/alerts")
        assert resp.status_code in (401, 422)


# ==================== 密钥 Epoch API 测试 ====================


class TestKeyEpochsAPI:
    """管理端密钥 Epoch API 测试"""

    async def test_list_epochs_empty(self, client: AsyncClient):
        admin = await _create_admin_user(client)
        resp = await client.get(
            "/api/v1/admin/keys/epochs",
            headers=_auth(admin["token"]),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert isinstance(data["data"], list)

    async def test_list_epochs_with_data(self, client: AsyncClient):
        admin = await _create_admin_user(client)
        # 创建测试数据
        db = TestingSessionLocal()
        try:
            from app.models.v1_models import Conversation, KeyEpoch
            conv = Conversation(conversation_no="conv-test-001", type="private", status="active", current_key_epoch=1)
            db.add(conv)
            db.flush()
            db.add(KeyEpoch(
                conversation_id=conv.id,
                epoch_no=1,
                key_fingerprint="abc123",
                key_length=64,
                entropy=0.95,
                qber=0.02,
                status="active",
                activated_at=datetime.utcnow(),
            ))
            db.commit()
        finally:
            db.close()

        resp = await client.get(
            "/api/v1/admin/keys/epochs",
            headers=_auth(admin["token"]),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["data"]) >= 1
        epoch = data["data"][0]
        assert epoch["key_fingerprint"] == "abc123"
        assert epoch["epoch_no"] == 1
        assert epoch["status"] == "active"

    async def test_list_epochs_filter_by_conversation(self, client: AsyncClient):
        admin = await _create_admin_user(client)
        resp = await client.get(
            "/api/v1/admin/keys/epochs?conversation_id=1",
            headers=_auth(admin["token"]),
        )
        assert resp.status_code == 200

    async def test_non_admin_cannot_access_epochs(self, client: AsyncClient):
        user = await _create_normal_user(client)
        resp = await client.get(
            "/api/v1/admin/keys/epochs",
            headers=_auth(user["token"]),
        )
        assert resp.status_code == 403
