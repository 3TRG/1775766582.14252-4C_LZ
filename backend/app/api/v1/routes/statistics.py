from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models import get_db
from app.models.v1_models import Department, QKERound, QKESession
from app.schemas.statistics import (
    Page3ChartResponse,
    Page3FiltersResponse,
    Page3KpisResponse,
    Page3KeyQualityResponse,
)

router = APIRouter()


@router.get("/kpis", response_model=Page3KpisResponse)
async def page3_kpis(
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    scene_type: Optional[str] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    sessions = db.query(QKESession).all()
    if scene_type:
        sessions = [s for s in sessions if s.scene_type == scene_type]

    key_rate_avg = float(sum((s.key_rate or 0) for s in sessions) / len(sessions)) if sessions else 0.0
    latency_total_sec = float(sum(((s.latency_ms or 0) / 1000.0) for s in sessions)) if sessions else 0.0
    quantum_cost_total = int(sum((s.quantum_cost or 0) for s in sessions)) if sessions else 0
    entropy_avg = float(sum((s.entropy or 0) for s in sessions) / len(sessions)) if sessions else 0.0
    qber_avg = float(sum((s.qber or 0) for s in sessions) / len(sessions)) if sessions else 0.0

    rounds = db.query(QKERound).all()
    round_latency_avg_ms = int(sum((r.round_latency_ms or 0) for r in rounds) / len(rounds)) if rounds else 0

    return Page3KpisResponse(
        key_rate_avg=key_rate_avg,
        latency_total_sec=latency_total_sec,
        quantum_cost_total=quantum_cost_total,
        security_detection_rate=1.0,
        entropy_avg=entropy_avg,
        qber_avg=qber_avg,
        round_latency_avg_ms=round_latency_avg_ms,
        rekey_rate=0.23,
    )


@router.get("/resource-consumption", response_model=Page3ChartResponse)
async def page3_resource_consumption(db: Session = Depends(get_db)):
    rounds = db.query(QKERound).order_by(QKERound.round_number.asc()).all()
    if not rounds:
        x_axis = ["QKA轮次", "QKD轮次1", "QKD轮次2", "QKD轮次3"]
        return Page3ChartResponse(
            x_axis=x_axis,
            series=[
                {"name": "量子资源", "type": "bar", "data": [4, 4, 3, 2]},
                {"name": "经典资源", "type": "bar", "data": [10, 15, 12, 8]},
            ],
        )
    x_axis = [f"轮次{r.round_number}" for r in rounds]
    return Page3ChartResponse(
        x_axis=x_axis,
        series=[
            {"name": "量子资源", "type": "bar", "data": [r.qubits_used or 0 for r in rounds]},
            {"name": "经典资源", "type": "bar", "data": [max(1, (r.total_bit_flips or 0) + 5) for r in rounds]},
        ],
    )


@router.get("/round-performance", response_model=Page3ChartResponse)
async def page3_round_performance(db: Session = Depends(get_db)):
    rounds = db.query(QKERound).order_by(QKERound.round_number.asc()).all()
    if not rounds:
        return Page3ChartResponse(
            x_axis=["轮次1", "轮次2", "轮次3", "轮次4", "轮次5"],
            series=[
                {"name": "密钥生成率", "type": "line", "data": [130, 100, 180, 178, 185]},
                {"name": "延迟", "type": "line", "data": [0.15, 0.28, 0.29, 0.22, 0.16]},
            ],
        )
    x_axis = [f"轮次{r.round_number}" for r in rounds]
    # demo：用 qubits/bitflips 近似出一条“速率”和“延迟”
    rate = [(r.qubits_used or 1) * 50 for r in rounds]
    latency = [((r.round_latency_ms or 400) / 1000.0) for r in rounds]
    return Page3ChartResponse(
        x_axis=x_axis,
        series=[
            {"name": "密钥生成率", "type": "line", "data": rate},
            {"name": "延迟", "type": "line", "data": latency},
        ],
    )


@router.get("/key-quality", response_model=Page3KeyQualityResponse)
async def page3_key_quality(db: Session = Depends(get_db)):
    sessions = db.query(QKESession).all()
    x_axis = list(range(1, 11))
    data = []
    if sessions and any(s.entropy is not None for s in sessions):
        # 取最新会话 entropy 作为基准曲线
        base = sessions[-1].entropy or 0.5
        data = [min(1.0, max(0.0, base * (i / 10.0))) for i in range(1, 11)]
    else:
        data = [0.12, 0.18, 0.16, 0.24, 0.29, 0.31, 0.40, 0.38, 0.49, 0.53]

    entropy_avg = float(sum((s.entropy or 0) for s in sessions) / len(sessions)) if sessions else 0.981
    return Page3KeyQualityResponse(
        x_axis=x_axis,
        series=[{"name": "熵值", "type": "line", "data": data}],
        summary={
            "entropy_avg": entropy_avg,
            "effective_key_ratio": 0.74,
            "bit_flip_density": 0.08,
        },
    )


@router.get("/security-trend", response_model=Page3ChartResponse)
async def page3_security_trend(db: Session = Depends(get_db)):
    return Page3ChartResponse(
        x_axis=["03-01", "03-02", "03-03", "03-04"],
        series=[
            {"name": "异常会话数", "type": "line", "data": [2, 1, 3, 1]},
            {"name": "恶意节点命中数", "type": "bar", "data": [1, 0, 2, 1]},
        ],
    )


@router.get("/filters", response_model=Page3FiltersResponse)
async def page3_filters(db: Session = Depends(get_db)):
    deps = db.query(Department).order_by(Department.id.asc()).all()
    return Page3FiltersResponse(
        scene_types=["private", "group", "meeting"],
        departments=[{"id": d.id, "name": d.name} for d in deps],
        protocol_versions=["v1", "v2"],
    )

