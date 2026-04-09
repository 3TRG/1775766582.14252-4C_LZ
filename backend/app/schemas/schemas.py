from pydantic import BaseModel, Field
from typing import List, Optional, Union
from datetime import datetime

class SessionCreate(BaseModel):
    participants: int = Field(..., ge=4, le=30, description="参与者数量")
    key_length: int = Field(..., ge=5, le=120, description="密钥长度")
    decoy_count: int = Field(..., ge=5, le=30, description="诱饵态数量")

class SessionResponse(BaseModel):
    session_id: str
    status: str
    config: dict

    class Config:
        from_attributes = True

class RunRequest(BaseModel):
    """运行 QKE 协议请求（恶意节点模型已移除）"""
    pass

class DecoyInfo(BaseModel):
    positions: List[int]
    bases: List[str]
    states: List[int]
    count: int

class KeySynchronization(BaseModel):
    diff_positions: List[int]
    total_bit_flips: int

class CircuitInfo(BaseModel):
    participant_id: int
    circuit_img: Optional[str] = None
    qasm: str

class RoundData(BaseModel):
    round_number: int
    group_type: str
    leader_id: Union[str, int]
    state_type: str
    participants: List[int]
    circuits: Optional[List[CircuitInfo]] = None
    circuit_img: Optional[str] = None
    qasm: Optional[str] = None
    qubits_used: int
    decoy_info: Optional[DecoyInfo] = None
    key_synchronization: Optional[KeySynchronization] = None

class ParticipantData(BaseModel):
    id: int
    private_key: List[int]
    is_leader: bool
    shared_key: Optional[List[int]] = None
    joined_at: str

class Statistics(BaseModel):
    quantum_cost: int
    pauli_ops: int
    bit_flips: int
    total_quantum_ops: int
    classical_cost: int
    latency: float
    key_rate: float

class SimulationResult(BaseModel):
    final_key: List[int]
    participants: List[ParticipantData]
    rounds: List[RoundData]
    statistics: Statistics

class RunResponse(BaseModel):
    status: str
    session_id: str
    result: SimulationResult

class ParticipantResponse(BaseModel):
    id: int
    original_id: str
    is_leader: bool
    # private_key and shared_key are intentionally excluded to prevent plaintext key exposure.
    key_fingerprint: Optional[str] = None
    joined_at: Optional[str] = None
    left_at: Optional[str] = None

class ParticipantsResponse(BaseModel):
    participants: List[ParticipantResponse]

class RoundResponse(BaseModel):
    round_number: int
    group_type: str
    leader_id: int
    state_type: str
    circuit_diagram: str
    qubits_used: int
    decoy_info: Optional[DecoyInfo] = None
    key_synchronization: Optional[KeySynchronization] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

class RoundsResponse(BaseModel):
    rounds: List[RoundResponse]


class AdminSessionListItem(BaseModel):
    session_id: str
    status: str
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
    total_participants: int
    key_length: int
    decoy_count: int


class AdminSessionsResponse(BaseModel):
    sessions: List[AdminSessionListItem]


class QKEEventResponse(BaseModel):
    id: int
    seq: int
    type: str
    level: int
    timestamp: str
    summary: str
    details: Optional[dict] = None

    class Config:
        from_attributes = True


class AdminSessionSnapshotResponse(BaseModel):
    session_id: str
    participants: List[ParticipantResponse]
    rounds: List[RoundResponse]
    statistics: Statistics
    events: List[QKEEventResponse]
