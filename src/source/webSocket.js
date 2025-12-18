/**
 * @class WebSocketManager - 一个纯粹、强大的 WebSocket 连接管理引擎
 *
 * @features
 * - 智能断线重连 (指数退避算法)
 * - 网络状态监听
 * - 高度可定制的心跳保活机制 (通过注入函数实现)
 * - 页面可见性 API 集成
 * - 消息发送队列
 * - 清晰的生命周期管理
 * - 优雅的资源销毁
 * - 可配置的数据序列化/反序列化
 * - 纯粹的消息传递，不关心消息内容
 */
export class WebSocketManager {
    /**
     * @param {string} url - WebSocket 服务器的地址
     * @param {object} [options={}] - 配置选项
     * @param {number} [options.heartbeatInterval=30000] - 心跳间隔 (毫秒)
     * @param {number} [options.heartbeatTimeout=10000] - 心跳超时时间 (毫秒)
     * @param {number} [options.reconnectBaseInterval=1000] - 重连基础间隔 (毫秒)
     * @param {number} [options.maxReconnectInterval=30000] - 最大重连间隔 (毫秒)
     * @param {number} [options.maxReconnectAttempts=Infinity] - 最大重连次数
     * @param {boolean} [options.autoConnect=true] - 是否在实例化后自动连接
     * @param {boolean} [options.serializeData=false] - 发送数据时是否自动序列化为JSON字符串
     * @param {boolean} [options.deserializeData=false] - 接收数据时是否自动反序列化为JSON对象
     * @param {function|null} [options.getPingMessage=null] - 返回要发送的 ping 消息内容的函数。如果为 null，则不发送心跳。
     * @param {function|null} [options.isPongMessage=null] - 判断接收到的消息是否为 pong 的函数。接收 MessageEvent 对象作为参数，返回布尔值。
     * @param {object} [options.protocols] - WebSocket 协议
     */
    constructor(url, options = {}) {
        this.url = url;

        // 默认的心跳实现，用于向后兼容
        const defaultGetPingMessage = () => JSON.stringify({ type: "ping" });
        const defaultIsPongMessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                return message.type === "pong";
            } catch (e) {
                return false;
            }
        };

        this.options = {
            heartbeatInterval: 30000,
            heartbeatTimeout: 10000,
            reconnectBaseInterval: 1000,
            maxReconnectInterval: 30000,
            maxReconnectAttempts: Infinity,
            autoConnect: true,
            serializeData: false,
            deserializeData: false,
            getPingMessage: defaultGetPingMessage, // 默认提供 ping 消息生成器
            isPongMessage: defaultIsPongMessage, // 默认提供 pong 消息判断器
            ...options
        };

        // WebSocket 实例
        this.ws = null;

        // 状态管理
        this.readyState = WebSocket.CLOSED;
        this.reconnectAttempts = 0;
        this.forcedClose = false;
        this.isReconnecting = false;

        // 定时器
        this.heartbeatTimer = null;
        this.heartbeatTimeoutTimer = null;
        this.reconnectTimer = null;

        // 消息队列
        this.messageQueue = [];

        // 事件监听器
        this.listeners = new Map();

        // 绑定方法上下文
        this._onOpen = this._onOpen.bind(this);
        this._onMessage = this._onMessage.bind(this);
        this._onClose = this._onClose.bind(this);
        this._onError = this._onError.bind(this);
        this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
        this._handleOnline = this._handleOnline.bind(this);
        this._handleOffline = this._handleOffline.bind(this);

        this._setupEventListeners();

        if (this.options.autoConnect) {
            this.connect();
        }
    }

    // --- 公共 API ---

    /**
     * 连接到 WebSocket 服务器
     */
    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        this.forcedClose = false;
        this._updateReadyState(WebSocket.CONNECTING);
        console.log(`[WS] 正在连接到 ${this.url}...`);
        this._emit("connecting");

        try {
            this.ws = new WebSocket(this.url, this.options.protocols);
            this.ws.onopen = this._onOpen;
            this.ws.onmessage = this._onMessage;
            this.ws.onclose = this._onClose;
            this.ws.onerror = this._onError;
        } catch (error) {
            console.error("[WS] 连接失败:", error);
            this._onError(error);
        }
    }

    /**
     * 发送数据
     * @param {string|object|ArrayBuffer|Blob} data - 要发送的数据
     */
    send(data) {
        if (this.readyState === WebSocket.OPEN) {
            let message;
            // 根据配置决定是否序列化数据
            if (this.options.serializeData) {
                message = JSON.stringify(data);
            } else {
                message = data;
            }
            this.ws.send(message);
            console.log("[WS] 消息已发送:", message);
        } else {
            console.warn("[WS] 连接未打开，消息已加入队列:", data);
            this.messageQueue.push(data);
        }
    }

    /**
     * 主动关闭连接
     * @param {number} [code=1000] - 关闭代码
     * @param {string} [reason=''] - 关闭原因
     */
    close(code = 1000, reason = "Normal closure") {
        this.forcedClose = true;
        this._stopHeartbeat();
        this._clearReconnectTimer();
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close(code, reason);
        } else {
            this._updateReadyState(WebSocket.CLOSED);
            this._emit("close", { code, reason, wasClean: true });
        }
    }

    /**
     * 彻底销毁实例，清理所有资源
     */
    destroy() {
        console.log("[WS] 正在销毁实例...");
        this.close(1000, "Instance destroyed");
        this._removeEventListeners();
        this.messageQueue = [];
        this.listeners.clear();
        this.ws = null;
    }

    /**
     * 添加事件监听器
     * @param {string} eventName - 事件名 (e.g., 'open', 'message', 'close', 'error', 'reconnect')
     * @param {function} callback - 回调函数
     */
    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName).push(callback);
    }

    /**
     * 移除事件监听器
     * @param {string} eventName - 事件名
     * @param {function} callback - 回调函数
     */
    off(eventName, callback) {
        if (this.listeners.has(eventName)) {
            const callbacks = this.listeners.get(eventName);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    // --- 内部方法 ---

    _onOpen(event) {
        console.log("[WS] 连接已建立");
        this._updateReadyState(WebSocket.OPEN);
        this.reconnectAttempts = 0;
        this.isReconnecting = false;

        // 如果配置了 getPingMessage，则启动心跳
        if (this.options.getPingMessage) {
            this._startHeartbeat();
        }

        this._flushMessageQueue();
        this._emit("open", event);
    }

    /**
     * 纯粹的消息处理方法：处理心跳，然后将数据交给使用者
     * @param {MessageEvent} event
     */
    _onMessage(event) {
        // --- 步骤 1: 使用注入的函数优先处理内部心跳机制 ---
        if (this.options.isPongMessage && this.options.isPongMessage(event)) {
            this._handlePong();
            return; // 是心跳消息，处理完毕，直接返回
        }

        // --- 步骤 2: 根据用户配置处理业务消息 ---
        if (this.options.deserializeData) {
            try {
                const parsedMessage = JSON.parse(event.data);
                this._emit("message", parsedMessage, event);
            } catch (e) {
                this._emit("message", event.data, event);
            }
        } else {
            this._emit("message", event.data, event);
        }
    }

    _onClose(event) {
        console.log("[WS] 连接已关闭", event);
        this._updateReadyState(WebSocket.CLOSED);
        this._stopHeartbeat();
        this._emit("close", event);

        if (!this.forcedClose) {
            this._scheduleReconnect();
        }
    }

    _onError(event) {
        console.error("[WS] 连接发生错误:", event);
        this._emit("error", event);
    }

    // --- 心跳机制 ---
    _startHeartbeat() {
        // 如果没有配置 getPingMessage，则无法启动心跳
        if (!this.options.getPingMessage) {
            return;
        }

        this._stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    // 调用注入的函数获取消息内容并发送
                    const pingMessage = this.options.getPingMessage();
                    this.ws.send(pingMessage);
                    console.log("[WS] 发送 Ping:", pingMessage);
                    this._setHeartbeatTimeout();
                } catch (error) {
                    console.error("[WS] 发送 Ping 消息失败:", error);
                }
            }
        }, this.options.heartbeatInterval);
    }

    _stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        this._clearHeartbeatTimeout();
    }

    _setHeartbeatTimeout() {
        this._clearHeartbeatTimeout();
        this.heartbeatTimeoutTimer = setTimeout(() => {
            console.error("[WS] 心跳超时，主动断开连接");
            this.ws.close(1006, "Heartbeat timeout");
        }, this.options.heartbeatTimeout);
    }

    _clearHeartbeatTimeout() {
        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer);
            this.heartbeatTimeoutTimer = null;
        }
    }

    _handlePong() {
        console.log("[WS] 收到 Pong");
        this._clearHeartbeatTimeout();
    }

    // --- 重连机制 ---
    _scheduleReconnect() {
        if (this.forcedClose || this.isReconnecting || this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
                console.error("[WS] 已达到最大重连次数，停止重连");
                this._emit("reconnect-failed");
            }
            return;
        }

        this.isReconnecting = true;
        const interval = Math.min(this.options.reconnectBaseInterval * Math.pow(2, this.reconnectAttempts), this.options.maxReconnectInterval);

        console.log(`[WS] ${interval / 1000}秒后将尝试第 ${this.reconnectAttempts + 1} 次重连...`);
        this._emit("reconnect-attempt", { attempt: this.reconnectAttempts + 1, interval });

        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, interval);
    }

    _clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    // --- 消息队列 ---
    _flushMessageQueue() {
        if (this.messageQueue.length === 0) return;
        console.log(`[WS] 发送队列中的 ${this.messageQueue.length} 条消息`);
        const queue = [...this.messageQueue];
        this.messageQueue = [];
        queue.forEach((data) => this.send(data));
    }

    // --- 事件系统 ---
    _emit(eventName, ...args) {
        if (this.listeners.has(eventName)) {
            this.listeners.get(eventName).forEach((callback) => callback(...args));
        }
    }

    // --- 状态与监听器管理 ---
    _updateReadyState(newState) {
        this.readyState = newState;
        this._emit("ready-state-change", newState);
    }

    _setupEventListeners() {
        document.addEventListener("visibilitychange", this._handleVisibilityChange);
        window.addEventListener("online", this._handleOnline);
        window.addEventListener("offline", this._handleOffline);
    }

    _removeEventListeners() {
        document.removeEventListener("visibilitychange", this._handleVisibilityChange);
        window.removeEventListener("online", this._handleOnline);
        window.removeEventListener("offline", this._handleOffline);
    }

    _handleVisibilityChange() {
        // 如果未启用心跳，不需要处理页面可见性变化
        if (!this.options.getPingMessage) {
            return;
        }

        if (document.hidden) {
            console.log("[WS] 页面隐藏，停止心跳");
            this._stopHeartbeat();
        } else {
            console.log("[WS] 页面可见，检查连接状态");
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this._startHeartbeat();
            } else if (!this.forcedClose && !this.isReconnecting) {
                this.connect();
            }
        }
    }

    _handleOnline() {
        console.log("[WS] 网络已恢复，尝试重连");
        if (!this.forcedClose && this.readyState !== WebSocket.OPEN) {
            this._clearReconnectTimer(); // 清除当前的重连计划
            this.connect(); // 立即尝试连接
        }
    }

    _handleOffline() {
        console.log("[WS] 网络已断开");
        this._clearReconnectTimer(); // 停止重连尝试
        // ws.onclose 会被触发，从而启动重连逻辑，但我们已经停止了
        // 所以这里可以手动触发一次 close 事件来通知应用层
        if (this.ws) this.ws.onclose({ code: 1006, reason: "Network offline" });
    }
}
