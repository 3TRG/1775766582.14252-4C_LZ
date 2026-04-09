from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from dotenv import load_dotenv
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

load_dotenv()

_TOKEN_EXPIRE_HOURS = int(os.getenv("APP_TOKEN_EXPIRE_HOURS", "24"))
_TOKEN_ISSUER = os.getenv("APP_TOKEN_ISSUER", "qke-viz")

def _is_debug() -> bool:
    v = os.getenv("DEBUG", "")
    return v.lower() in {"1", "true", "yes", "y", "on"}


_token_secret_env = os.getenv("APP_TOKEN_SECRET")
if _token_secret_env:
    _TOKEN_SECRET = _token_secret_env
elif _is_debug():
    _TOKEN_SECRET = secrets.token_urlsafe(32)
else:
    raise RuntimeError("APP_TOKEN_SECRET is required")


def get_master_key() -> bytes:
    key_b64 = os.getenv("APP_MASTER_KEY_B64")
    if key_b64:
        key = base64.b64decode(key_b64.encode("utf-8"))
        if len(key) != 32:
            raise ValueError("APP_MASTER_KEY_B64 must decode to 32 bytes")
        return key

    key = os.getenv("APP_MASTER_KEY")
    if key:
        return hashlib.sha256(key.encode("utf-8")).digest()

    if _is_debug():
        return hashlib.sha256(f"master|{_TOKEN_SECRET}".encode("utf-8")).digest()

    raise RuntimeError("APP_MASTER_KEY or APP_MASTER_KEY_B64 is required")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
    return f"{base64.b64encode(salt).decode()}:{base64.b64encode(digest).decode()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt_b64, digest_b64 = password_hash.split(":", 1)
        salt = base64.b64decode(salt_b64.encode())
        expected = base64.b64decode(digest_b64.encode())
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
        return hmac.compare_digest(expected, actual)
    except Exception:
        return False


def issue_access_token(user_id: int) -> str:
    """Issue a standard JWT access token with HS256 signing."""
    now = datetime.now(tz=timezone.utc)
    expire_at = now + timedelta(hours=_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": f"user:{user_id}",
        "user_id": user_id,
        "iat": int(now.timestamp()),
        "exp": int(expire_at.timestamp()),
        "iss": _TOKEN_ISSUER
    }
    return jwt.encode(payload, _TOKEN_SECRET, algorithm="HS256")


def parse_access_token(token: str) -> dict:
    """Parse and validate a JWT access token."""
    try:
        payload = jwt.decode(token, _TOKEN_SECRET, algorithms=["HS256"], issuer=_TOKEN_ISSUER)
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("token_expired")
    except jwt.InvalidTokenError:
        raise ValueError("invalid_signature")


def generate_pauli_seed(length: int = 32) -> str:
    symbols = ["I", "X", "Y", "Z"]
    return "".join(secrets.choice(symbols) for _ in range(length))


def derive_epoch_key(identity_seed: str, shared_key_bits: str, epoch_no: int) -> bytes:
    """使用 HKDF-SHA256 从 QKE 共享密钥和身份材料派生 epoch 密钥。

    密钥派生链: QKE 共享密钥 + 身份种子 -> HKDF -> epoch 密钥 (32 bytes)
    符合 plan1.md 密钥派生链设计规范。
    """
    # 将输入材料组合为 HKDF 的输入密钥材料 (IKM)
    ikm = f"{identity_seed}|{shared_key_bits}|{epoch_no}".encode("utf-8")
    # 使用 epoch_no 作为 info 参数，确保不同 epoch 派生出不同的密钥
    info = f"epoch-{epoch_no}".encode("utf-8")
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=info,
    )
    return hkdf.derive(ikm)


def encrypt_message(key: bytes, plaintext: str, aad: str = "") -> tuple[str, str]:
    nonce = secrets.token_bytes(12)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), aad.encode("utf-8"))
    return base64.b64encode(ciphertext).decode("utf-8"), base64.b64encode(nonce).decode("utf-8")


def decrypt_message(key: bytes, ciphertext_b64: str, nonce_b64: str, aad: str = "") -> str:
    ciphertext = base64.b64decode(ciphertext_b64.encode("utf-8"))
    nonce = base64.b64decode(nonce_b64.encode("utf-8"))
    plaintext = AESGCM(key).decrypt(nonce, ciphertext, aad.encode("utf-8"))
    return plaintext.decode("utf-8")
