import sqlite3
import json

# 连接数据库
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# 查询 QKE 事件表
cursor.execute('''
    SELECT id, qke_session_id, conversation_id, event_type, event_stage, title, detail_json, event_time 
    FROM qke_events_v1 
    WHERE qke_session_id = 2 
    ORDER BY event_time DESC
''')

# 获取查询结果
rows = cursor.fetchall()

# 打印结果
print("QKE 事件列表 (qke_session_id = 2):")
print("=" * 100)
for row in rows:
    id, qke_session_id, conversation_id, event_type, event_stage, title, detail_json, event_time = row
    print(f"ID: {id}")
    print(f"QKE Session ID: {qke_session_id}")
    print(f"Conversation ID: {conversation_id}")
    print(f"Event Type: {event_type}")
    print(f"Event Stage: {event_stage}")
    print(f"Title: {title}")
    if detail_json:
        print(f"Details: {json.loads(detail_json)}")
    print(f"Event Time: {event_time}")
    print("-" * 100)

# 关闭连接
conn.close()