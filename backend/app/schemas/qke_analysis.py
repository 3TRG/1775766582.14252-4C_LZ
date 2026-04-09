from __future__ import annotations

from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class Page2SessionItem(BaseModel):
    qke_session_id: int
    conversation_id: int
    conversation_name: str
    scene_type: str
    status: str
    participant_count: int
    trigger_type: str
    start_time: str


class Page2SessionsResponse(BaseModel):
    total: int
    items: List[Page2SessionItem]


class Page2OverviewConversation(BaseModel):
    id: int
    name: str
    type: str


class Page2OverviewResponse(BaseModel):
    qke_session_id: int
    conversation: Page2OverviewConversation
    status: str
    protocol_name: str
    protocol_version: str
    participant_count: int
    leader_count: int
    current_round: int
    current_stage: str
    key_length: int
    decoy_count: int
    start_time: str


class Page2ParticipantItem(BaseModel):
    user_id: int
    real_name: str
    logical_role: str
    threat_role: str
    participant_order: int
    private_key_digest: Optional[str] = None
    shared_key_digest: Optional[str] = None
    status: str
    current_round_status: str
    error_contribution: float


class Page2ParticipantsResponse(BaseModel):
    items: List[Page2ParticipantItem]


class Page2EventItem(BaseModel):
    id: int
    event_time: str
    round_number: Optional[int] = None
    event_stage: str
    event_type: str
    severity: str
    title: str
    detail: Dict[str, Any]


class Page2EventsResponse(BaseModel):
    items: List[Page2EventItem]
    next_cursor: Optional[str] = None


class Page2RoundDecoyInfo(BaseModel):
    positions: List[int]
    bases: List[str]
    states: List[int]
    count: int


class Page2RoundKeySync(BaseModel):
    diff_positions: List[int]
    total_bit_flips: int


class Page2RoundDetail(BaseModel):
    round_number: int
    group_type: str
    state_type: str
    leader_user_id: Optional[int] = None
    participants: List[int]
    qasm_text: Optional[str] = None
    circuit_diagram_url: Optional[str] = None
    qubits_used: int
    decoy_info: Optional[Page2RoundDecoyInfo] = None
    key_synchronization: Optional[Page2RoundKeySync] = None
    round_latency_ms: Optional[int] = None
    round_status: str


class Page2KeyStreamResponse(BaseModel):
    epoch_no: int
    key_length: int
    preview_bits: str
    entropy: Optional[float] = None
    qber: Optional[float] = None
    privacy_amplification_ratio: Optional[float] = None
    status: str

