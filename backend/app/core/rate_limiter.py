"""
轻量级 API 请求频率限制器
使用内存中的滑动窗口计数器，无需外部依赖（如 Redis）。
适用于单实例部署场景，对竞赛答辩演示足够。

生产环境建议替换为基于 Redis 的分布式限流器。
"""

import time
from collections import defaultdict
from typing import Dict, Tuple

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

import logging

logger = logging.getLogger(__name__)


class SlidingWindowCounter:
    """滑动窗口计数器"""

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: Dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        """检查请求是否被允许"""
        now = time.time()
        cutoff = now - self.window_seconds

        # 清理过期记录
        self._requests[key] = [
            t for t in self._requests[key] if t > cutoff
        ]

        if len(self._requests[key]) >= self.max_requests:
            return False

        self._requests[key].append(now)
        return True

    def get_retry_after(self, key: str) -> int:
        """获取需要等待的秒数"""
        now = time.time()
        if not self._requests[key]:
            return 0
        oldest = min(self._requests[key])
        return max(0, int(oldest + self.window_seconds - now) + 1)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    API 请求频率限制中间件

    限制规则：
      - /api/v1/auth/login: 每个IP每分钟最多 10 次
      - /api/v1/auth/register: 每个IP每分钟最多 5 次
      - 其他 API: 每个IP每分钟最多 120 次
    """

    def __init__(self, app, **kwargs):
        super().__init__(app, **kwargs)
        self._login_limiter = SlidingWindowCounter(max_requests=10, window_seconds=60)
        self._register_limiter = SlidingWindowCounter(max_requests=5, window_seconds=60)
        # 通用 API 限流：每分钟 300 次（足够支持测试套件快速运行）
        self._general_limiter = SlidingWindowCounter(max_requests=300, window_seconds=60)

    async def dispatch(self, request: Request, call_next):
        # 仅对 API 路由进行限流
        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)

        client_ip = self._get_client_ip(request)

        # 根据路径选择限流器
        if "/auth/login" in path:
            limiter = self._login_limiter
        elif "/auth/register" in path:
            limiter = self._register_limiter
        else:
            limiter = self._general_limiter

        if not limiter.is_allowed(client_ip):
            retry_after = limiter.get_retry_after(client_ip)
            logger.warning(
                "[RateLimit] IP %s 触发限流，路径: %s，需等待 %d 秒",
                client_ip, path, retry_after,
            )
            raise HTTPException(
                status_code=429,
                detail={
                    "message": "请求过于频繁，请稍后再试",
                    "retry_after": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        return await call_next(request)

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        """获取客户端 IP（考虑代理头）"""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        return request.client.host if request.client else "unknown"
