import { ref, onUnmounted } from 'vue';

export function useWebSocket(url: string, token: string, onMessage: (msg: any) => void) {
    const ws = ref<WebSocket | null>(null);
    const connected = ref(false);
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let wsUrl = url;

    function connect() {
        if (ws.value) {
            ws.value.close();
            ws.value = null;
        }
        // Replace http with ws and https with wss
        if (wsUrl.startsWith('https://')) {
            wsUrl = wsUrl.replace('https://', 'wss://');
        } else if (wsUrl.startsWith('http://')) {
            wsUrl = wsUrl.replace('http://', 'ws://');
        }
        ws.value = new WebSocket(wsUrl);
        ws.value.onopen = () => {
            connected.value = true;
            ws.value?.send(JSON.stringify({ type: 'auth', token }));
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
        };
        ws.value.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                console.log('WebSocket message received:', msg);
                onMessage(msg);
            } catch { }
        };
        ws.value.onclose = () => {
            connected.value = false;
            reconnectTimeout = setTimeout(() => {
                connect();
            }, 2000);
        };
        ws.value.onerror = () => {
            connected.value = false;
            ws.value?.close();
        };
    }

    connect();

    onUnmounted(() => {
        if (ws.value) {
            ws.value.close();
            ws.value = null;
        }
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
    });

    return { ws, connected };
}
