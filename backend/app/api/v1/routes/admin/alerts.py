"""
管理端 - 安全告警 API
提供告警查询、确认、解决等功能
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models import get_db
from app.models.v1_models import SecurityAlert, User
from app.core.security import parse_access_token
from fastapi import Header


router = APIRouter(tags=["管理端 - 安全告警"])


def _get_admin_user_id(authorization: str = Header(...)) -> int:
    """验证管理员身份"""
    if not authorization.startswith("Bearer "):
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

class AlertItem(BaseModel):
    id: int
    alert_type: str
    severity: str
    title: Optional[str] = None
    detail_json: Optional[str] = None
    detected_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[int] = None
    status: str
    conversation_id: Optional[int] = None
    qke_session_id: Optional[int] = None

    class Config:
        from_attributes = True


class AlertsResponse(BaseModel):
    data: List[AlertItem]


# ==================== 路由 ====================

@router.get("/alerts", response_model=AlertsResponse)
def list_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 100,
    user_id: int = Depends(_get_admin_user_id),
    db: Session = Depends(get_db),
):
    """获取安全告警列表"""
    _check_admin(db, user_id)

    query = db.query(SecurityAlert).order_by(desc(SecurityAlert.detected_at))

    if status:
        query = query.filter(SecurityAlert.status == status)
    if severity:
        query = query.filter(SecurityAlert.severity == severity)

    alerts = query.limit(min(limit, 500)).all()
    return {"data": alerts}


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    user_id: int = Depends(_get_admin_user_id),
    db: Session = Depends(get_db),
):
    """确认告警"""
    _check_admin(db, user_id)

    alert = db.query(SecurityAlert).filter(SecurityAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")

    alert.status = "acknowledged"
    db.commit()
    return {"message": "告警已确认", "alert_id": alert_id}


@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    user_id: int = Depends(_get_admin_user_id),
    db: Session = Depends(get_db),
):
    """解决告警"""
    _check_admin(db, user_id)

    alert = db.query(SecurityAlert).filter(SecurityAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")

    alert.status = "resolved"
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by = user_id
    db.commit()
    return {"message": "告警已解决", "alert_id": alert_id}
