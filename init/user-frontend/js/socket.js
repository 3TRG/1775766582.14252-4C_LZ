/**
 * WebSocket 实时通信客户端
 * 对接后端 /ws/user?token=xxx 端点
 * 负责建立和维护与服务器的实时连接，处理消息的发送和接收
 */

class WebSocketClient {
    constructor() {
        this.ws = null;
        this.url = null;
        this.token = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
        this.eventHandlers = new Map();
        this.pendingMessages = [];
        this.isInitializing = false;
        this.offlineStorageKey = 'ws_offline_messages';
        this.heartbeatInterval = null;
        this.isHeartbeatEnabled = true;

        this._restoreOfflineMessages();
    }

    /**
     * 初始化 WebSocket 连接
     * @param {string} baseUrl - 服务器基础 URL (如 ws://localhost:8000)
     * @param {string} token - 认证 token
     */
    async connect(baseUrl, token) {
        if (this.isInitializing || this.ws) {
            return;
        }

        this.isInitializing = true;
        this.url = this._buildWsUrl(baseUrl);
        this.token = token;

        try {
            const wsUrl = this.url + '/ws/user?token=' + encodeURIComponent(this.token);
            this.ws = new WebSocket(wsUrl);

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.ws.close();
                    this.isInitializing = false;
                    reject(new Error('WebSocket 连接超时'));
                }, 15000);

                this.ws.onopen = () => {
                    clearTimeout(timeout);
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.isInitializing = false;
                    console.log('[WS] 已连接到服务器');

                    if (this.isHeartbeatEnabled) {
                        this._startHeartbeat();
                    }

                    this._flushPendingMessages();
                    this._callEventHandlers('connect');
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this._callEventHandlers('message', message);
                    } catch (e) {
                        console.error('[WS] 解析消息失败:', e);
                    }
                };

                this.ws.onerror = (error) => {
                    clearTimeout(timeout);
                    this.isInitializing = false;
                    console.error('[WS] 连接错误:', error);
                    reject(error);
                };

                this.ws.onclose = (event) => {
                    this._onClose(event);
                    clearTimeout(timeout);
                    this.isInitializing = false;
                    reject(new Error('WebSocket 连接被拒绝'));
                };
            });
        } catch (error) {
            this.isInitializing = false;
            console.error('[WS] 初始化连接失败:', error);
            this._handleReconnect();
            throw error;
        }
    }

    /**
     * 发送消息
     * @param {string} type - 消息类型
     * @param {Object} data - 消息数据
     */
    emit(type, data) {
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, data: data || {} }));
        } else {
            this.pendingMessages.push({ type, data });
            console.log('[WS] 消息已加入待发送队列:', type);
            this._persistOfflineMessages();
            if (!this.isInitializing && !this.ws) {
                this._handleReconnect();
            }
        }
    }

    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
        return () => this.off(event, handler);
    }

    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index !== -1) handlers.splice(index, 1);
        }
    }

    getConnectionStatus() {
        return this.isConnected;
    }

    disconnect() {
        this._clearHeartbeatTimers();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.isInitializing = false;
        console.log('[WS] 已断开连接');
        this._callEventHandlers('disconnect');
    }

    _onClose(event) {
        this.isConnected = false;
        this._clearHeartbeatTimers();
        console.log('[WS] 连接已断开，代码:', event.code, '原因:', event.reason);
        this._callEventHandlers('disconnect', event);
        if (event.code !== 1000) {
            this._handleReconnect();
        }
    }

    _handleReconnect() {
        if (this.isInitializing || this.reconnectAttempts >= this.maxReconnectAttempts) {
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('[WS] 已达到最大重连尝试次数，停止重连');
            }
            return;
        }

        this.reconnectAttempts++;
        const baseDelay = Math.min(
            this.reconnectDelay * Math.pow(2, Math.min(this.reconnectAttempts - 1, 3)),
            this.maxReconnectDelay
        );
        const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
        const delay = Math.max(1000, baseDelay + jitter);

        console.log('[WS]', delay, '毫秒后重新连接 (第', this.reconnectAttempts, '次)');

        setTimeout(() => {
            if (!this.isConnected && !this.isInitializing) {
                this._attemptReconnect();
            }
        }, delay);
    }

    _attemptReconnect() {
        if (this.isInitializing || !this.url || !this.token) return;
        console.log('[WS] 正在重新连接...');
        this.connect(this.url, this.token).catch(() => {});
    }

    _buildWsUrl(baseUrl) {
        let url = baseUrl;
        if (url.startsWith('http://')) {
            url = url.replace('http://', 'ws://');
        } else if (url.startsWith('https://')) {
            url = url.replace('https://', 'wss://');
        }
        // 去掉 API 路径前缀（如 /api/v1）
        const idx = url.lastIndexOf('/api');
        if (idx >= 0) {
            url = url.substring(0, idx);
        }
        return url;
    }

    _startHeartbeat() {
        this._clearHeartbeatTimers();
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.emit('ping', {});
            }
        }, 30000);
    }

    _clearHeartbeatTimers() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    _persistOfflineMessages() {
        try {
            if (this.pendingMessages.length > 0) {
                localStorage.setItem(this.offlineStorageKey, JSON.stringify(this.pendingMessages));
            } else {
                localStorage.removeItem(this.offlineStorageKey);
            }
        } catch (e) {}
    }

    _restoreOfflineMessages() {
        try {
            const stored = localStorage.getItem(this.offlineStorageKey);
            if (stored) {
                this.pendingMessages = JSON.parse(stored);
                console.log('[WS] 恢复了', this.pendingMessages.length, '条离线消息');
            }
        } catch (e) {
            this.pendingMessages = [];
        }
    }

    _flushPendingMessages() {
        if (this.pendingMessages.length === 0 || !this.isConnected) return;

        const toSend = [...this.pendingMessages];
        this.pendingMessages = [];

        toSend.forEach(({ type, data }) => {
            try {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type, data: data || {} }));
                }
            } catch (e) {
                this.pendingMessages.push({ type, data });
            }
        });

        this._persistOfflineMessages();
    }

    _callEventHandlers(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('[WS] 事件处理器异常:', event, error);
                }
            });
        }
    }
}

// 创建全局 WebSocket 客户端实例
const wsClient = new WebSocketClient();
window.wsClient = wsClient;
