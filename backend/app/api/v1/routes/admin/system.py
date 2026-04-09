"""
管理端 - 系统配置与审计日志 API
提供系统配置的读取/更新和审计日志查询功能
"""

import json
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models import get_db
from app.models.v1_models import SystemConfig as SystemConfigModel, AuditLog, User
from app.core.security import parse_access_token
from app.core.config import get_config


router = APIRouter(tags=["管理端 - 系统配置"])


def _get_admin_user_id(authorization: str = Header(default=None)) -> int:
    """验证管理员身份"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="无效的Authorization header")
    token = authorization.split(" ")[1]
    try:
        payload = parse_access_token(token)
        return int(payload["user_id"])
    except Exception:
        raise HTTPException(status_code=401, detail="无效的令牌")


def _check_admin(db: Session, user_id: int) -> User:
    """检查用户是否为管理员"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


# ==================== 响应模型 ====================

class QKEConfigSection(BaseModel):
    default_backend: str = "local_simulator"
    default_key_length: int = 256
    default_decoy_count: int = 4
    session_timeout_minutes: int = 30
    max_participants: int = 10


class SecurityConfigSection(BaseModel):
    token_expire_hours: int = 24
    key_rotation_enabled: bool = True
    key_rotation_interval_hours: int = 24


class ServerConfigSection(BaseModel):
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    workers: int = 1


class LoggingConfigSection(BaseModel):
    level: str = "INFO"
    file_path: str = ""


class SystemConfigResponse(BaseModel):
    data: dict


class LogEntry(BaseModel):
    id: int
    timestamp: str
    level: str
    message: str
    source: str

    class Config:
        from_attributes = True


class LogsResponse(BaseModel):
    data: List[LogEntry]


# ==================== 路由 ====================

@router.get("/config", response_model=SystemConfigResponse)
def get_system_config(
    user_id: int = Depends(_get_admin_user_id),
    db: Session = Depends(get_db),
):
    """获取系统配置"""
    _check_admin(db, user_id)

    # 优先从数据库读取配置，回退到 ConfigManager
    config = get_config()

    config_data = {
        "qke": {
            "default_backend": config.qke.default_backend,
            "default_key_length": config.qke.default_key_length,
            "default_decoy_count": config.qke.default_decoy_count,
            "session_timeout_minutes": config.qke.session_timeout_minutes,
            "max_participants": config.qke.max_participants,
        },
        "security": {
            "token_expire_hours": config.security.token_expire_hours,
            "key_rotation_enabled": True,
            "key_rotation_interval_hours": 24,
        },
        "server": {
            "host": config.server.host,
            "port": config.server.port,
            "debug": config.server.debug,
            "workers": config.server.workers,
        },
        "logging": {
            "level": config.logging.level,
            "file_path": config.logging.file_path or "",
        },
    }

    # 从数据库覆盖特定配置项
    db_configs = db.query(SystemConfigModel).all()
    for cfg in db_configs:
        if cfg.config_key and cfg.config_value:
            # 支持嵌套键如 "qke.default_key_length"
            parts = cfg.config_key.split(".")
            if len(parts) == 2 and parts[0] in config_data:
                try:
                    config_data[parts[0]][parts[1]] = json.loads(cfg.config_value)
                except (json.JSONDecodeError, TypeError):
                    config_data[parts[0]][parts[1]] = cfg.config_value

    return {"data": config_data}


@router.put("/config")
def update_system_config(
    config_updates: dict,
    user_id: int = Depends(_get_admin_user_id),
    db: Session = Depends(get_db),
):
    """更新系统配置"""
    _check_admin(db, user_id)

    updated_keys = []
    for section_name, section_data in config_updates.items():
        if not isinstance(section_data, dict):
            continue
        for key, value in section_data.items():
            config_key = f"{section_name}.{key}"
            # 存储到数据库
            existing = db.query(SystemConfigModel).filter(
                SystemConfigModel.config_key == config_key
            ).first()

            if existing:
                existing.config_value = json.dumps(value) if not isinstance(value, str) else value
                existing.updated_by = user_id
                existing.updated_at = datetime.utcnow()
            else:
                db.add(SystemConfigModel(
                    config_key=config_key,
                    config_value=json.dumps(value) if not isinstance(value, str) else value,
                    updated_by=user_id,
                ))

            updated_keys.append(config_key)

    # 记录审计日志
    db.add(AuditLog(
        operator_user_id=user_id,
        target_type="system_config",
        target_id="all",
        action="update_config",
        detail_json=json.dumps({"updated_keys": updated_keys}, ensure_ascii=False),
    ))

    db.commit()
    return {"message": "配置已更新", "updated_keys": updated_keys}


@router.get("/logs", response_model=LogsResponse)
def get_system_logs(
    limit: int = 100,
    user_id: int = Depends(_get_admin_user_id),
    db: Session = Depends(get_db),
):
    """获取审计日志"""
    _check_admin(db, user_id)

    logs = (
        db.query(AuditLog)
        .order_by(desc(AuditLog.created_at))
        .limit(min(limit, 500))
        .all()
    )

    entries = []
    for log in logs:
        detail = {}
        if log.detail_json:
            try:
                detail = json.loads(log.detail_json)
            except (json.JSONDecodeError, TypeError):
                detail = {"raw": log.detail_json}

        entries.append(LogEntry(
            id=log.id,
            timestamp=log.created_at.isoformat() if log.created_at else "",
            level="INFO",
            message=f"{log.action} - {log.target_type}/{log.target_id}",
            source=f"user:{log.operator_user_id or 'system'}",
        ))

    return {"data": entries}
