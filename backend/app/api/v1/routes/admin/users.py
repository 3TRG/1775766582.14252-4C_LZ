"""管理端：用户列表 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models import get_db
from app.models.v1_models import (
    User, UserDevice, UserQuantumIdentity, Contact, Department,
    Conversation, ConversationMember, Message, MessageReceipt,
    Meeting, QKESession, QKESessionMember, QKERound, QKEEvent,
    SecurityAlert, AuditLog, SystemConfig,
)

router = APIRouter()


@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    """获取系统所有用户列表（含在线状态）"""
    rows = db.query(User).all()
    return {
        "users": [
            {
                "user_id": u.id,
                "username": u.username,
                "phone": u.phone or "",
                "email": getattr(u, "email", ""),
                "role": "leader",
                "is_online": u.online_status == "online",
                "created_at": u.created_at.isoformat() if getattr(u, "created_at", None) else None,
            }
            for u in rows
        ]
    }


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """删除用户及其关联数据"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 将 nullable 外键置空（部门管理者、会议组织者）
    for dept in db.query(Department).filter(Department.manager_user_id == user_id).all():
        dept.manager_user_id = None
    for mtg in db.query(Meeting).filter(Meeting.organizer_user_id == user_id).all():
        mtg.organizer_user_id = None

    # 删除直接关联的用户私有数据
    db.query(UserDevice).filter(UserDevice.user_id == user_id).delete()
    db.query(UserQuantumIdentity).filter(UserQuantumIdentity.user_id == user_id).delete()
    db.query(Contact).filter(Contact.owner_user_id == user_id).delete()
    db.query(Contact).filter(Contact.target_user_id == user_id).delete()
    db.query(MessageReceipt).filter(MessageReceipt.user_id == user_id).delete()
    db.query(AuditLog).filter(AuditLog.operator_user_id == user_id).delete()

    # 清理会话成员关系
    db.query(ConversationMember).filter(ConversationMember.user_id == user_id).delete()

    # 清理 QKE 会话成员关系
    db.query(QKESessionMember).filter(QKESessionMember.user_id == user_id).delete()

    # 将 nullable 外键置空（消息发送者、QKE轮次领导者、事件触发者等）
    for msg in db.query(Message).filter(Message.sender_user_id == user_id).all():
        msg.sender_user_id = None
    for rnd in db.query(QKERound).filter(QKERound.leader_user_id == user_id).all():
        rnd.leader_user_id = None
    for evt in db.query(QKEEvent).filter(QKEEvent.actor_user_id == user_id).all():
        evt.actor_user_id = None
    for alert in db.query(SecurityAlert).filter(SecurityAlert.resolved_by == user_id).all():
        alert.resolved_by = None
    for cfg in db.query(SystemConfig).filter(SystemConfig.updated_by == user_id).all():
        cfg.updated_by = None
    for conv in db.query(Conversation).filter(Conversation.owner_user_id == user_id).all():
        conv.owner_user_id = None
    for sess in db.query(QKESession).filter(QKESession.created_by == user_id).all():
        sess.created_by = None

    # 删除用户
    db.delete(user)
    db.commit()

    return {"message": "用户已删除", "user_id": user_id}
