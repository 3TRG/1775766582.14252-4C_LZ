-- QKE-Viz PostgreSQL 初始化脚本
-- 此脚本在 PostgreSQL 首次启动时自动执行

-- 创建角色表（如需细粒度权限控制可在此扩展）
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认角色
INSERT INTO roles (name, description) VALUES
    ('admin', '管理员'),
    ('user', '普通用户')
ON CONFLICT (name) DO NOTHING;
