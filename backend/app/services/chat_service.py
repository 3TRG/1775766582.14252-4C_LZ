from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.v1_models import (
    Conversation, ConversationMember, Message, MessageReceipt,
    Contact, User, KeyEpoch, QKESession
)
from app.services.qke_service import QKEService
from app.services.encryption_service import EncryptionService


class ChatService:
    """聊天服务"""
    
    def __init__(self, db: Session):
        self.db = db
        self.qke_service = QKEService(db)
    
    async def create_conversation(
        self,
        creator_id: int,
        participant_ids: List[int],
        type: str = "private",
        name: Optional[str] = None,
        description: Optional[str] = None
    ) -> Conversation:
        """
        创建聊天会话并自动触发QKE
        """
        # 验证参与者
        all_participants = list(set([creator_id] + participant_ids))
        if len(all_participants) < 2:
            raise ValueError("至少需要两个参与者")
        
        # 检查是否已存在相同的私聊会话
        if type == "private" and len(all_participants) == 2:
            existing_conversation = self._find_private_conversation(
                all_participants[0], all_participants[1]
            )
            if existing_conversation:
                return existing_conversation
        
        # 生成会话编号
        conversation_no = f"conv-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{hashlib.md5(str(creator_id).encode()).hexdigest()[:8]}"
        
        # 创建会话
        conversation = Conversation(
            conversation_no=conversation_no,
            type=type,
            name=name,
            description=description,
            owner_user_id=creator_id,
            secure_mode="qke",
            qke_status="idle",
            member_count=len(all_participants),
            status="active",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.db.add(conversation)
        self.db.flush()
        
        # 添加成员
        for user_id in all_participants:
            member = ConversationMember(
                conversation_id=conversation.id,
                user_id=user_id,
                member_role="owner" if user_id == creator_id else "member",
                status="active",
                joined_at=datetime.utcnow()
            )
            self.db.add(member)
        
        # 自动触发QKE
        qke_session = await self.qke_service.create_qke_session(
            conversation_id=conversation.id,
            participant_ids=all_participants,
            trigger_type="initial",
            scene_type=type
        )
        
        # 执行QKE协议
        await self.qke_service.execute_qke_protocol(qke_session.id)
        
        self.db.commit()
        self.db.refresh(conversation)
        
        return conversation
    
    async def send_message(
        self,
        sender_id: int,
        conversation_id: int,
        content: str,
        message_type: str = "text"
    ) -> Message:
        """
        发送消息
        """
        # 验证发送者是否为会话成员
        if not self._is_member(conversation_id, sender_id):
            raise ValueError("发送者不是会话成员")
        
        # 获取会话
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            raise ValueError("会话不存在")
        
        # 获取当前密钥轮次
        current_epoch = conversation.current_key_epoch
        if not current_epoch:
            # 如果没有密钥，触发QKE
            members = self._get_conversation_members(conversation_id)
            member_ids = [m.user_id for m in members]
            
            qke_session = await self.qke_service.create_qke_session(
                conversation_id=conversation.id,
                participant_ids=member_ids,
                trigger_type="message_trigger",
                scene_type=conversation.type
            )
            
            await self.qke_service.execute_qke_protocol(qke_session.id)
            
            # 重新获取会话
            conversation = self.db.query(Conversation).filter(
                Conversation.id == conversation_id
            ).first()
            current_epoch = conversation.current_key_epoch
        
        # 获取当前密钥轮次信息
        key_epoch = self.db.query(KeyEpoch).filter(
            KeyEpoch.conversation_id == conversation_id,
            KeyEpoch.epoch_no == current_epoch
        ).first()
        
        if not key_epoch:
            raise ValueError("密钥轮次不存在")
        
        # 这里应该从量子密钥存储中获取实际的量子密钥
        # 为了演示，我们使用密钥指纹作为临时密钥
        quantum_key = key_epoch.key_fingerprint
        
        # 使用量子密钥加密消息
        encrypted_data = EncryptionService.encrypt_with_quantum_key(
            content,
            quantum_key,
            f"message_{conversation_id}_{current_epoch}"
        )
        
        # 记录消息加密事件到QKE过程
        last_qke_session = self.db.query(QKESession).filter(
            QKESession.conversation_id == conversation_id
        ).order_by(QKESession.id.desc()).first()
        
        if last_qke_session:
            # 导入QKEEvent模型
            from app.models.v1_models import QKEEvent
            import json
            
            # 记录消息加密事件
            message_encrypt_event = QKEEvent(
                qke_session_id=last_qke_session.id,
                conversation_id=conversation_id,
                event_type="message_encrypted",
                event_stage="transport",
                severity="info",
                title="消息已使用量子密钥加密",
                detail_json=json.dumps({
                    "sender_id": sender_id,
                    "message_type": message_type,
                    "key_epoch": current_epoch,
                    "message_length": len(content),
                    "encryption_algorithm": "AES-GCM",
                    "timestamp": datetime.utcnow().isoformat()
                }, ensure_ascii=False),
                event_time=datetime.utcnow()
            )
            self.db.add(message_encrypt_event)
        
        # 计算明文摘要
        plaintext_digest = EncryptionService.calculate_message_digest(content)
        
        # 生成消息序号
        last_message = self.db.query(Message).filter(
            Message.conversation_id == conversation_id
        ).order_by(Message.message_seq.desc()).first()
        message_seq = (last_message.message_seq + 1) if last_message else 1
        
        # 生成AAD
        aad = EncryptionService.generate_aad(
            conversation_id,
            message_seq,
            encrypted_data["timestamp"]
        )
        
        # 创建消息
        message = Message(
            conversation_id=conversation_id,
            sender_user_id=sender_id,
            message_type=message_type,
            plaintext_digest=plaintext_digest,
            ciphertext=encrypted_data["ciphertext"],
            nonce=encrypted_data["nonce"],
            aad=aad,
            encryption_alg="AES-GCM",
            key_epoch=current_epoch,
            message_seq=message_seq,
            send_status="sent",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.db.add(message)
        self.db.flush()
        
        # 创建消息回执
        members = self._get_conversation_members(conversation_id)
        for member in members:
            receipt = MessageReceipt(
                message_id=message.id,
                user_id=member.user_id
            )
            self.db.add(receipt)
        
        # 更新会话最后消息信息
        conversation.last_message_id = message.id
        conversation.last_message_at = message.created_at
        conversation.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(message)
        
        return message
    
    async def get_conversation_messages(
        self,
        user_id: int,
        conversation_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        获取会话消息
        """
        # 验证用户是否为会话成员
        if not self._is_member(conversation_id, user_id):
            raise ValueError("用户不是会话成员")
        
        # 获取消息
        messages = self.db.query(Message).filter(
            Message.conversation_id == conversation_id
        ).order_by(
            Message.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        # 标记消息为已读
        for message in messages:
            receipt = self.db.query(MessageReceipt).filter(
                MessageReceipt.message_id == message.id,
                MessageReceipt.user_id == user_id
            ).first()
            if receipt and not receipt.read_at:
                receipt.read_at = datetime.utcnow()
        
        self.db.commit()
        
        # 处理消息（解密等）
        processed_messages = []
        for message in messages:
            # 这里应该从量子密钥存储中获取实际的量子密钥进行解密
            # 为了演示，我们暂时只返回加密的消息
            processed_messages.append({
                "message_id": message.id,
                "sender_id": message.sender_user_id,
                "message_type": message.message_type,
                "ciphertext": message.ciphertext,
                "key_epoch": message.key_epoch,
                "message_seq": message.message_seq,
                "send_status": message.send_status,
                "created_at": message.created_at,
                "is_encrypted": True
            })
        
        return processed_messages
    
    async def add_contact(
        self,
        owner_id: int,
        target_id: int,
        remark_name: Optional[str] = None,
        group_name: Optional[str] = None
    ) -> Contact:
        """
        添加联系人
        """
        # 检查是否已存在
        existing = self.db.query(Contact).filter(
            Contact.owner_user_id == owner_id,
            Contact.target_user_id == target_id
        ).first()
        
        if existing:
            # 更新现有联系人
            if remark_name:
                existing.remark_name = remark_name
            if group_name:
                existing.group_name = group_name
            self.db.commit()
            self.db.refresh(existing)
            return existing
        
        # 创建新联系人
        contact = Contact(
            owner_user_id=owner_id,
            target_user_id=target_id,
            remark_name=remark_name,
            group_name=group_name,
            created_at=datetime.utcnow()
        )
        
        self.db.add(contact)
        self.db.commit()
        self.db.refresh(contact)
        
        return contact
    
    async def get_contacts(
        self,
        user_id: int,
        group_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        获取联系人列表
        """
        query = self.db.query(Contact, User).join(
            User, Contact.target_user_id == User.id
        ).filter(
            Contact.owner_user_id == user_id
        )
        
        if group_name:
            query = query.filter(Contact.group_name == group_name)
        
        contacts = query.all()
        
        result = []
        for contact, user in contacts:
            result.append({
                "contact_id": contact.id,
                "user_id": user.id,
                "username": user.username,
                "real_name": user.real_name,
                "phone": user.phone,
                "email": user.email,
                "remark_name": contact.remark_name,
                "group_name": contact.group_name,
                "online_status": user.online_status or "offline",
                "created_at": contact.created_at
            })
        
        return result
    
    def _find_private_conversation(
        self,
        user_a: int,
        user_b: int
    ) -> Optional[Conversation]:
        """
        查找私聊会话
        """
        pairs = self.db.query(Conversation.id).join(
            ConversationMember, ConversationMember.conversation_id == Conversation.id
        ).filter(
            Conversation.type == "private",
            ConversationMember.status == "active",
            ConversationMember.user_id.in_([user_a, user_b])
        ).group_by(
            Conversation.id
        ).having(
            func.count(ConversationMember.user_id) == 2
        ).all()
        
        if not pairs:
            return None
        
        conv_id = pairs[0][0]
        return self.db.query(Conversation).filter(
            Conversation.id == conv_id
        ).first()
    
    def _is_member(self, conversation_id: int, user_id: int) -> bool:
        """
        检查用户是否为会话成员
        """
        member = self.db.query(ConversationMember).filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
            ConversationMember.status == "active"
        ).first()
        
        return member is not None
    
    def _get_conversation_members(
        self,
        conversation_id: int
    ) -> List[ConversationMember]:
        """
        获取会话成员
        """
        return self.db.query(ConversationMember).filter(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.status == "active"
        ).all()
