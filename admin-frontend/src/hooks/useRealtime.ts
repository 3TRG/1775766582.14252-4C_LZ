import { useEffect, useRef } from 'react';
import { useQKEStore } from '../store';
import { getAllUsers } from '../services/api';
import { qkeEventToProcessData } from '../utils/qkeProcessTypes';

export function useRealtime() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    const setWsConnected = useQKEStore.getState().setWsConnected;
    const addUser = useQKEStore.getState().addUser;
    const updateUserOnlineStatus = useQKEStore.getState().updateUserOnlineStatus;
    const addEvent = useQKEStore.getState().addEvent;
    const setUsers = useQKEStore.getState().setUsers;
    const qkeProcess = useQKEStore.getState().qkeProcess;
    const setQKEProcess = useQKEStore.getState().setQKEProcess;

    // 获取所有用户列表 - 只执行一次
    const fetchUsers = async () => {
      if (hasFetched.current) return;
      hasFetched.current = true;

      try {
        const data = await getAllUsers();
        if (data.length > 0) {
          setUsers(data);
        }
      } catch (e) {
        console.warn('[Realtime] 获取用户列表失败:', e);
      }
    };

    // 连接WebSocket
    const connectWebSocket = () => {
      // 优先使用环境变量 VITE_WS_BASE_URL，否则从当前页面 URL 推导
      const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL;
      let wsUrl: string;
      if (wsBaseUrl) {
        wsUrl = `${wsBaseUrl}/admin/realtime`;
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = import.meta.env.VITE_WS_PORT || '8000';
        wsUrl = `${protocol}//${host}:${port}/ws/admin/realtime`;
      }
      console.log('[Realtime] 连接WebSocket:', wsUrl);

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[Realtime] WebSocket连接成功');
          setWsConnected(true);
          fetchUsers();
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            const data = message.data ?? {};

            switch (message.type) {
              case 'connection_success':
                break;

              case 'user_registered':
                addUser({
                  user_id: message.data.user_id,
                  username: message.data.username,
                  phone: message.data.phone,
                  email: message.data.email,
                  role: message.data.role,
                  is_online: false,
                  created_at: message.data.created_at,
                });
                addEvent({
                  type: 'system',
                  level: 1,
                  summary: `新用户注册: ${message.data.username}`,
                  details: message.data,
                });
                break;

              case 'user_login':
                updateUserOnlineStatus(message.data.user_id, true);
                addEvent({ type: 'system', level: 2, summary: `用户登录: ${message.data.username}`, details: message.data });
                break;

              case 'user_logout':
                updateUserOnlineStatus(message.data.user_id, false);
                addEvent({ type: 'system', level: 2, summary: `用户登出: ${message.data.username}`, details: message.data });
                break;

              case 'qke_event': {
                const eType = String(data.event_type ?? '');
                const eStage = String(data.event_stage ?? '');

                // 更新 QKE 过程数据
                const updated = qkeEventToProcessData(eType, {
                  event_type: eType,
                  event_stage: eStage,
                  title: data.title,
                  round_number: data.round_number,
                  participant_count: data.payload?.participants?.length,
                  leaders: data.payload?.leaders,
                  state_type: data.payload?.state_type,
                  diff_positions: data.payload?.diff_positions,
                  key_length: data.payload?.key_length,
                  entropy: data.payload?.entropy,
                  qber: data.payload?.qber,
                }, useQKEStore.getState().qkeProcess);

                if (updated) setQKEProcess(updated);

                // 映射事件类型
                const typeMap: Record<string, typeof addEvent extends (e: { type: infer T }) => void ? T : string> = {
                  session_created: 'system',
                  leaders_elected: 'election',
                  round_started: 'qkd',
                  round_measured: 'measurement',
                  key_generated: 'verify',
                  protocol_completed: 'verify',
                  message_encrypted: 'sync',
                  message_delivered: 'stats',
                };
                const levelMap: Record<string, 1 | 2 | 3 | 4 | 5> = {
                  created: 1,
                  assign_role: 2,
                  transport: 2,
                  quantum_exchange: 3,
                  measure: 3,
                  verify: 4,
                  activate: 4,
                };
                const eventLevel = levelMap[eStage] ?? 2;

                addEvent({
                  type: (typeMap[eType] ?? 'system') as any,
                  level: eventLevel as any,
                  summary: String(data.title || 'QKE事件'),
                  details: data,
                });
                break;
              }

              case 'pong':
                break;

              default:
                break;
            }
          } catch (e) {
            console.error('[Realtime] 解析消息失败:', e);
          }
        };

        ws.onclose = () => {
          console.log('[Realtime] WebSocket连接断开');
          setWsConnected(false);
          wsRef.current = null;

          reconnectTimeoutRef.current = window.setTimeout(() => {
            console.log('[Realtime] 尝试重连...');
            connectWebSocket();
          }, 3000);
        };

        ws.onerror = (error) => {
          console.error('[Realtime] WebSocket错误:', error);
        };
      } catch (e) {
        console.error('[Realtime] 创建WebSocket失败:', e);
      }
    };

    fetchUsers();
    connectWebSocket();

    const pingInterval = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      clearInterval(pingInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return { wsRef };
}
