# 项目运行指南

# 方式一：开发环境（分别启动）

## 终端 1 — 后端

```bash
cd backend
pip install -r requirements.txt
python main.py              # 启动在 :8000
```

## 终端 2 — 用户端前端

```bash
cd user-frontend
npm install
npm run dev                 # 启动在 :3001，代理 /api → :8000
```

## 终端 3 — 管理端前端

```bash
cd admin-frontend
npm install
npm run dev                 # 启动在 :3000，代理 /api → :8000
```

# 方式二：Docker 全栈部署

```bash
cp .env.example .env
docker-compose up            # 一键启动全部服务（含 PostgreSQL、Redis、Prometheus、Grafana）
```

# 访问地址

| 服务     | 地址                  |
| -------- | --------------------- |
| 后端 API | http://localhost:8000 |
| 用户端   | http://localhost:3001 |
| 管理端   | http://localhost:3000 |

后端首次启动会自动创建 SQLite 数据库表，无需手动初始化。如需手动建表可运行 `python init_db.py`。