import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models import engine, Base
from app.models.v1_models import (
    User, Department, UserDevice, UserQuantumIdentity, Contact,
    Conversation, ConversationMember, Message, MessageReceipt,
    Meeting, QKESession, QKESessionMember, QKERound, QKEEvent,
    KeyEpoch, ConversationKeyMaterial, QKEMetricSnapshot,
    SecurityAlert, AuditLog, SystemConfig
)
from app.models.quantum import EntropyAnalysis, QuantumResource

def init_db():
    """
    初始化数据库
    """
    print("正在创建数据库表...")
    
    # 创建所有表
    Base.metadata.create_all(bind=engine)
    
    print("数据库表创建完成！")
    print("已创建的表：")
    for table in Base.metadata.tables.keys():
        print(f"  - {table}")

if __name__ == "__main__":
    init_db()
