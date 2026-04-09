"""
聊天编排服务 - 负责会话创建、QKE 密钥协商与密钥激活的完整业务编排。
从 chat_unified.py 路由中提取的业务逻辑层，遵循后端分层架构（路由层 -> 服务层 -> 数据层）。

职责：
  1. 创建 QKE 会话并运行协议（4人以上调用 QKEProtocol，否则轻量模拟）
  2. 创建 KeyEpoch、ConversationKeyMaterial 等密钥记录
  3. 记录 QKE 事件到数据库
  4. 派生 epoch 密钥并激活
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import secrets
from datetime import datetime
from typing import List, Tuple

from sqlalchemy.orm import Session

from app.models.v1_models import (
    Conversation,
    ConversationKeyMaterial,
    KeyEpoch,
    QKEEvent,
    QKERound,
    QKESession,
    QKESessionMember,
    UserQuantumIdentity,
)
from app.core.security import derive_epoch_key
from app.services.qke_engine.qke_core import QKEProtocol

logger = logging.getLogger(__name__)


# ==================== 辅助函数 ====================


def resolve_protocol_path(participant_count: int) -> str:
    """根据参与者人数选择协议路径"""
    if participant_count <= 2:
        return "Bell-2"
    if participant_count == 3:
        return "GHZ-3"
    return "GHZ-4+QKD"


def add_qke_event(
    db: Session,
    *,
    qke_session_id: int,
    conversation_id: int,
    event_type: str,
    event_stage: str,
    title: str,
    detail: dict | None = None,
    round_number: int | None = None,
    severity: str = "info",
) -> None:
    """记录 QKE 事件到数据库"""
    db.add(
        QKEEvent(
            qke_session_id=qke_session_id,
            conversation_id=conversation_id,
            round_number=round_number,
            event_type=event_type,
            event_stage=event_stage,
            severity=severity,
            title=title,
            detail_json=json.dumps(detail or {}, ensure_ascii=False),
            event_time=datetime.utcnow(),
        )
    )


def build_lightweight_rounds(
    participant_count: int, key_length: int
) -> Tuple[List[dict], dict]:
    """构建轻量轮次数据（用于 2-3 人的简化模拟路径）"""
    protocol_path = resolve_protocol_path(participant_count)
    state_type = (
        "Bell"
        if participant_count <= 2
        else "GHZ-3"
        if participant_count == 3
        else "GHZ-4"
    )
    rounds = [
        {
            "round_number": 1,
            "group_type": protocol_path,
            "state_type": state_type,
            "participants": list(range(1, participant_count + 1)),
            "qubits_used": max(2, min(4, participant_count)),
            "diff_positions": sorted(
                secrets.randbelow(max(1, key_length))
                for _ in range(min(3, key_length))
            ),
        }
    ]
    metrics = {
        "latency_ms": 120 + participant_count * 10,
        "quantum_cost": rounds[0]["qubits_used"] * key_length,
        "classical_cost": max(8, participant_count * 4),
    }
    return rounds, metrics


# ==================== 核心编排方法 ====================


def run_qke_and_activate_epoch(
    db: Session,
    *,
    conversation: Conversation,
    member_ids: List[int],
    trigger_type: str,
    created_by: int,
) -> Tuple[int, int, str]:
    """
    执行完整的 QKE 协商流程并激活密钥轮次。

    这是创建会话时 QKE 密钥协商的核心编排方法：
      1. 创建 QKESession 记录
      2. 记录事件（创建、参与者确认、领导者选举）
      3. 运行量子协议（4人以上使用 QKEProtocol，否则轻量模拟）
      4. 创建 QKESessionMember 记录
      5. 创建 QKERound 记录并记录轮次事件
      6. 生成共享密钥、创建 KeyEpoch 和 ConversationKeyMaterial
      7. 激活 conversation 的密钥状态

    Args:
        db: 数据库会话
        conversation: 目标会话
        member_ids: 成员用户 ID 列表
        trigger_type: 触发类型（initial / rekey / manual）
        created_by: 发起者用户 ID

    Returns:
        (qke_session_id, epoch_no, protocol_path) 三元组
    """
    key_length = 64
    participant_count = len(member_ids)
    protocol_path = resolve_protocol_path(participant_count)

    # ---------- 1. 创建 QKE 会话记录 ----------
    qke_session = QKESession(
        session_no=f"qke-{conversation.id}-{int(datetime.utcnow().timestamp())}-{secrets.token_hex(2)}",
        conversation_id=conversation.id,
        trigger_type=trigger_type,
        scene_type=conversation.type,
        protocol_name="QKE-UNIFIED",
        protocol_version="v1",
        participant_count=participant_count,
        leader_count=4 if participant_count >= 4 else 1,
        key_length=key_length,
        decoy_count=8,
        status="running",
        start_time=datetime.utcnow(),
        created_by=created_by,
    )
    db.add(qke_session)
    db.flush()

    add_qke_event(
        db,
        qke_session_id=qke_session.id,
        conversation_id=conversation.id,
        event_type="session_created",
        event_stage="created",
        title="QKE会话已创建",
        detail={
            "participant_count": participant_count,
            "protocol_path": protocol_path,
        },
    )
    add_qke_event(
        db,
        qke_session_id=qke_session.id,
        conversation_id=conversation.id,
        event_type="participants_resolved",
        event_stage="assign_role",
        title="会话参与者已确认",
        detail={"member_ids": member_ids},
    )

    leaders = member_ids[: (4 if participant_count >= 4 else 1)]
    add_qke_event(
        db,
        qke_session_id=qke_session.id,
        conversation_id=conversation.id,
        event_type="leaders_elected",
        event_stage="assign_role",
        title="领导者选举完成",
        detail={"leaders": leaders},
    )

    # ---------- 2. 运行量子协议 ----------
    rounds_payload: List[dict]
    metrics: dict
    shared_bits: str

    if participant_count >= 4:
        rounds_payload, metrics, shared_bits = _run_full_qke_protocol(
            participant_count, key_length, protocol_path
        )
    else:
        rounds_payload, metrics = build_lightweight_rounds(
            participant_count, key_length
        )
        shared_bits = "".join(
            str(secrets.randbelow(2)) for _ in range(key_length)
        )
        # 轻量路径：基于共享比特估算 QBER（模拟低噪声量子信道）
        ones_count = shared_bits.count("1")
        zeros_count = shared_bits.count("0")
        total_bits = len(shared_bits)
        if total_bits > 0:
            ideal_ratio = 0.5
            actual_ratio = ones_count / total_bits
            metrics["qber"] = round(abs(actual_ratio - ideal_ratio), 4)
        else:
            metrics["qber"] = 0.02
        # 轻量路径：估算熵值
        metrics["entropy"] = _estimate_entropy(shared_bits)

    # ---------- 3. 创建 QKESessionMember 记录 ----------
    for user_id in member_ids:
        logical_role = "leader" if user_id in leaders else "follower"
        identity = (
            db.query(UserQuantumIdentity)
            .filter(UserQuantumIdentity.user_id == user_id)
            .first()
        )
        private_key_digest = identity.identity_key_digest if identity else None
        db.add(
            QKESessionMember(
                qke_session_id=qke_session.id,
                user_id=user_id,
                logical_role=logical_role,
                threat_role="normal",
                private_key_digest=private_key_digest,
                shared_key_digest=hashlib.sha256(
                    shared_bits.encode("utf-8")
                ).hexdigest()[:16],
                status="synced",
            )
        )

    # ---------- 4. 创建 QKERound 记录并记录轮次事件 ----------
    for r in rounds_payload:
        round_no = int(r.get("round_number", 1))
        add_qke_event(
            db,
            qke_session_id=qke_session.id,
            conversation_id=conversation.id,
            round_number=round_no,
            event_type="round_started",
            event_stage="quantum_exchange",
            title=f"第{round_no}轮开始",
            detail={
                "group_type": r.get("group_type"),
                "state_type": r.get("state_type"),
            },
        )
        db.add(
            QKERound(
                qke_session_id=qke_session.id,
                round_number=round_no,
                group_type=r.get("group_type"),
                state_type=r.get("state_type"),
                participant_ids_json=json.dumps(
                    r.get("participants", []), ensure_ascii=False
                ),
                qasm_text=r.get("qasm", ""),
                qubits_used=int(r.get("qubits_used", 0)),
                diff_positions_json=json.dumps(
                    r.get("diff_positions", []), ensure_ascii=False
                ),
                total_bit_flips=len(r.get("diff_positions", [])),
                round_latency_ms=max(
                    40,
                    int(
                        (metrics.get("latency_ms", 200))
                        / max(1, len(rounds_payload))
                    ),
                ),
                round_status="success",
                started_at=datetime.utcnow(),
                finished_at=datetime.utcnow(),
            )
        )
        add_qke_event(
            db,
            qke_session_id=qke_session.id,
            conversation_id=conversation.id,
            round_number=round_no,
            event_type="round_measured",
            event_stage="measure",
            title=f"第{round_no}轮测量完成",
            detail={"diff_positions": r.get("diff_positions", [])},
        )

    # ---------- 5. 更新 QKE 会话状态 ----------
    qke_session.status = "completed"
    qke_session.end_time = datetime.utcnow()
    qke_session.latency_ms = int(metrics.get("latency_ms", 0))
    qke_session.quantum_cost = int(metrics.get("quantum_cost", 0))
    qke_session.classical_cost = int(metrics.get("classical_cost", 0))
    qke_session.final_key_fingerprint = hashlib.sha256(
        shared_bits.encode("utf-8")
    ).hexdigest()[:16]
    qke_session.key_rate = round(
        (key_length / max(1, qke_session.latency_ms)) * 1000, 4
    )
    qke_session.entropy = metrics.get("entropy", 0.98)
    qke_session.qber = metrics.get("qber", 0.02)

    add_qke_event(
        db,
        qke_session_id=qke_session.id,
        conversation_id=conversation.id,
        event_type="key_generated",
        event_stage="verify",
        title="共享会话密钥已生成",
        detail={
            "fingerprint": qke_session.final_key_fingerprint,
            "key_length": key_length,
        },
    )

    # ---------- 6. 创建 KeyEpoch 和 ConversationKeyMaterial ----------
    next_epoch = (conversation.current_key_epoch or 0) + 1
    key_fingerprint = hashlib.sha256(
        shared_bits.encode("utf-8")
    ).hexdigest()[:16]
    db.add(
        KeyEpoch(
            conversation_id=conversation.id,
            qke_session_id=qke_session.id,
            epoch_no=next_epoch,
            key_fingerprint=key_fingerprint,
            key_length=key_length,
            entropy=qke_session.entropy,
            qber=qke_session.qber,
            rotate_reason=trigger_type,
            status="active",
        )
    )

    # 派生 epoch 密钥
    identity_parts: List[str] = []
    for uid in member_ids:
        identity = (
            db.query(UserQuantumIdentity)
            .filter(UserQuantumIdentity.user_id == uid)
            .first()
        )
        identity_parts.append(
            identity.identity_private_key if identity else "I"
        )
    identity_material = "|".join(identity_parts)
    epoch_key = derive_epoch_key(identity_material, shared_bits, next_epoch)
    db.add(
        ConversationKeyMaterial(
            conversation_id=conversation.id,
            epoch_no=next_epoch,
            key_material_b64=base64.b64encode(epoch_key).decode("utf-8"),
        )
    )

    # ---------- 7. 激活 conversation 密钥状态 ----------
    conversation.current_key_epoch = next_epoch
    conversation.qke_status = "active"
    conversation.member_count = participant_count
    conversation.updated_at = datetime.utcnow()

    add_qke_event(
        db,
        qke_session_id=qke_session.id,
        conversation_id=conversation.id,
        event_type="epoch_activated",
        event_stage="activate",
        title="密钥代次已激活",
        detail={"epoch_no": next_epoch, "protocol_path": protocol_path},
    )

    return qke_session.id, next_epoch, protocol_path


def _run_full_qke_protocol(
    participant_count: int, key_length: int, protocol_path: str
) -> Tuple[List[dict], dict, str]:
    """
    对 4 人及以上场景调用完整的 QKEProtocol。

    Returns:
        (rounds_payload, metrics, shared_bits)
    """
    try:
        protocol = QKEProtocol(
            num_participants=participant_count,
            m_value=key_length,
            decoy_count=8,
        )
        protocol.initialize_participants()
        result = protocol.run_full_protocol()

        rounds_payload = []
        for r in result.get("rounds", []):
            rounds_payload.append(
                {
                    "round_number": r.get("round_number", 1),
                    "group_type": r.get("group_type", protocol_path),
                    "state_type": r.get("state_type", "GHZ-4"),
                    "participants": r.get("participants", []),
                    "qasm": r.get("qasm", ""),
                    "qubits_used": r.get("qubits_used", 4),
                    "diff_positions": (r.get("key_synchronization") or {}).get(
                        "diff_positions", []
                    ),
                }
            )
        stats = result.get("statistics", {})
        metrics = {
            "latency_ms": int((stats.get("latency") or 0) * 1000),
            "quantum_cost": int(stats.get("quantum_cost") or 0),
            "classical_cost": int(stats.get("classical_cost") or 0),
            "qber": float(stats.get("qber") or 0.02),
            "entropy": _calculate_entropy_from_result(result),
        }
        final_key = result.get("final_key") or []
        shared_bits = (
            "".join(str(bit) for bit in final_key)
            or secrets.token_hex(16)
        )
    except Exception:
        logger.warning(
            "QKEProtocol 执行失败，降级为轻量模拟", exc_info=True
        )
        rounds_payload, metrics = build_lightweight_rounds(
            participant_count, key_length
        )
        shared_bits = "".join(
            str(secrets.randbelow(2)) for _ in range(key_length)
        )

    return rounds_payload, metrics, shared_bits


def _calculate_entropy_from_result(result: dict) -> float:
    """从协议结果中计算或提取熵值"""
    stats = result.get("statistics", {})
    # 协议结果中可能直接包含熵值
    if "entropy" in stats and stats["entropy"]:
        return float(stats["entropy"])
    # 否则从最终密钥估算
    final_key = result.get("final_key") or []
    if not final_key:
        return 0.98
    return _estimate_entropy_from_bits(final_key)


def _estimate_entropy(shared_bits_str: str) -> float:
    """从比特字符串估算香农熵"""
    if not shared_bits_str:
        return 0.0
    from collections import Counter
    import math

    freq = Counter(shared_bits_str)
    total = len(shared_bits_str)
    entropy = 0.0
    for count in freq.values():
        p = count / total
        if p > 0:
            entropy -= p * math.log2(p)
    return round(entropy, 4)


def _estimate_entropy_from_bits(bits: list) -> float:
    """从比特列表估算香农熵"""
    return _estimate_entropy("".join(str(b) for b in bits))
