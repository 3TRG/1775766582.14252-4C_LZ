#!/bin/bash
# QKE-Viz Admin Frontend Build Script
# 在部署前构建 Admin 前端，确保 dist/ 目录是最新的

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADMIN_DIR="$SCRIPT_DIR/admin-frontend"

echo "=========================================="
echo "QKE-Viz Admin Frontend Build Script"
echo "=========================================="

# 检查 admin-frontend 目录是否存在
if [ ! -d "$ADMIN_DIR" ]; then
    echo "错误: admin-frontend 目录不存在"
    exit 1
fi

cd "$ADMIN_DIR"

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "[1/3] 安装依赖..."
    npm install
else
    echo "[1/3] 依赖已安装，跳过 npm install"
fi

# 运行类型检查
echo "[2/3] 运行类型检查..."
npm run lint || echo "警告: lint 检查未通过，继续构建..."

# 构建
echo "[3/3] 构建生产版本..."
npm run build

# 验证构建结果
if [ -d "dist" ]; then
    echo ""
    echo "✅ 构建成功!"
    echo "   输出目录: $ADMIN_DIR/dist"
    echo "   构建时间: $(date)"
    ls -la dist/
else
    echo "❌ 构建失败: dist 目录不存在"
    exit 1
fi
