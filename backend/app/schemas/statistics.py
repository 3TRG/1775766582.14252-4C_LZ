from __future__ import annotations

from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class Page3KpisResponse(BaseModel):
    key_rate_avg: float
    latency_total_sec: float
    quantum_cost_total: int
    security_detection_rate: float
    entropy_avg: float
    qber_avg: float
    round_latency_avg_ms: int
    rekey_rate: float


class ChartSeries(BaseModel):
    name: str
    type: str
    data: List[Any]


class Page3ChartResponse(BaseModel):
    x_axis: List[Any]
    series: List[ChartSeries]


class Page3KeyQualitySummary(BaseModel):
    entropy_avg: float
    effective_key_ratio: float
    bit_flip_density: float


class Page3KeyQualityResponse(Page3ChartResponse):
    summary: Page3KeyQualitySummary


class Page3FiltersDepartment(BaseModel):
    id: int
    name: str


class Page3FiltersResponse(BaseModel):
    scene_types: List[str]
    departments: List[Page3FiltersDepartment]
    protocol_versions: List[str]

