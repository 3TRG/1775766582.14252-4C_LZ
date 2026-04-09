"""
统一配置管理系统
支持环境变量、配置文件和数据库配置多种方式
参考QuPot+Runtime的自动化部署理念
"""

import os
import json
import logging
import yaml
from typing import Any, Dict, Optional, Union
from pathlib import Path
from dataclasses import dataclass, asdict
from datetime import datetime

logger = logging.getLogger(__name__)

from dotenv import load_dotenv

# 根据ENVIRONMENT环境变量加载相应的.env文件
environment = os.getenv("ENVIRONMENT", "development")
env_file = f".env.{environment}"
if os.path.exists(env_file):
    load_dotenv(env_file)
else:
    # 回退到默认的.env文件
    load_dotenv()


@dataclass
class DatabaseConfig:
    """数据库配置"""
    url: str = os.getenv("DATABASE_URL", "sqlite:///./qke_viz.db")
    echo: bool = os.getenv("DB_ECHO", "false").lower() == "true"
    pool_size: int = int(os.getenv("DB_POOL_SIZE", "5"))
    max_overflow: int = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    pool_timeout: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    pool_recycle: int = int(os.getenv("DB_POOL_RECYCLE", "1800"))


@dataclass
class SecurityConfig:
    """安全配置"""
    token_expire_hours: int = int(os.getenv("APP_TOKEN_EXPIRE_HOURS", "24"))
    token_secret: Optional[str] = os.getenv("APP_TOKEN_SECRET")
    master_key: Optional[str] = os.getenv("APP_MASTER_KEY")
    master_key_b64: Optional[str] = os.getenv("APP_MASTER_KEY_B64")
    algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


@dataclass
class QKEConfig:
    """QKE引擎配置"""
    default_backend: str = os.getenv("QKE_DEFAULT_BACKEND", "local_simulator")
    default_key_length: int = int(os.getenv("QKE_DEFAULT_KEY_LENGTH", "256"))
    default_decoy_count: int = int(os.getenv("QKE_DEFAULT_DECOY_COUNT", "4"))
    session_timeout_minutes: int = int(os.getenv("QKE_SESSION_TIMEOUT_MINUTES", "30"))
    max_participants: int = int(os.getenv("QKE_MAX_PARTICIPANTS", "10"))


@dataclass
class ServerConfig:
    """服务器配置"""
    host: str = os.getenv("SERVER_HOST", "0.0.0.0")
    port: int = int(os.getenv("SERVER_PORT", "8000"))
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    reload: bool = os.getenv("RELOAD", "false").lower() == "true"
    workers: int = int(os.getenv("WORKERS", "1"))


@dataclass
class LoggingConfig:
    """日志配置"""
    level: str = os.getenv("LOG_LEVEL", "INFO")
    format: str = os.getenv(
        "LOG_FORMAT",
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    file_path: Optional[str] = os.getenv("LOG_FILE_PATH")
    max_size_mb: int = int(os.getenv("LOG_MAX_SIZE_MB", "10"))
    backup_count: int = int(os.getenv("LOG_BACKUP_COUNT", "5"))


@dataclass
class AppConfig:
    """应用配置"""
    name: str = os.getenv("APP_NAME", "QKE-Viz")
    version: str = os.getenv("APP_VERSION", "1.0.0")
    description: str = os.getenv("APP_DESCRIPTION", "量子密钥分发可视化系统")


@dataclass
class Config:
    """主配置类"""
    app: AppConfig
    database: DatabaseConfig
    security: SecurityConfig
    qke: QKEConfig
    server: ServerConfig
    logging: LoggingConfig

    # 环境标识
    environment: str = os.getenv("ENVIRONMENT", "development")

    # 是否启用 Prometheus 指标
    ENABLE_METRICS: bool = False

    def __post_init__(self):
        """初始化后处理"""
        # 确保日志目录存在
        if self.logging.file_path:
            log_dir = Path(self.logging.file_path).parent
            log_dir.mkdir(parents=True, exist_ok=True)


class ConfigManager:
    """配置管理器 - 单例模式"""

    _instance: Optional['ConfigManager'] = None
    _config: Optional[Config] = None
    _config_file_path: Optional[Path] = None

    def __new__(cls) -> 'ConfigManager':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._config is None:
            self._config = self._load_config()

    def _load_config(self) -> Config:
        """加载配置"""
        # 1. 从环境变量加载基础配置
        config = Config(
            app=AppConfig(),
            database=DatabaseConfig(),
            security=SecurityConfig(),
            qke=QKEConfig(),
            server=ServerConfig(),
            logging=LoggingConfig()
        )

        # 2. 如果有配置文件，从文件加载并覆盖
        config_file = self._get_config_file_path()
        if config_file and config_file.exists():
            try:
                file_config = self._load_config_file(config_file)
                config = self._merge_config(config, file_config)
            except Exception as e:
                logging.warning("[ConfigManager] 加载配置文件失败: %s", e)

        # 3. 环境变量覆盖文件配置（已经在第一步完成）

        return config

    def _get_config_file_path(self) -> Optional[Path]:
        """获取配置文件路径"""
        if self._config_file_path:
            return self._config_file_path

        # 检查环境变量指定的配置文件
        env_config_path = os.getenv("CONFIG_FILE_PATH")
        if env_config_path:
            self._config_file_path = Path(env_config_path)
            return self._config_file_path

        # 检查环境特定的配置文件
        environment = os.getenv("ENVIRONMENT", "development")
        env_specific_paths = [
            Path(f"config.{environment}.yaml"),
            Path(f"config.{environment}.yml"),
            Path(f"app/config.{environment}.yaml"),
            Path(f"app/config.{environment}.yml")
        ]

        for path in env_specific_paths:
            if path.exists():
                self._config_file_path = path
                return path

        # 检查默认配置文件位置
        default_paths = [
            Path("config.yaml"),
            Path("config.yml"),
            Path("config.json"),
            Path("app/config.yaml"),
            Path("app/config.yml"),
            Path("app/config.json")
        ]

        for path in default_paths:
            if path.exists():
                self._config_file_path = path
                return path

        return None

    def _load_config_file(self, file_path: Path) -> Dict[str, Any]:
        """加载配置文件"""
        if not file_path.exists():
            return {}

        with open(file_path, 'r', encoding='utf-8') as f:
            if file_path.suffix.lower() in ['.yaml', '.yml']:
                return yaml.safe_load(f) or {}
            elif file_path.suffix.lower() == '.json':
                return json.load(f) or {}
            else:
                raise ValueError(f"Unsupported config file format: {file_path.suffix}")

    def _merge_config(self, base: Config, override: Dict[str, Any]) -> Config:
        """合并配置"""
        base_dict = asdict(base)
        merged_dict = self._deep_merge(base_dict, override)
        return Config(**merged_dict)

    def _deep_merge(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """深度合并字典"""
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    def get_config(self) -> Config:
        """获取当前配置"""
        return self._config

    def reload_config(self):
        """重新加载配置"""
        self._config = self._load_config()

    def update_config(self, updates: Dict[str, Any]):
        """更新配置"""
        current_dict = asdict(self._config)
        updated_dict = self._deep_merge(current_dict, updates)
        self._config = Config(**updated_dict)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return asdict(self._config)

    def save_to_file(self, file_path: Union[str, Path]):
        """保存配置到文件"""
        path = Path(file_path)
        config_dict = self.to_dict()

        with open(path, 'w', encoding='utf-8') as f:
            if path.suffix.lower() in ['.yaml', '.yml']:
                yaml.dump(config_dict, f, default_flow_style=False, indent=2)
            elif path.suffix.lower() == '.json':
                json.dump(config_dict, f, indent=2, ensure_ascii=False)
            else:
                raise ValueError(f"Unsupported config file format: {path.suffix}")


# 全局配置管理器实例
config_manager = ConfigManager()

def get_config() -> Config:
    """获取应用配置的便利函数"""
    return config_manager.get_config()
