"""
核心加密模块单元测试（独立于 security_service）
"""
import base64
import os

os.environ["ENVIRONMENT"] = "test"
os.environ.setdefault("APP_TOKEN_SECRET", "test-secret-for-unit-tests-only")
os.environ.setdefault("DEBUG", "true")

import pytest
from datetime import datetime, timezone, timedelta
import json
import hmac as hmac_mod


class TestEpochKeyDerivation:
    """derive_epoch_key 确定性测试"""

    def test_deterministic(self):
        from app.core.security import derive_epoch_key
        k1 = derive_epoch_key("seed1", "101010", 1)
        k2 = derive_epoch_key("seed1", "101010", 1)
        assert k1 == k2

    def test_different_seed_different_output(self):
        from app.core.security import derive_epoch_key
        k1 = derive_epoch_key("seed1", "bits", 1)
        k2 = derive_epoch_key("seed2", "bits", 1)
        assert k1 != k2

    def test_different_epoch_different_output(self):
        from app.core.security import derive_epoch_key
        k1 = derive_epoch_key("seed", "bits", 1)
        k2 = derive_epoch_key("seed", "bits", 2)
        assert k1 != k2

    def test_output_is_256_bits(self):
        from app.core.security import derive_epoch_key
        key = derive_epoch_key("x", "y", 0)
        assert len(key) == 32  # SHA256 = 256 bits = 32 bytes


class TestAESGCM:
    """core.security AES-GCM encrypt/decrypt 测试"""

    def test_roundtrip(self):
        from app.core.security import get_master_key, encrypt_message, decrypt_message
        key = get_master_key()
        ct, nonce = encrypt_message(key, "Hello")
        pt = decrypt_message(key, ct, nonce)
        assert pt == "Hello"

    def test_empty_message(self):
        from app.core.security import get_master_key, encrypt_message, decrypt_message
        key = get_master_key()
        ct, nonce = encrypt_message(key, "")
        pt = decrypt_message(key, ct, nonce)
        assert pt == ""

    def test_unicode_message(self):
        from app.core.security import get_master_key, encrypt_message, decrypt_message
        key = get_master_key()
        ct, nonce = encrypt_message(key, "量子密钥分发")
        pt = decrypt_message(key, ct, nonce)
        assert pt == "量子密钥分发"

    def test_diff_nonce_per_encrypt(self):
        from app.core.security import get_master_key, encrypt_message
        key = get_master_key()
        ct1, n1 = encrypt_message(key, "test")
        ct2, n2 = encrypt_message(key, "test")
        assert n1 != n2
        assert ct1 != ct2

    def test_wrong_nonce_fails(self):
        from app.core.security import get_master_key, encrypt_message, decrypt_message
        key = get_master_key()
        ct, nonce = encrypt_message(key, "test")
        # Flip one character in nonce
        bad_nonce = nonce[:-1] + ("A" if nonce[-1] != "A" else "B")
        with pytest.raises(Exception):
            decrypt_message(key, ct, bad_nonce)

    def test_wrong_aad_fails(self):
        from app.core.security import get_master_key, encrypt_message, decrypt_message
        key = get_master_key()
        ct, nonce = encrypt_message(key, "payload", aad="correct")
        with pytest.raises(Exception):
            decrypt_message(key, ct, nonce, aad="wrong")

    def test_with_aad_roundtrip(self):
        from app.core.security import get_master_key, encrypt_message, decrypt_message
        key = get_master_key()
        aad = "conv:42|epoch:3"
        ct, nonce = encrypt_message(key, '{"data":"ok"}', aad=aad)
        pt = decrypt_message(key, ct, nonce, aad=aad)
        assert pt == '{"data":"ok"}'


class TestMasterKey:
    """get_master_key 行为测试"""

    def test_returns_32_byte_key(self):
        from app.core.security import get_master_key
        key = get_master_key()
        assert len(key) == 32

    def test_consistent_across_calls(self):
        from app.core.security import get_master_key
        k1 = get_master_key()
        k2 = get_master_key()
        assert k1 == k2


class TestTokenOperations:
    """issue_access_token + parse_access_token 测试"""

    def test_issue_and_parse(self):
        from app.core.security import issue_access_token, parse_access_token
        token = issue_access_token(123)
        payload = parse_access_token(token)
        assert payload["user_id"] == 123
        assert "exp" in payload

    def test_token_structure(self):
        from app.core.security import issue_access_token
        token = issue_access_token(1)
        parts = token.split(".")
        assert len(parts) == 2  # payload.signature

    def test_tampered_token_fails(self):
        from app.core.security import issue_access_token, parse_access_token
        token = issue_access_token(1)
        payload_b64, _ = token.split(".")
        bad = f"{payload_b64}.aabbccdd" * 2
        with pytest.raises(ValueError, match="invalid_signature"):
            parse_access_token(bad)

    def test_expired_token(self):
        from app.core.security import _TOKEN_SECRET, parse_access_token
        expire_past = int((datetime.now(tz=timezone.utc) + timedelta(hours=-1)).timestamp())
        payload = {"user_id": 1, "exp": expire_past}
        raw = json.dumps(payload, separators=(",", ":")).encode()
        p64 = base64.urlsafe_b64encode(raw).decode().rstrip("=")
        sig = hmac_mod.new(_TOKEN_SECRET.encode(), p64.encode(), "sha256").hexdigest()
        with pytest.raises(ValueError, match="token_expired"):
            parse_access_token(f"{p64}.{sig}")


class TestPauliSeed:
    """generate_pauli_seed 测试"""

    def test_correct_length(self):
        from app.core.security import generate_pauli_seed
        assert len(generate_pauli_seed(16)) == 16
        assert len(generate_pauli_seed(64)) == 64

    def test_valid_symbols(self):
        from app.core.security import generate_pauli_seed
        seed = generate_pauli_seed(100)
        assert all(c in "IXYZ" for c in seed)
