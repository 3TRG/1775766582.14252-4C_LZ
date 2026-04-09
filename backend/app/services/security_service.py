"""
统一安全服务
整合加密服务和核心安全功能，提供统一的安全操作接口
参考国盾琨腾密码服务管理平台的标准化服务理念

注意：密码哈希、JWT、AES-GCM、密钥派生等安全原语的唯一实现在 core/security.py。
本模块仅提供业务层的组合方法和附加的安全工具函数。
"""

import base64
import hashlib
import os
import secrets
from datetime import datetime
from typing import Dict, Tuple

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.backends import default_backend

from dotenv import load_dotenv

load_dotenv()

# 从 core.security 导入安全原语，本模块不重复实现
from app.core.security import (
    hash_password,
    verify_password,
    issue_access_token,
    parse_access_token,
    generate_pauli_seed,
    derive_epoch_key,
    encrypt_message,
    decrypt_message,
    get_master_key,
)


class SecurityService:
    """统一安全服务 - 提供密码学操作、密钥管理和安全服务

    安全原语（密码哈希、JWT、AES-GCM、HKDF）的实现在 core/security.py，
    本类提供业务层的组合方法和辅助工具函数。
    """

    def __init__(self):
        self._master_key = get_master_key()

    # ==================== 密码和认证（委托给 core/security.py） ====================

    def hash_password(self, password: str) -> str:
        """哈希密码 - 委托给 core.security.hash_password"""
        return hash_password(password)

    def verify_password(self, password: str, password_hash: str) -> bool:
        """验证密码 - 委托给 core.security.verify_password"""
        return verify_password(password, password_hash)

    def issue_access_token(self, user_id: int) -> str:
        """发放访问令牌 - 委托给 core.security.issue_access_token"""
        return issue_access_token(user_id)

    def parse_access_token(self, token: str) -> dict:
        """解析访问令牌 - 委托给 core.security.parse_access_token"""
        return parse_access_token(token)

    def generate_pauli_seed(self, length: int = 32) -> str:
        """生成保罗种子 - 委托给 core.security.generate_pauli_seed"""
        return generate_pauli_seed(length)

    # ==================== 密钥派生 ====================

    def derive_epoch_key(self, identity_seed: str, shared_key_bits: str, epoch_no: int) -> bytes:
        """派生 epoch 密钥 - 委托给 core.security.derive_epoch_key（使用 HKDF-SHA256）"""
        return derive_epoch_key(identity_seed, shared_key_bits, epoch_no)

    def generate_key_from_seed(self, seed: str, info: bytes = b"") -> bytes:
        """从种子派生密钥（使用HKDF）"""
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=info,
            backend=default_backend()
        )
        key = hkdf.derive(seed.encode('utf-8'))
        return base64.urlsafe_b64encode(key)

    def derive_key_from_quantum(self, quantum_key: str, purpose: str) -> bytes:
        """从量子密钥派生特定用途的密钥"""
        info = purpose.encode('utf-8')
        return self.generate_key_from_seed(quantum_key, info)

    # ==================== 加密和解密（AES-GCM，委托给 core/security.py） ====================

    def encrypt_message_aesgcm(self, key: bytes, plaintext: str, aad: str = "") -> Tuple[str, str]:
        """使用AES-GCM加密消息 - 委托给 core.security.encrypt_message"""
        return encrypt_message(key, plaintext, aad)

    def decrypt_message_aesgcm(self, key: bytes, ciphertext_b64: str, nonce_b64: str, aad: str = "") -> str:
        """使用AES-GCM解密消息 - 委托给 core.security.decrypt_message"""
        return decrypt_message(key, ciphertext_b64, nonce_b64, aad)

    # ==================== 密钥管理 ====================

    def generate_epoch_key_from_master(self, epoch: int, conversation_id: int) -> bytes:
        """从主密钥生成轮密钥"""
        info = f"epoch_{epoch}_conversation_{conversation_id}".encode('utf-8')
        return self.generate_key_from_seed(self._master_key.decode('latin-1'), info)

    def generate_message_key(self, epoch_key: bytes, message_id: int, timestamp: str) -> bytes:
        """生成消息级密钥"""
        info = f"message_{message_id}_{timestamp}".encode('utf-8')
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=info,
            backend=default_backend()
        )
        key = hkdf.derive(epoch_key)
        return base64.urlsafe_b64encode(key)

    def generate_key_fingerprint(self, key: bytes) -> str:
        """生成密钥指纹"""
        return hashlib.sha256(key).hexdigest()[:16]

    def verify_key_integrity(self, key: bytes, fingerprint: str) -> bool:
        """验证密钥完整性"""
        return self.generate_key_fingerprint(key) == fingerprint

    # ==================== 随机数和认证数据 ====================

    def generate_nonce(self) -> str:
        """生成随机nonce"""
        return base64.urlsafe_b64encode(hashlib.sha256(
            (str(datetime.utcnow()) + str(secrets.token_bytes(32))).encode()
        ).digest()).decode('utf-8')

    def generate_aad(self, conversation_id: int, message_seq: int, timestamp: str) -> str:
        """生成额外认证数据"""
        aad_data = f"conv_{conversation_id}_seq_{message_seq}_{timestamp}"
        return hashlib.sha256(aad_data.encode()).hexdigest()

    # ==================== 消息完整性 ====================

    def calculate_message_digest(self, message: str) -> str:
        """计算消息摘要"""
        return hashlib.sha256(message.encode()).hexdigest()

    def verify_message_integrity(self, message: str, digest: str) -> bool:
        """验证消息完整性"""
        return self.calculate_message_digest(message) == digest

    # ==================== 安全服务接口 ====================

    def secure_random_bytes(self, length: int) -> bytes:
        """生成安全随机字节"""
        return secrets.token_bytes(length)

    def safe_delete_data(self, data: bytearray) -> None:
        """安全删除敏感数据（覆写内存）"""
        if isinstance(data, bytearray):
            for i in range(len(data)):
                data[i] = 0

    def hash_data(self, data: bytes, algorithm: str = "sha256") -> str:
        """哈希数据"""
        if algorithm == "sha256":
            return hashlib.sha256(data).hexdigest()
        elif algorithm == "sha512":
            return hashlib.sha512(data).hexdigest()
        else:
            raise ValueError(f"Unsupported algorithm: {algorithm}")


# 单例实例
security_service = SecurityService()
