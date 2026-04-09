from __future__ import annotations

import hashlib
import logging
import re
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.security import (
    generate_pauli_seed, hash_password, verify_password, 
    issue_access_token, parse_access_token
)
from app.models.v1_models import User, UserQuantumIdentity, UserDevice
from app.models.quantum import QuantumPrivateKey
from app.schemas.auth import (
    LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, 
    UserProfile, TokenResponse
)
from app.websocket.admin_manager import admin_ws_manager


def _try_broadcast_event(event_name: str, data: dict, coro_fn: Any) -> None:
    """
    在同步函数中安全触发异步广播。
    使用 run_coroutine_threadsafe 在后台线程中执行异步广播，
    确保即使从同步路由调用也能正常工作。
    """
    import threading

    def _run_in_thread():
        try:
            # 创建新的事件循环来运行异步广播
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(coro_fn(data))
            finally:
                loop.close()
        except Exception as e:
            logging.warning("[%s] 广播事件失败: %s", event_name, e)

    # 在后台线程中执行，不阻塞当前请求
    thread = threading.Thread(target=_run_in_thread, daemon=True)
    thread.start()


def _user_profile(user: User) -> UserProfile:
    return UserProfile(
        user_id=user.id,
        username=user.username,
        account=user.phone or user.email or "",
        online_status=user.online_status or "offline",
        phone=user.phone,
        email=user.email,
    )


def _validate_password_strength(password: str) -> bool:
    """
    验证密码强度
    - 至少8个字符
    - 包含至少一个大写字母
    - 包含至少一个小写字母
    - 包含至少一个数字
    - 包含至少一个特殊字符
    """
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码长度至少8个字符"
        )
    if not re.search(r'[A-Z]', password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码必须包含至少一个大写字母"
        )
    if not re.search(r'[a-z]', password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码必须包含至少一个小写字母"
        )
    if not re.search(r'\d', password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码必须包含至少一个数字"
        )
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码必须包含至少一个特殊字符"
        )
    return True


def _validate_email(email: str) -> bool:
    """
    验证邮箱格式
    """
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱格式不正确"
        )
    return True


def _validate_phone(phone: str) -> bool:
    """
    验证手机号格式
    """
    phone_pattern = r'^1[3-9]\d{9}$'
    if not re.match(phone_pattern, phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号格式不正确"
        )
    return True


def register_user(db: Session, payload: RegisterRequest) -> RegisterResponse:
    """
    注册用户
    """
    # 验证密码强度（必须在创建用户之前）
    _validate_password_strength(payload.password)

    # 验证用户名是否已存在
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )

    # 验证账号（手机号或邮箱）
    account = payload.account
    if '@' in account:
        _validate_email(account)
        if db.query(User).filter(User.email == account).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱已被注册"
            )
        user = User(
            username=payload.username,
            real_name=payload.username,
            email=account,
            password_hash=hash_password(payload.password),
            status="active",
            online_status="offline",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    else:
        _validate_phone(account)
        if db.query(User).filter(User.phone == account).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="手机号已被注册"
            )
        user = User(
            username=payload.username,
            real_name=payload.username,
            phone=account,
            password_hash=hash_password(payload.password),
            status="active",
            online_status="offline",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    
    # 创建用户
    db.add(user)
    db.flush()
    
    # 生成量子身份私钥
    pauli_seed = generate_pauli_seed(48)
    digest = hashlib.sha256(pauli_seed.encode("utf-8")).hexdigest()[:16]
    
    # 存储量子身份
    quantum_identity = UserQuantumIdentity(
        user_id=user.id,
        identity_private_key=pauli_seed,
        identity_key_digest=digest,
        key_version=1,
        created_at=datetime.utcnow(),
    )
    db.add(quantum_identity)
    
    # 存储量子私钥
    quantum_key = QuantumPrivateKey(
        user_id=user.id,
        key_type="identity",
        key_material=pauli_seed,
        key_digest=digest,
        key_length=48,
        status="active",
        created_at=datetime.utcnow()
    )
    db.add(quantum_key)
    
    db.commit()
    db.refresh(user)
    
    # 分配角色：第一个用户为leader，其他为follower
    user_count = db.query(User).count()
    role = "leader" if user_count <= 1 else "follower"
    admin_ws_manager.set_user_role(user.id, role)
    
    # 广播用户注册事件到管理端
    user_data = {
        "user_id": user.id,
        "username": user.username,
        "phone": user.phone,
        "email": user.email,
        "role": role,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }
    # 异步广播（不阻塞注册流程）
    _try_broadcast_event("用户注册", user_data, admin_ws_manager.notify_user_registered)
    
    return RegisterResponse(
        user=_user_profile(user), 
        private_key_digest=digest
    )


def login_user(db: Session, payload: LoginRequest) -> LoginResponse:
    """
    用户登录
    """
    account = payload.account
    
    # 根据账号类型查询用户
    if '@' in account:
        # 邮箱登录
        user = db.query(User).filter(
            User.email == account, 
            User.status == "active"
        ).first()
    else:
        # 手机号登录
        user = db.query(User).filter(
            User.phone == account, 
            User.status == "active"
        ).first()
    
    # 验证用户和密码
    if not user or not verify_password(payload.password, user.password_hash):
        # 记录登录失败
        # 这里可以添加登录失败次数限制逻辑
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )
    
    # 更新用户状态
    user.online_status = "online"
    user.last_seen_at = datetime.utcnow()
    user.last_login_at = datetime.utcnow()
    user.updated_at = datetime.utcnow()
    
    db.commit()
    
    # 获取用户角色
    role = admin_ws_manager.get_user_role(user.id)
    
    # 广播用户登录事件到管理端
    user_data = {
        "user_id": user.id,
        "username": user.username,
        "role": role,
        "login_at": datetime.utcnow().isoformat()
    }
    _try_broadcast_event("用户登录", user_data, admin_ws_manager.notify_user_login)
    
    # 生成访问令牌
    access_token = issue_access_token(user.id)
    
    return LoginResponse(
        access_token=access_token, 
        user=_user_profile(user)
    )


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """
    根据用户ID获取用户
    """
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """
    根据用户名获取用户
    """
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """
    根据邮箱获取用户
    """
    return db.query(User).filter(User.email == email).first()


def get_user_by_phone(db: Session, phone: str) -> Optional[User]:
    """
    根据手机号获取用户
    """
    return db.query(User).filter(User.phone == phone).first()


def update_user_device(
    db: Session, 
    user_id: int, 
    device_id: str, 
    device_info: Dict[str, Any]
) -> UserDevice:
    """
    更新用户设备信息
    """
    device = db.query(UserDevice).filter(
        UserDevice.user_id == user_id,
        UserDevice.device_id == device_id
    ).first()
    
    if not device:
        device = UserDevice(
            user_id=user_id,
            device_id=device_id,
            device_name=device_info.get('device_name'),
            device_type=device_info.get('device_type'),
            os_name=device_info.get('os_name'),
            browser_name=device_info.get('browser_name'),
            ip_address=device_info.get('ip_address'),
            trust_level="normal",
            last_active_at=datetime.utcnow(),
            created_at=datetime.utcnow()
        )
        db.add(device)
    else:
        device.device_name = device_info.get('device_name', device.device_name)
        device.device_type = device_info.get('device_type', device.device_type)
        device.os_name = device_info.get('os_name', device.os_name)
        device.browser_name = device_info.get('browser_name', device.browser_name)
        device.ip_address = device_info.get('ip_address', device.ip_address)
        device.last_active_at = datetime.utcnow()
    
    db.commit()
    db.refresh(device)
    
    return device


def logout_user(db: Session, user_id: int) -> bool:
    """
    用户登出
    """
    user = get_user_by_id(db, user_id)
    if user:
        user.online_status = "offline"
        user.last_seen_at = datetime.utcnow()
        user.updated_at = datetime.utcnow()
        db.commit()

        # 广播用户登出事件到管理端
        _try_broadcast_event(
            "用户登出",
            {"user_id": user.id, "username": user.username},
            admin_ws_manager.notify_user_logout
        )

        return True
    return False


def refresh_token(db: Session, refresh_token: str) -> TokenResponse:
    """
    刷新令牌
    """
    try:
        payload = parse_access_token(refresh_token)
        user_id = int(payload["user_id"])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的刷新令牌"
        )
    
    user = get_user_by_id(db, user_id)
    if not user or user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在或已被禁用"
        )
    
    # 生成新的访问令牌
    new_access_token = issue_access_token(user.id)
    
    return TokenResponse(
        access_token=new_access_token,
        token_type="bearer"
    )
