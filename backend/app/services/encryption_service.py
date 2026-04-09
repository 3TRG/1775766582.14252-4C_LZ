from __future__ import annotations

import base64
import hashlib
import hmac
from datetime import datetime
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.backends import default_backend


class EncryptionService:
    """加密服务"""
    
    @staticmethod
    def generate_key_from_seed(seed: str, info: bytes = b"") -> bytes:
        """
        从种子派生密钥
        """
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=info,
            backend=default_backend()
        )
        key = hkdf.derive(seed.encode('utf-8'))
        return base64.urlsafe_b64encode(key)
    
    @staticmethod
    def encrypt_message(message: str, key: bytes) -> str:
        """
        加密消息
        """
        f = Fernet(key)
        return f.encrypt(message.encode('utf-8')).decode('utf-8')
    
    @staticmethod
    def decrypt_message(encrypted_message: str, key: bytes) -> str:
        """
        解密消息
        """
        f = Fernet(key)
        return f.decrypt(encrypted_message.encode('utf-8')).decode('utf-8')
    
    @staticmethod
    def generate_epoch_key(master_key: str, epoch: int, conversation_id: int) -> bytes:
        """
        生成轮密钥
        """
        info = f"epoch_{epoch}_conversation_{conversation_id}".encode('utf-8')
        return EncryptionService.generate_key_from_seed(master_key, info)
    
    @staticmethod
    def generate_message_key(
        epoch_key: bytes,
        message_id: int,
        timestamp: str
    ) -> bytes:
        """
        生成消息级密钥
        """
        info = f"message_{message_id}_{timestamp}".encode('utf-8')
        # 使用HKDF从轮密钥派生消息密钥
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=info,
            backend=default_backend()
        )
        key = hkdf.derive(epoch_key)
        return base64.urlsafe_b64encode(key)
    
    @staticmethod
    def generate_key_fingerprint(key: bytes) -> str:
        """
        生成密钥指纹
        """
        return hashlib.sha256(key).hexdigest()[:16]
    
    @staticmethod
    def verify_key_integrity(key: bytes, fingerprint: str) -> bool:
        """
        验证密钥完整性
        """
        return EncryptionService.generate_key_fingerprint(key) == fingerprint
    
    @staticmethod
    def generate_nonce() -> str:
        """
        生成随机nonce
        """
        return base64.urlsafe_b64encode(hashlib.sha256(
            (str(datetime.utcnow()) + str(hashlib.randbytes(32))).encode()
        ).digest()).decode('utf-8')
    
    @staticmethod
    def generate_aad(conversation_id: int, message_seq: int, timestamp: str) -> str:
        """
        生成额外认证数据
        """
        aad_data = f"conv_{conversation_id}_seq_{message_seq}_{timestamp}"
        return hashlib.sha256(aad_data.encode()).hexdigest()
    
    @staticmethod
    def derive_key_from_quantum(quantum_key: str, purpose: str) -> bytes:
        """
        从量子密钥派生特定用途的密钥
        """
        info = purpose.encode('utf-8')
        return EncryptionService.generate_key_from_seed(quantum_key, info)
    
    @staticmethod
    def encrypt_with_quantum_key(
        message: str,
        quantum_key: str,
        purpose: str = "message"
    ) -> Dict[str, str]:
        """
        使用量子密钥加密消息
        """
        # 派生密钥
        derived_key = EncryptionService.derive_key_from_quantum(quantum_key, purpose)
        
        # 加密消息
        encrypted = EncryptionService.encrypt_message(message, derived_key)
        
        # 生成nonce和AAD
        nonce = EncryptionService.generate_nonce()
        timestamp = datetime.utcnow().isoformat()
        
        return {
            "ciphertext": encrypted,
            "nonce": nonce,
            "timestamp": timestamp,
            "key_fingerprint": EncryptionService.generate_key_fingerprint(derived_key)
        }
    
    @staticmethod
    def decrypt_with_quantum_key(
        encrypted_data: Dict[str, str],
        quantum_key: str,
        purpose: str = "message"
    ) -> str:
        """
        使用量子密钥解密消息
        """
        # 派生密钥
        derived_key = EncryptionService.derive_key_from_quantum(quantum_key, purpose)
        
        # 验证密钥指纹
        if not EncryptionService.verify_key_integrity(
            derived_key, encrypted_data.get("key_fingerprint", "")
        ):
            raise ValueError("密钥验证失败")
        
        # 解密消息
        return EncryptionService.decrypt_message(
            encrypted_data["ciphertext"],
            derived_key
        )
    
    @staticmethod
    def calculate_message_digest(message: str) -> str:
        """
        计算消息摘要
        """
        return hashlib.sha256(message.encode()).hexdigest()
    
    @staticmethod
    def verify_message_integrity(
        message: str,
        digest: str
    ) -> bool:
        """
        验证消息完整性
        """
        return EncryptionService.calculate_message_digest(message) == digest
