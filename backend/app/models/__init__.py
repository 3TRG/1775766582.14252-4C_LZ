from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# 使用SQLite数据库，不需要额外安装数据库软件
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./database.db")

# 只有在SQLite的情况下才使用check_same_thread参数
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# 依赖项
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()