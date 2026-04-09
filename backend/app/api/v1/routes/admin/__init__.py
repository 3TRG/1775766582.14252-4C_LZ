from fastapi import APIRouter
from .sessions import router as sessions_router
from .users import router as users_router
from .alerts import router as alerts_router
from .performance import router as performance_router
from .system import router as system_router
from .keys import router as keys_router
from ..dashboard import router as dashboard_router
from ..qke_analysis import router as qke_analysis_router
from ..statistics import router as statistics_router

router = APIRouter(prefix="/admin")

# 注册子路由
router.include_router(sessions_router, prefix="/qke", tags=["管理端 - QKE会话"])
router.include_router(users_router, tags=["管理端 - 用户管理"])
router.include_router(alerts_router, tags=["管理端 - 安全告警"])
router.include_router(performance_router, tags=["管理端 - 性能监控"])
router.include_router(system_router, tags=["管理端 - 系统配置"])
router.include_router(keys_router, tags=["管理端 - 密钥管理"])

# 管理端功能模块（语义化路由分组）
router.include_router(dashboard_router, prefix="/dashboard", tags=["管理端 - 仪表盘"])
router.include_router(qke_analysis_router, prefix="/qke_analysis", tags=["管理端 - QKE分析"])
router.include_router(statistics_router, prefix="/statistics", tags=["管理端 - 统计分析"])
