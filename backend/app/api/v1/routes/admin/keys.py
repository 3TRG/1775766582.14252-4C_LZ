"""
管理端 - 密钥管理 API
提供密钥 Epoch 查询功能
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from pydantic import BaseModel

from app.models import get_db
from app.models.v1_models import KeyEpoch, User
from app.core.security import parse_access_token


router = APIRouter(tags=["管理端 - 密钥管理"])


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

class KeyEpochItem(BaseModel):
    id: int
    conversation_id: int
    qke_session_id: Optional[int] = None
    epoch_no: int
    key_fingerprint: str
    key_length: int
    entropy: Optional[float] = None
    qber: Optional[float] = None
    activated_at: Optional[str] = None
    expired_at: Optional[str] = None
    rotate_reason: Optional[str] = None
    status: str
    usage_count: int = 0

    class Config:
        from_attributes = True


class KeyEpochListResponse(BaseModel):
    data: List[KeyEpochItem]


# ==================== 路由 ====================

@router.get("/keys/epochs", response_model=KeyEpochListResponse)
def list_key_epochs(
    conversation_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 100,
    user_id: int = Depends(_get_admin_user_id),
    db: Session = Depends(get_db),
):
    """获取密钥 Epoch 列表"""
    _check_admin(db, user_id)

    query = db.query(KeyEpoch).order_by(desc(KeyEpoch.activated_at))

    if conversation_id:
        query = query.filter(KeyEpoch.conversation_id == conversation_id)
    if status:
        query = query.filter(KeyEpoch.status == status)

    epochs = query.limit(min(limit, 500)).all()

    items = []
    for ep in epochs:
        items.append(KeyEpochItem(
            id=ep.id,
            conversation_id=ep.conversation_id,
            qke_session_id=ep.qke_session_id,
            epoch_no=ep.epoch_no,
            key_fingerprint=ep.key_fingerprint,
            key_length=ep.key_length,
            entropy=ep.entropy,
            qber=ep.qber,
            activated_at=ep.activated_at.isoformat() if ep.activated_at else None,
            expired_at=ep.expired_at.isoformat() if ep.expired_at else None,
            rotate_reason=ep.rotate_reason,
            status=ep.status,
            usage_count=0,  # 可从消息计数获取，暂时返回0
        ))

    return {"data": items}
