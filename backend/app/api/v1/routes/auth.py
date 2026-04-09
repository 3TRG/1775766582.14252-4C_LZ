from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.models import get_db
from app.schemas.auth import (
    LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, 
    TokenResponse
)
from app.services.auth_service import (
    login_user as svc_login_user,
    register_user as svc_register_user,
    logout_user as svc_logout_user,
    refresh_token as svc_refresh_token,
    update_user_device as svc_update_user_device
)
from app.core.security import parse_access_token

router = APIRouter()


def get_current_user_id(authorization: str = Header(...)) -> int:
    """
    从Authorization header中获取当前用户ID
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="无效的Authorization header"
        )
    token = authorization.split(" ")[1]
    try:
        payload = parse_access_token(token)
        return int(payload["user_id"])
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="无效的令牌"
        )


@router.post("/register", response_model=RegisterResponse)
def register_user(
    payload: RegisterRequest,
    db: Session = Depends(get_db)
):
    """
    注册新用户
    - 支持手机号或邮箱注册
    - 密码强度验证
    - 自动生成量子身份密钥
    """
    return svc_register_user(db, payload)


@router.post("/login", response_model=LoginResponse)
def login_user(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    用户登录
    - 支持手机号或邮箱登录
    - 验证用户状态
    - 生成访问令牌
    """
    return svc_login_user(db, payload)


@router.post("/logout")
def logout_user(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    用户登出
    - 更新用户在线状态
    - 记录最后活动时间
    """
    success = svc_logout_user(db, user_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="用户不存在"
        )
    return {"message": "登出成功"}


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    """
    刷新访问令牌
    - 使用刷新令牌获取新的访问令牌
    - 验证用户状态
    """
    return svc_refresh_token(db, refresh_token)


@router.post("/device")
def update_device(
    device_info: Dict[str, Any],
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    更新用户设备信息
    - 记录设备详情
    - 跟踪设备活动
    """
    device_id = device_info.get("device_id")
    if not device_id:
        raise HTTPException(
            status_code=400,
            detail="设备ID不能为空"
        )
    
    device = svc_update_user_device(db, user_id, device_id, device_info)
    return {
        "device_id": device.device_id,
        "device_name": device.device_name,
        "last_active_at": device.last_active_at
    }


@router.get("/me")
def get_current_user(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    获取当前用户信息
    """
    from app.services.auth_service import get_user_by_id
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="用户不存在"
        )
    return {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "online_status": user.online_status,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at
    }
