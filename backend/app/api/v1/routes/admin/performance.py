"""
管理端 - 性能监控 API
提供性能指标查询和报告导出功能
"""

import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from datetime import datetime, timedelta
from typing import List, Optional

from pydantic import BaseModel

from app.models import get_db
from app.models.v1_models import (
    QKEMetricSnapshot,
    QKESession,
    SecurityAlert,
    User,
    Conversation,
    Message,
)
from app.core.security import parse_access_token


router = APIRouter(tags=["管理端 - 性能监控"])


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

class PerformanceMetric(BaseModel):
    timestamp: str
    qke_sessions_count: int
    active_users_count: int
    messages_per_minute: float
    avg_latency_ms: float
    key_generation_rate: float
    cpu_usage: float = 0.0
    memory_usage: float = 0.0
    network_in_mbps: float = 0.0
    network_out_mbps: float = 0.0


class PerformanceResponse(BaseModel):
    data: List[PerformanceMetric]


def _resolve_time_range(time_range: str):
    """将时间范围字符串解析为起始时间"""
    now = datetime.utcnow()
    if time_range == "1h":
        return now - timedelta(hours=1)
    elif time_range == "6h":
        return now - timedelta(hours=6)
    elif time_range == "24h":
        return now - timedelta(hours=24)
    elif time_range == "7d":
        return now - timedelta(days=7)
    elif time_range == "30d":
        return now - timedelta(days=30)
    else:
        return now - timedelta(hours=24)


# ==================== 路由 ====================

@router.get("/performance", response_model=PerformanceResponse)
def get_performance_metrics(
    range: str = "24h",
    user_id: int = Depends(_get_admin_user_id),
    db: Session = Depends(get_db),
):
    """获取性能指标"""
    _check_admin(db, user_id)

    start_time = _resolve_time_range(range)

    # 从 QKEMetricSnapshot 聚合性能数据
    snapshots = (
        db.query(QKEMetricSnapshot)
        .filter(QKEMetricSnapshot.metric_time >= start_time)
        .order_by(QKEMetricSnapshot.metric_time.asc())
        .limit(200)
        .all()
    )

    # 如果没有快照数据，从 QKESession 表实时计算
    if not snapshots:
        sessions = (
            db.query(QKESession)
            .filter(QKESession.start_time >= start_time)
            .all()
        )

        active_users = (
            db.query(User).filter(User.online_status == "online").count()
        )

        messages_count = (
            db.query(Message)
            .filter(Message.created_at >= start_time)
            .count()
        )

        elapsed_minutes = max(1, (datetime.utcnow() - start_time).total_seconds() / 60)
        avg_latency = (
            sum(s.latency_ms or 0 for s in sessions) / max(1, len(sessions))
        )
        avg_key_rate = (
            sum(s.key_rate or 0 for s in sessions) / max(1, len(sessions))
        )

        metrics = [PerformanceMetric(
            timestamp=datetime.utcnow().isoformat(),
            qke_sessions_count=len(sessions),
            active_users_count=active_users,
            messages_per_minute=round(messages_count / elapsed_minutes, 2),
            avg_latency_ms=round(avg_latency, 2),
            key_generation_rate=round(avg_key_rate, 4),
            cpu_usage=0.0,
            memory_usage=0.0,
            network_in_mbps=0.0,
            network_out_mbps=0.0,
        )]
    else:
        metrics = []
        for snap in snapshots:
            metrics.append(PerformanceMetric(
                timestamp=snap.metric_time.isoformat() if snap.metric_time else datetime.utcnow().isoformat(),
                qke_sessions_count=1,
                active_users_count=snap.participant_count or 0,
                messages_per_minute=0.0,
                avg_latency_ms=snap.latency_ms or 0,
                key_generation_rate=snap.key_rate or 0,
                cpu_usage=0.0,
                memory_usage=0.0,
                network_in_mbps=0.0,
                network_out_mbps=0.0,
            ))

    return {"data": metrics}


@router.get("/performance/export")
def export_performance_report(
    range: str = "24h",
    user_id: int = Depends(_get_admin_user_id),
    db: Session = Depends(get_db),
):
    """导出性能报告为 CSV"""
    _check_admin(db, user_id)

    start_time = _resolve_time_range(range)

    sessions = (
        db.query(QKESession)
        .filter(QKESession.start_time >= start_time)
        .order_by(QKESession.start_time.asc())
        .all()
    )

    # 生成 CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "会话ID", "会话编号", "场景", "协议", "参与者数",
        "密钥长度", "状态", "延迟(ms)", "量子成本", "经典成本",
        "熵值", "QBER", "密钥生成率", "开始时间", "结束时间"
    ])

    for s in sessions:
        writer.writerow([
            s.id,
            s.session_no,
            s.scene_type,
            s.protocol_name,
            s.participant_count,
            s.key_length,
            s.status,
            s.latency_ms or 0,
            s.quantum_cost or 0,
            s.classical_cost or 0,
            s.entropy or 0,
            s.qber or 0,
            s.key_rate or 0,
            s.start_time.isoformat() if s.start_time else "",
            s.end_time.isoformat() if s.end_time else "",
        ])

    output.seek(0)
    filename = f"performance-report-{range}-{datetime.utcnow().strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
