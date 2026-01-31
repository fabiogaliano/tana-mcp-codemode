export interface WorkflowEvent {
  id: number;
  sessionId: string;
  timestamp: number;
  eventType: "start" | "step" | "progress" | "complete" | "abort";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionResult {
  type: "result";
  sessionId: string;
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
  workflowEvents: WorkflowEvent[];
}

export interface ConnectedMessage {
  type: "connected";
  tanaConnected: boolean;
  clientError: string | null;
}

export interface StartedMessage {
  type: "started";
  sessionId: string;
}

export interface ErrorMessage {
  type: "error";
  error: string;
}

export type WSMessage =
  | ConnectedMessage
  | StartedMessage
  | ExecutionResult
  | ErrorMessage;

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface WSClientConfig {
  url?: string;
  reconnectDelay?: number;
  onMessage: (message: WSMessage) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

export function createWSClient(config: WSClientConfig) {
  const url = config.url || `ws://${window.location.host}/ws`;
  const reconnectDelay = config.reconnectDelay || 2000;

  let ws: WebSocket | null = null;
  let shouldReconnect = true;

  function connect() {
    config.onStatusChange("connecting");
    ws = new WebSocket(url);

    ws.onopen = () => {
      config.onStatusChange("connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessage;
        config.onMessage(data);
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onclose = () => {
      config.onStatusChange("disconnected");
      if (shouldReconnect) {
        setTimeout(connect, reconnectDelay);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  function send(message: unknown) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function execute(code: string, input?: string) {
    send({
      type: "execute",
      code,
      input: input || undefined,
    });
  }

  function disconnect() {
    shouldReconnect = false;
    ws?.close();
  }

  connect();

  return {
    execute,
    send,
    disconnect,
  };
}
