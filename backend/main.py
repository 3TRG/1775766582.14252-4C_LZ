import logging
import sys
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router
from app.websocket.endpoints import router as ws_router
from app.models import Base, engine
from app.core.config import get_config
from app.core.openapi_utils import setup_openapi

config = get_config()


def setup_logging():
    """配置统一日志系统"""
    log_config = config.logging
    log_level = getattr(logging, log_config.level.upper(), logging.INFO)

    # 根日志器配置
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # 清除现有处理器（避免重复）
    root_logger.handlers.clear()

    # 日志格式
    formatter = logging.Formatter(
        fmt=log_config.format,
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # 控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # 文件处理器（如果配置了日志文件路径）
    if log_config.file_path:
        try:
            log_path = Path(log_config.file_path)
            log_path.parent.mkdir(parents=True, exist_ok=True)

            file_handler = RotatingFileHandler(
                log_config.file_path,
                maxBytes=log_config.max_size_mb * 1024 * 1024,
                backupCount=log_config.backup_count,
                encoding="utf-8"
            )
            file_handler.setLevel(log_level)
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
        except Exception as e:
            logging.warning("无法创建日志文件: %s", e)

    # 设置第三方库日志级别（减少噪音）
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    logging.info("日志系统初始化完成，级别: %s", log_config.level)


# 初始化日志系统
setup_logging()

app = FastAPI(
    title=config.app.name,
    version=config.app.version,
    description=config.app.description,
)

setup_openapi(app)

if config.ENABLE_METRICS:
    try:
        from prometheus_client import make_asgi_app
        app.mount("/metrics", make_asgi_app())
    except ImportError:
        logging.warning("[Warning] prometheus_client not installed, metrics endpoint disabled")

cors_origins_env = (os.getenv("APP_CORS_ORIGINS") or "").strip()
if cors_origins_env:
    cors_origins = ["*"] if cors_origins_env == "*" else [o.strip() for o in cors_origins_env.split(",") if o.strip()]
else:
    # 开发环境允许所有来源，生产环境必须显式配置
    cors_origins = [
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:3001", "http://127.0.0.1:3001",
        "http://localhost:3005", "http://127.0.0.1:3005",
    ]

allow_credentials = "*" not in cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 请求频率限制（登录/注册等敏感端点有更严格的限制）
# 测试环境（ENVIRONMENT=test）跳过限流，避免影响自动化测试
_is_test_env = os.getenv("ENVIRONMENT", "").lower() in ("test", "testing")
if not _is_test_env:
    from app.core.rate_limiter import RateLimitMiddleware
    app.add_middleware(RateLimitMiddleware)

app.include_router(api_router, prefix="/api")
app.include_router(ws_router)

_repo_root = Path(__file__).resolve().parent.parent
_user_frontend_dir = _repo_root / "user-frontend"
if _user_frontend_dir.exists():
    app.mount("/user", StaticFiles(directory=str(_user_frontend_dir), html=True), name="user_frontend")

_admin_dist_dir = _repo_root / "admin-frontend" / "dist"
if _admin_dist_dir.exists():
    app.mount("/admin", StaticFiles(directory=str(_admin_dist_dir), html=True), name="admin_frontend")


@app.on_event("startup")
def _startup_init_db() -> None:
    """
    数据库初始化：
    - 开发环境：使用 create_all() 自动创建表（适合快速迭代）
    - 生产环境：应使用 Alembic 进行数据库迁移（alembic upgrade head）

    注意：生产环境建议禁用此自动创建，通过 Alembic 管理数据库演进。
    """
    import app.models.models as _legacy_models
    import app.models.v1_models as _v1_models
    import app.models.quantum as _quantum_models

    # 仅在开发环境自动创建表，生产环境应使用 Alembic
    if config.environment in ("dev", "development"):
        Base.metadata.create_all(bind=engine)
        logging.info("开发环境：已自动创建数据库表（生产环境请使用 Alembic）")
    else:
        logging.info("生产环境：请确保已运行 'alembic upgrade head'")


@app.get("/")
async def root():
    return {"message": "量子密钥分发可视化系统 API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
