from fastapi import APIRouter
from .routes import auth, chat_unified
from .routes.admin import router as admin_router

router = APIRouter(prefix="/v1")

# 注册子路由
router.include_router(auth.router, prefix="/auth", tags=["认证"])
router.include_router(chat_unified.router, prefix="/chat", tags=["聊天"])
router.include_router(admin_router, tags=["管理端"])
