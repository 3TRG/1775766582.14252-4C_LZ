@echo off
REM QKE-Viz Admin Frontend Build Script
REM 在部署前构建 Admin 前端，确保 dist/ 目录是最新的

echo ==========================================
echo QKE-Viz Admin Frontend Build Script
echo ==========================================

cd /d "%~dp0admin-frontend"

REM 检查 node_modules 是否存在
if not exist "node_modules" (
    echo [1/3] 安装依赖...
    call npm install
) else (
    echo [1/3] 依赖已安装，跳过 npm install
)

REM 运行 lint 检查
echo [2/3] 运行类型检查...
call npm run lint || echo 警告: lint 检查未通过，继续构建...

REM 构建
echo [3/3] 构建生产版本...
call npm run build

REM 验证构建结果
if exist "dist" (
    echo.
    echo ✅ 构建成功!
    echo    输出目录: %cd%\dist
    dir dist
) else (
    echo ❌ 构建失败: dist 目录不存在
    exit /b 1
)
