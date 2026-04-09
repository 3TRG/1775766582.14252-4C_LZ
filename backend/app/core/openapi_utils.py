"""
OpenAPI工具函数
用于增强API文档生成
"""
from typing import Any, Dict, List, Optional
from fastapi.openapi.utils import get_openapi
from fastapi import FastAPI

def custom_openapi(app: FastAPI) -> Dict[str, Any]:
    """
    生成自定义的OpenAPI schema
    """
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    # 添加安全认证方案
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }

    # 全局安全要求
    openapi_schema["security"] = [{"BearerAuth": []}]

    # 添加服务器信息
    openapi_schema["servers"] = [
        {
            "url": "http://localhost:8000",
            "description": "开发服务器"
        },
        {
            "url": "https://api.qkeviz.com",
            "description": "生产服务器"
        }
    ]

    # 添加标签描述
    openapi_schema["tags"] = [
        {
            "name": "认证",
            "description": "用户注册、登录、令牌管理等认证相关接口"
        },
        {
            "name": "聊天",
            "description": "即时通讯相关接口，包括消息发送、会话管理等"
        },
        {
            "name": "管理端",
            "description": "管理员监控平台专用接口，包括会话管理、事件流、用户管理等"
        }
    ]

    app.openapi_schema = openapi_schema
    return app.openapi_schema

def setup_openapi(app: FastAPI) -> None:
    """
    设置OpenAPI文档
    """
    app.openapi = lambda: custom_openapi(app)