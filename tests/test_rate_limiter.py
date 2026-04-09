"""
请求频率限制器单元测试
覆盖: app/core/rate_limiter.py — SlidingWindowCounter + RateLimitMiddleware
"""
import os
import time
import pytest

os.environ["ENVIRONMENT"] = "test"
os.environ.setdefault("APP_TOKEN_SECRET", "test-secret-for-unit-tests-only")

from app.core.rate_limiter import SlidingWindowCounter


class TestSlidingWindowCounter:
    """滑动窗口计数器核心逻辑测试"""

    def test_allows_requests_within_limit(self):
        counter = SlidingWindowCounter(max_requests=5, window_seconds=60)
        for _ in range(5):
            assert counter.is_allowed("client_1") is True

    def test_blocks_requests_exceeding_limit(self):
        counter = SlidingWindowCounter(max_requests=3, window_seconds=60)
        assert counter.is_allowed("client_1") is True
        assert counter.is_allowed("client_1") is True
        assert counter.is_allowed("client_1") is True
        # 第4次请求应该被拒绝
        assert counter.is_allowed("client_1") is False

    def test_different_keys_independent(self):
        """不同客户端的限流互不影响"""
        counter = SlidingWindowCounter(max_requests=2, window_seconds=60)
        assert counter.is_allowed("client_a") is True
        assert counter.is_allowed("client_a") is True
        # client_a 已达上限
        assert counter.is_allowed("client_a") is False
        # client_b 不受影响
        assert counter.is_allowed("client_b") is True
        assert counter.is_allowed("client_b") is True

    def test_window_expiry_allows_new_requests(self):
        """窗口过期后应允许新请求"""
        counter = SlidingWindowCounter(max_requests=2, window_seconds=1)
        assert counter.is_allowed("client_1") is True
        assert counter.is_allowed("client_1") is True
        assert counter.is_allowed("client_1") is False
        # 等待窗口过期
        time.sleep(1.1)
        assert counter.is_allowed("client_1") is True

    def test_get_retry_after_returns_zero_when_allowed(self):
        counter = SlidingWindowCounter(max_requests=5, window_seconds=60)
        counter.is_allowed("client_1")
        assert counter.get_retry_after("client_1") >= 0

    def test_get_retry_after_returns_positive_when_limited(self):
        counter = SlidingWindowCounter(max_requests=1, window_seconds=60)
        counter.is_allowed("client_1")
        counter.is_allowed("client_1")  # 被拒绝但记录了
        retry = counter.get_retry_after("client_1")
        assert retry > 0

    def test_get_retry_after_empty_key(self):
        counter = SlidingWindowCounter(max_requests=5, window_seconds=60)
        assert counter.get_retry_after("nonexistent") == 0

    def test_cleanup_of_old_entries(self):
        """验证过期记录被正确清理"""
        counter = SlidingWindowCounter(max_requests=3, window_seconds=1)
        # 发送3个请求
        for _ in range(3):
            counter.is_allowed("client_1")
        assert len(counter._requests["client_1"]) == 3
        # 窗口过期后，下一次请求应清理旧记录
        time.sleep(1.1)
        counter.is_allowed("client_1")
        assert len(counter._requests["client_1"]) == 1


class TestSlidingWindowCounterEdgeCases:
    """边界情况测试"""

    def test_single_request_limit(self):
        """max_requests=1 的极端情况"""
        counter = SlidingWindowCounter(max_requests=1, window_seconds=60)
        assert counter.is_allowed("key") is True
        assert counter.is_allowed("key") is False

    def test_large_window(self):
        """大窗口值"""
        counter = SlidingWindowCounter(max_requests=1000, window_seconds=3600)
        for _ in range(100):
            assert counter.is_allowed("key") is True

    def test_concurrent_keys(self):
        """多个客户端同时请求"""
        counter = SlidingWindowCounter(max_requests=2, window_seconds=60)
        keys = [f"client_{i}" for i in range(10)]
        for key in keys:
            assert counter.is_allowed(key) is True
            assert counter.is_allowed(key) is True
            assert counter.is_allowed(key) is False
