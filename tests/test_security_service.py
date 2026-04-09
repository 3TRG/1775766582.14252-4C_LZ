"""
安全服务和核心加密模块单元测试
覆盖: core/security.py + services/security_service.py
"""
import base64
import os
import pytest

# ---- 必须在导入之前设置测试环境变量 ----
os.environ["ENVIRONMENT"] = "test"
os.environ.setdefault("APP_TOKEN_SECRET", "test-secret-for-unit-tests-only")
os.environ.setdefault("DEBUG", "true")

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


# ==================== core/security.py ====================

class TestPasswordHashing:
    def test_hash_format(self):
        h = hash_password("Test123!")
        assert ":" in h
        salt_b64, digest_b64 = h.split(":")
        assert len(base64.b64decode(salt_b64)) == 16  # 16 bytes salt

    def test_verify_correct(self):
        h = hash_password("MyPassword!")
        assert verify_password("MyPassword!", h) is True

    def test_verify_incorrect(self):
        h = hash_password("MyPassword!")
        assert verify_password("WrongPassword", h) is False

    def test_verify_malformed_hash(self):
        assert verify_password("anything", "not-a-hash") is False


class TestAccessToken:
    def test_issue_and_parse(self):
        token = issue_access_token(42)
        payload = parse_access_token(token)
        assert payload["user_id"] == 42
        assert "exp" in payload

    def test_invalid_signature(self):
        token = issue_access_token(1)
        # Tamper with the signature
        payload_b64, _ = token.split(".")
        tampered = f"{payload_b64}.abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        with pytest.raises(ValueError, match="invalid_signature"):
            parse_access_token(tampered)

    def test_expired_token(self):
        from datetime import datetime, timezone, timedelta
        import json
        import hmac as hmac_mod

        # Manually create an expired token — need to access _TOKEN_SECRET
        from app.core.security import _TOKEN_SECRET
        expire_at = int((datetime.now(tz=timezone.utc) + timedelta(hours=-1)).timestamp())
        payload = {"user_id": 1, "exp": expire_at}
        payload_raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        payload_b64 = base64.urlsafe_b64encode(payload_raw).decode("utf-8").rstrip("=")
        sig = hmac_mod.new(_TOKEN_SECRET.encode("utf-8"), payload_b64.encode("utf-8"), "sha256").hexdigest()
        token = f"{payload_b64}.{sig}"
        with pytest.raises(ValueError, match="token_expired"):
            parse_access_token(token)


class TestPauliSeed:
    def test_length(self):
        seed = generate_pauli_seed(32)
        assert len(seed) == 32

    def test_valid_symbols(self):
        seed = generate_pauli_seed(64)
        assert all(c in "IXYZ" for c in seed)

    def test_uniqueness(self):
        seeds = {generate_pauli_seed(32) for _ in range(50)}
        assert len(seeds) > 40  # Allow some repeats (secrets.choice)


class TestEpochKey:
    def test_deterministic(self):
        k1 = derive_epoch_key("seed1", "101010", 1)
        k2 = derive_epoch_key("seed1", "101010", 1)
        assert k1 == k2

    def test_different_params(self):
        k1 = derive_epoch_key("seed1", "bits", 1)
        k2 = derive_epoch_key("seed2", "bits", 1)
        k3 = derive_epoch_key("seed1", "bits", 2)
        assert k1 != k2
        assert k1 != k3
        assert len(k1) == 32  # SHA256 output


class TestAESGCM:
    def test_encrypt_decrypt_roundtrip(self):
        key = get_master_key()
        ct, nonce = encrypt_message(key, "Hello World")
        pt = decrypt_message(key, ct, nonce)
        assert pt == "Hello World"

    def test_encrypt_produces_different_ct(self):
        """AES-GCM uses random nonce — ciphertext should differ each time"""
        key = get_master_key()
        ct1, n1 = encrypt_message(key, "same")
        ct2, n2 = encrypt_message(key, "same")
        assert ct1 != ct2
        assert n1 != n2

    def test_decrypt_with_wrong_key(self):
        key1 = get_master_key()
        # Create a different key
        import hashlib
        key2 = hashlib.sha256(b"different-key").digest()
        ct, nonce = encrypt_message(key1, "secret")
        with pytest.raises(Exception):
            decrypt_message(key2, ct, nonce)

    def test_encrypt_with_aad(self):
        key = get_master_key()
        aad = "additional:auth:data"
        ct, nonce = encrypt_message(key, "payload", aad=aad)
        pt = decrypt_message(key, ct, nonce, aad=aad)
        assert pt == "payload"

    def test_decrypt_with_wrong_aad(self):
        key = get_master_key()
        ct, nonce = encrypt_message(key, "payload", aad="correct_aad")
        with pytest.raises(Exception):
            decrypt_message(key, ct, nonce, aad="wrong_aad")


# ==================== security_service.py ====================

class TestSecurityService:
    """测试 SecurityService 的各项功能"""

    @pytest.fixture(autouse=True)
    def ensure_test_env(self):
        """确保测试环境变量已设置"""
        os.environ.setdefault("APP_TOKEN_SECRET", "test-secret-for-unit-tests-only")
        os.environ.setdefault("DEBUG", "true")
        # Force re-import since the module has already loaded
        yield

    def _get_service(self):
        """获取一个新的 SecurityService 实例，使用测试密钥"""
        from app.services.security_service import SecurityService
        return SecurityService()

    def test_password_hash_and_verify(self):
        svc = self._get_service()
        h = svc.hash_password("SecurePass123!")
        assert svc.verify_password("SecurePass123!", h) is True
        assert svc.verify_password("WrongPass", h) is False

    def test_access_token_issue_and_parse(self):
        svc = self._get_service()
        token = svc.issue_access_token(99)
        assert isinstance(token, str)
        assert "." in token
        payload = svc.parse_access_token(token)
        assert payload["user_id"] == 99

    def test_access_token_bad_signature(self):
        svc = self._get_service()
        token = svc.issue_access_token(1)
        payload_b64, _ = token.split(".")
        bad = f"{payload_b64}.x" * 2
        with pytest.raises(ValueError, match="invalid_signature"):
            svc.parse_access_token(bad)

    def test_aesgcm_roundtrip(self):
        svc = self._get_service()
        key = get_master_key()
        ct, nonce = svc.encrypt_message_aesgcm(key, "test message")
        pt = svc.decrypt_message_aesgcm(key, ct, nonce)
        assert pt == "test message"

    def test_aesgcm_with_aad(self):
        svc = self._get_service()
        key = get_master_key()
        aad = "conv:1|epoch:2"
        ct, nonce = svc.encrypt_message_aesgcm(key, '{"msg":"ok"}', aad=aad)
        pt = svc.decrypt_message_aesgcm(key, ct, nonce, aad=aad)
        assert pt == '{"msg":"ok"}'

    def test_derive_epoch_key(self):
        svc = self._get_service()
        key = svc.derive_epoch_key("identity1", "101100", 3)
        assert len(key) == 32

    def test_key_fingerprint(self):
        svc = self._get_service()
        key = b"0" * 32
        fp = svc.generate_key_fingerprint(key)
        assert len(fp) == 16
        assert svc.verify_key_integrity(key, fp) is True
        assert svc.verify_key_integrity(key, "bad_fingerprint") is False

    def test_message_digest(self):
        svc = self._get_service()
        d = svc.calculate_message_digest("hello")
        assert isinstance(d, str) and len(d) == 64
        assert svc.verify_message_integrity("hello", d) is True
        assert svc.verify_message_integrity("world", d) is False

    def test_secure_random_bytes(self):
        svc = self._get_service()
        b = svc.secure_random_bytes(64)
        assert len(b) == 64
        assert b != svc.secure_random_bytes(64)

    def test_generate_aad(self):
        svc = self._get_service()
        aad = svc.generate_aad(1, 42, "2024-01-01T00:00:00")
        assert len(aad) == 64  # SHA256 hex

    def test_quantum_encrypt_decrypt_roundtrip(self):
        svc = self._get_service()
        qk = "IXYZ" * 8  # 32-char quantum key
        msg = "Secret message"
        enc = svc.encrypt_with_quantum_key(msg, qk)
        assert "ciphertext" in enc
        assert "nonce" in enc
        assert "timestamp" in enc
        assert "key_fingerprint" in enc
        dec = svc.decrypt_with_quantum_key(enc, qk)
        assert dec == msg

    def test_generate_pauli_seed(self):
        svc = self._get_service()
        seed = svc.generate_pauli_seed(16)
        assert len(seed) == 16
        assert all(c in "IXYZ" for c in seed)

    def test_safe_delete_data(self):
        svc = self._get_service()
        data = bytearray(b"secret")
        svc.safe_delete_data(data)
        assert data == bytearray(b"\x00\x00\x00\x00\x00\x00")
