from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    account: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=64)


class LoginRequest(BaseModel):
    account: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=64)


class UserProfile(BaseModel):
    user_id: int
    username: str
    account: str
    online_status: str
    phone: str | None = None
    email: str | None = None


class RegisterResponse(BaseModel):
    user: UserProfile
    private_key_digest: str


class LoginResponse(BaseModel):
    access_token: str
    user: UserProfile


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
