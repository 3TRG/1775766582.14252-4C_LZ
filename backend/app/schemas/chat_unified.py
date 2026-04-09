from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class FriendAddRequest(BaseModel):
    account_or_user_id: str = Field(min_length=1, max_length=64)


class FriendItem(BaseModel):
    user_id: int
    username: str
    account: str
    online_status: str


class FriendsResponse(BaseModel):
    items: list[FriendItem]


class ConversationCreateRequest(BaseModel):
    type: Literal["private", "group"] = "private"
    member_ids: list[int] = Field(default_factory=list)


class ConversationCreateResponse(BaseModel):
    conversation_id: int
    conversation_type: str
    member_ids: list[int]
    key_epoch: int
    protocol_path: str
    qke_session_id: int


class P2PMessageSendRequest(BaseModel):
    to_user_id: int
    text: str = Field(min_length=1, max_length=4000)


class GroupMessageSendRequest(BaseModel):
    conversation_id: int
    text: str = Field(min_length=1, max_length=4000)


class MessageItem(BaseModel):
    id: int
    conversation_id: int
    from_user_id: int
    to_user_id: int
    message_type: str = "text"
    plaintext: str
    file_name: Optional[str] = None
    file_mime: Optional[str] = None
    file_b64: Optional[str] = None
    created_at: datetime


class P2PHistoryResponse(BaseModel):
    items: list[MessageItem]
