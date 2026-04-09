from __future__ import annotations

from pydantic import BaseModel
from typing import List, Optional


class Page1SummaryResponse(BaseModel):
    online_users: int
    offline_users: int
    negotiating_conversations: int
    active_secure_conversations: int
    today_rekey_count: int
    open_alerts: int
    avg_entropy: float
    avg_negotiation_latency_ms: int


class Page1ConversationRef(BaseModel):
    id: int
    name: str


class Page1UserItem(BaseModel):
    user_id: int
    username: str
    real_name: str
    department: Optional[str] = None
    online_status: str
    current_device: Optional[str] = None
    current_conversation: Optional[Page1ConversationRef] = None
    current_key_epoch: int
    latest_qke_status: str
    latest_negotiation_time: Optional[str] = None
    risk_tags: List[str]
    last_seen_at: Optional[str] = None


class Page1UsersResponse(BaseModel):
    total: int
    items: List[Page1UserItem]


class Page1TopologyConversation(BaseModel):
    id: int
    name: str
    type: str


class Page1TopologyNode(BaseModel):
    user_id: int
    label: str
    logical_role: str
    threat_role: str
    online_status: str
    risk_score: float


class Page1TopologyEdge(BaseModel):
    source: int
    target: int
    relation: str
    status: str


class Page1TopologyResponse(BaseModel):
    conversation: Page1TopologyConversation
    nodes: List[Page1TopologyNode]
    edges: List[Page1TopologyEdge]


class Page1UserDetailUser(BaseModel):
    id: int
    real_name: str
    department: Optional[str] = None
    online_status: str
    last_login_at: Optional[str] = None


class Page1UserDetailDevice(BaseModel):
    device_name: str
    trust_level: str
    last_active_at: Optional[str] = None


class Page1UserDetailConversation(BaseModel):
    conversation_id: int
    conversation_name: str
    qke_status: str
    key_epoch: int


class Page1UserDetailQKESession(BaseModel):
    qke_session_id: int
    status: str
    entropy: Optional[float] = None
    qber: Optional[float] = None


class Page1UserDetailResponse(BaseModel):
    user: Page1UserDetailUser
    devices: List[Page1UserDetailDevice]
    recent_conversations: List[Page1UserDetailConversation]
    recent_qke_sessions: List[Page1UserDetailQKESession]

