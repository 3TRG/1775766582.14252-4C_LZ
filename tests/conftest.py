"""
共享测试配置 — DB 覆盖、HTTP 客户端、辅助函数
这些 fixture 可被所有 test_*.py 文件复用
"""
import os
import sys
import time
import pytest
import pytest_asyncio

# 确保能导入 backend 模块
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# ---- 必须在导入 app 之前设置测试数据库环境变量 ----
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite://"

from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, get_db
from main import app

# ---------- 测试数据库（内存 SQLite，不留文件） ----------
TEST_DB_URL = "sqlite://"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """在测试开始前创建所有表"""
    Base.metadata.create_all(bind=engine)
    yield
    # 内存数据库无需清理文件
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


# ---------- HTTP 客户端 ----------
@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)  # type: ignore[arg-type]
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


# ---------- 辅助函数 ----------
_UNIQUE_COUNTER = [0]


def _unique_ts() -> str:
    _UNIQUE_COUNTER[0] += 1
    base = str(int(time.time()))
    return f"{base}{_UNIQUE_COUNTER[0]:04d}"


def _auth(token: str):
    return {"Authorization": f"Bearer {token}"}


async def _register(client: AsyncClient, account: str, username: str, password: str = "Test123!"):
    resp = await client.post("/api/v1/auth/register", json={
        "username": username,
        "account": account,
        "password": password,
    })
    assert resp.status_code == 200, f"注册失败: {resp.text}"
    return resp.json()


async def _login(client: AsyncClient, account: str, password: str = "Test123!"):
    resp = await client.post("/api/v1/auth/login", json={
        "account": account,
        "password": password,
    })
    assert resp.status_code == 200, f"登录失败: {resp.text}"
    return resp.json()
