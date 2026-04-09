"""
E2E 集成测试 — 完整聊天流程
覆盖: 注册 -> 登录 -> 添加好友 -> 创建私聊会话 -> 发消息 -> 查历史 -> 群聊 -> 发文件
共享 fixture 来自 conftest.py: client, _auth, _register, _login, _unique_ts
"""
import pytest
import pytest_asyncio

from httpx import AsyncClient


@pytest.fixture
def p2p_users(request):
    """P2P 测试: 注册两个用户，返回 (account_a, account_b, username_a, username_b, user_id_a, user_id_b, token_a, token_b)"""
    return {}


@pytest.fixture
def group_users(request):
    """群聊测试: 注册三个用户，返回 (account_x, account_y, account_z, ...)"""
    return {}


@pytest_asyncio.fixture
async def p2p_pair(client: AsyncClient):
    """注册+登录两个用户，返回包含所有属性的字典"""
    from conftest import _unique_ts, _register, _login, _auth
    ts = _unique_ts()
    account_a = f"138{ts[-8:]}"
    account_b = f"139{ts[-8:]}"
    username_a = f"userA_{ts[-6:]}"
    username_b = f"userB_{ts[-6:]}"

    res_a = await _register(client, account_a, username_a)
    res_b = await _register(client, account_b, username_b)
    user_id_a = res_a["user"]["user_id"]
    user_id_b = res_b["user"]["user_id"]

    login_a = await _login(client, account_a)
    login_b = await _login(client, account_b)
    token_a = login_a["access_token"]
    token_b = login_b["access_token"]

    return {
        "account_a": account_a, "account_b": account_b,
        "username_a": username_a, "username_b": username_b,
        "user_id_a": user_id_a, "user_id_b": user_id_b,
        "token_a": token_a, "token_b": token_b,
    }


@pytest_asyncio.fixture
async def group_trio(client: AsyncClient):
    """注册+登录三个用户"""
    from conftest import _unique_ts, _register, _login
    ts = _unique_ts()
    account_x = f"137{ts[-8:]}"
    account_y = f"136{ts[-8:]}"
    account_z = f"135{ts[-8:]}"
    username_x = f"userX_{ts[-6:]}"
    username_y = f"userY_{ts[-6:]}"
    username_z = f"userZ_{ts[-6:]}"

    res_x = await _register(client, account_x, username_x)
    res_y = await _register(client, account_y, username_y)
    res_z = await _register(client, account_z, username_z)
    user_id_x = res_x["user"]["user_id"]
    user_id_y = res_y["user"]["user_id"]
    user_id_z = res_z["user"]["user_id"]

    login_x = await _login(client, account_x)
    login_y = await _login(client, account_y)
    login_z = await _login(client, account_z)
    token_x = login_x["access_token"]
    token_y = login_y["access_token"]
    token_z = login_z["access_token"]

    return {
        "account_x": account_x, "account_y": account_y, "account_z": account_z,
        "username_x": username_x, "username_y": username_y, "username_z": username_z,
        "user_id_x": user_id_x, "user_id_y": user_id_y, "user_id_z": user_id_z,
        "token_x": token_x, "token_y": token_y, "token_z": token_z,
    }


def auth(token: str):
    return {"Authorization": f"Bearer {token}"}


# ===================== P2P 流程 =====================

class TestP2PFlow:
    """端到端 P2P 消息完整流程"""

    @pytest.mark.order(1)
    async def test_01_register_and_login_and_send_p2p(self, client: AsyncClient, p2p_pair: dict):
        from conftest import _auth
        u = p2p_pair
        assert u["user_id_a"] != u["user_id_b"]

        # 添加好友
        resp = await client.post("/api/v1/chat/friends", json={
            "account_or_user_id": u["account_b"],
        }, headers=_auth(u["token_a"]))
        assert resp.status_code == 200
        assert resp.json()["user_id"] == u["user_id_b"]

        # 创建私聊会话
        resp = await client.post("/api/v1/chat/conversations", json={
            "type": "private",
            "member_ids": [u["user_id_b"]],
        }, headers=_auth(u["token_a"]))
        assert resp.status_code == 200
        data = resp.json()
        convo_id = data["conversation_id"]
        assert data["key_epoch"] > 0

        # 发送 P2P 消息
        resp = await client.post("/api/v1/chat/messages/p2p", json={
            "to_user_id": u["user_id_b"],
            "text": "Hello from end-to-end test!",
        }, headers=_auth(u["token_a"]))
        assert resp.status_code == 200
        data = resp.json()
        assert data["plaintext"] == "Hello from end-to-end test!"
        assert data["from_user_id"] == u["user_id_a"]
        assert data["to_user_id"] == u["user_id_b"]

        # 用户 A 能查到
        resp_a = await client.get(
            f"/api/v1/chat/messages/p2p/history?with_user_id={u['user_id_b']}&limit=10",
            headers=_auth(u["token_a"]),
        )
        assert resp_a.status_code == 200
        items_a = resp_a.json()["items"]
        assert len(items_a) >= 1
        assert items_a[-1]["plaintext"] == "Hello from end-to-end test!"

        # 用户 B 也能查到
        resp_b = await client.get(
            f"/api/v1/chat/messages/p2p/history?with_user_id={u['user_id_a']}&limit=10",
            headers=_auth(u["token_b"]),
        )
        assert resp_b.status_code == 200
        items_b = resp_b.json()["items"]
        assert len(items_b) >= 1
        assert items_b[-1]["plaintext"] == "Hello from end-to-end test!"

        # 列出我的会话
        resp = await client.get("/api/v1/chat/conversations/mine", headers=_auth(u["token_b"]))
        assert resp.status_code == 200
        assert len(resp.json()["items"]) >= 1


# ===================== 群聊流程 =====================

class TestGroupFlow:
    """端到端群聊消息完整流程"""

    @pytest.mark.order(2)
    async def test_01_create_group_send_and_history(self, client: AsyncClient, group_trio: dict):
        from conftest import _auth, _unique_ts, _register, _login
        u = group_trio

        # X 添加 Y 和 Z 为好友
        for account in [u["account_y"], u["account_z"]]:
            resp = await client.post("/api/v1/chat/friends", json={
                "account_or_user_id": account,
            }, headers=_auth(u["token_x"]))
            assert resp.status_code == 200

        # 创建群聊
        resp = await client.post("/api/v1/chat/conversations", json={
            "type": "group",
            "member_ids": [u["user_id_y"], u["user_id_z"]],
        }, headers=_auth(u["token_x"]))
        assert resp.status_code == 200
        data = resp.json()
        group_id = data["conversation_id"]
        assert data["conversation_type"] == "group"
        assert data["key_epoch"] > 0

        # X 发群消息
        resp = await client.post("/api/v1/chat/messages/group", json={
            "conversation_id": group_id,
            "text": "Hello group!",
        }, headers=_auth(u["token_x"]))
        assert resp.status_code == 200
        data = resp.json()
        assert data["plaintext"] == "Hello group!"
        assert data["from_user_id"] == u["user_id_x"]

        # Y 也发一条
        resp = await client.post("/api/v1/chat/messages/group", json={
            "conversation_id": group_id,
            "text": "Msg from Y",
        }, headers=_auth(u["token_y"]))
        assert resp.status_code == 200
        data = resp.json()
        assert data["plaintext"] == "Msg from Y"
        assert data["from_user_id"] == u["user_id_y"]

        # Z 查群历史（成员视角）
        resp = await client.get(
            f"/api/v1/chat/messages/group/history?conversation_id={group_id}&limit=10",
            headers=_auth(u["token_z"]),
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) >= 2
        assert items[0]["plaintext"] == "Hello group!"
        assert items[0]["from_user_id"] == u["user_id_x"]
        assert items[1]["plaintext"] == "Msg from Y"
        assert items[1]["from_user_id"] == u["user_id_y"]

        # Y 列出我的会话
        resp = await client.get("/api/v1/chat/conversations/mine", headers=_auth(u["token_y"]))
        assert resp.status_code == 200
        group_ids = [item["conversation_id"] for item in resp.json()["items"] if item.get("type") == "group"]
        assert group_id in group_ids

    async def test_02_non_member_cannot_access(self, client: AsyncClient, group_trio: dict):
        """非群成员无法访问群聊历史"""
        from conftest import _auth, _unique_ts, _register, _login
        # 先创建群
        u = group_trio
        resp = await client.post("/api/v1/chat/conversations", json={
            "type": "group",
            "member_ids": [u["user_id_y"], u["user_id_z"]],
        }, headers=_auth(u["token_x"]))
        group_id = resp.json()["conversation_id"]

        # 创建第 4 个用户
        ts = _unique_ts()
        acc_w = f"134{ts[-8:]}"
        uname_w = f"userW_{ts[-6:]}"
        res_w = await _register(client, acc_w, uname_w)
        login_w = await _login(client, acc_w)
        token_w = login_w["access_token"]

        resp = await client.get(
            f"/api/v1/chat/messages/group/history?conversation_id={group_id}&limit=10",
            headers=_auth(token_w),
        )
        assert resp.status_code == 403


# ===================== 群聊文件流程 =====================

class TestGroupFileFlow:
    """端到端群聊文件上传/下载流程"""

    async def test_01_upload_and_download_group_file(self, client: AsyncClient, group_trio: dict):
        u = group_trio
        # 先创建群
        from conftest import _auth
        for account in [u["account_y"], u["account_z"]]:
            resp = await client.post("/api/v1/chat/friends", json={
                "account_or_user_id": account,
            }, headers=_auth(u["token_x"]))
            assert resp.status_code == 200

        resp = await client.post("/api/v1/chat/conversations", json={
            "type": "group",
            "member_ids": [u["user_id_y"], u["user_id_z"]],
        }, headers=_auth(u["token_x"]))
        group_id = resp.json()["conversation_id"]

        # X 上传群文件
        file_content = b"Hello group file content!"
        resp = await client.post(
            "/api/v1/chat/messages/group/file",
            data={"conversation_id": group_id},
            files={"file": ("test.txt", file_content, "text/plain")},
            headers=_auth(u["token_x"]),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "[文件]" in data["plaintext"]
        assert data["message_type"] == "file"
        assert data["from_user_id"] == u["user_id_x"]
        assert "test.txt" in data["plaintext"]

        # Y 查群历史能看到文件消息
        resp = await client.get(
            f"/api/v1/chat/messages/group/history?conversation_id={group_id}&limit=10",
            headers=_auth(u["token_y"]),
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        file_msgs = [i for i in items if i["message_type"] == "file"]
        assert len(file_msgs) >= 1
        assert "[文件] test.txt" in file_msgs[0]["plaintext"]


    async def test_02_non_member_cannot_upload(self, client: AsyncClient, group_trio: dict):
        """非群成员无法上传群文件"""
        from conftest import _auth, _unique_ts, _register, _login
        u = group_trio
        # 创建群
        resp = await client.post("/api/v1/chat/conversations", json={
            "type": "group",
            "member_ids": [u["user_id_y"], u["user_id_z"]],
        }, headers=_auth(u["token_x"]))
        group_id = resp.json()["conversation_id"]

        # 创建第 4 个用户
        ts = _unique_ts()
        acc_w = f"133{ts[-8:]}"
        uname_w = f"userW_{ts[-6:]}"
        await _register(client, acc_w, uname_w)
        login_w = await _login(client, acc_w)
        token_w = login_w["access_token"]

        resp = await client.post(
            "/api/v1/chat/messages/group/file",
            data={"conversation_id": group_id},
            files={"file": ("test.txt", b"secret", "text/plain")},
            headers=_auth(token_w),
        )
        assert resp.status_code == 403
