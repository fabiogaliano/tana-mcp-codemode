import { useState, useEffect, useRef, useCallback } from "react";
import {
  createWSClient,
  type ConnectionStatus,
  type WSMessage,
  type ExecutionResult,
  type WorkflowEvent,
} from "./lib/ws-client";

const DEFAULT_CODE = `// Example: List workspaces
const workspaces = await tana.workspaces.list();
console.log({ workspaces });`;

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [tanaConnected, setTanaConnected] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const [code, setCode] = useState(DEFAULT_CODE);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("Ready");
  const [isError, setIsError] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEvent[]>([]);

  const clientRef = useRef<ReturnType<typeof createWSClient> | null>(null);

  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case "connected":
        setTanaConnected(message.tanaConnected);
        setClientError(message.clientError);
        if (message.clientError) {
          setOutput(`Warning: ${message.clientError}`);
        }
        break;

      case "started":
        setOutput("Executing...");
        setIsError(false);
        setSessionId(message.sessionId);
        setWorkflowEvents([]);
        break;

      case "result": {
        const result = message as ExecutionResult;
        setOutput(
          result.output || (result.error ? `Error: ${result.error}` : "(no output)")
        );
        setIsError(!!result.error);
        setDurationMs(result.durationMs);
        setIsRunning(false);
        setWorkflowEvents(result.workflowEvents || []);
        break;
      }

      case "error":
        setOutput(`Error: ${message.error}`);
        setIsError(true);
        setIsRunning(false);
        break;
    }
  }, []);

  useEffect(() => {
    clientRef.current = createWSClient({
      onMessage: handleMessage,
      onStatusChange: setStatus,
    });

    return () => {
      clientRef.current?.disconnect();
    };
  }, [handleMessage]);

  const handleRun = () => {
    if (!clientRef.current || status !== "connected") return;
    setIsRunning(true);
    setDurationMs(null);
    clientRef.current.execute(code, input || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Tana MCP Debug</h1>
        <StatusBadge
          status={status}
          tanaConnected={tanaConnected}
          clientError={clientError}
        />
      </header>

      <section className="section">
        <textarea
          className="editor"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="// Write your script here"
          spellCheck={false}
        />
      </section>

      <section className="row">
        <div className="input-group">
          <label>Input Data (optional)</label>
          <textarea
            className="input-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"nodeIds": ["abc", "def"]}'
            rows={2}
          />
        </div>
        <div className="input-group" style={{ flex: "0 0 auto" }}>
          <label>&nbsp;</label>
          <button
            className="btn btn-primary"
            onClick={handleRun}
            disabled={status !== "connected" || isRunning}
          >
            {isRunning ? "Running..." : "Run"}
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-title">Output</div>
        <pre className={`output ${isError ? "error" : ""}`}>{output}</pre>
        {(durationMs !== null || sessionId) && (
          <div className="meta">
            {durationMs !== null && `Completed in ${durationMs}ms`}
            {durationMs !== null && sessionId && " | "}
            {sessionId && `Session: ${sessionId}`}
          </div>
        )}
      </section>

      {workflowEvents.length > 0 && (
        <section className="section">
          <div className="section-title">Workflow Events</div>
          <div className="workflow">
            {workflowEvents.map((event) => (
              <div key={event.id} className={`workflow-event ${event.eventType}`}>
                <span className="type">{event.eventType}</span>
                <span className="message">{event.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }
        h1 {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .section {
          margin-bottom: 1.5rem;
        }
        .section-title {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }
        .editor {
          width: 100%;
          min-height: 200px;
          padding: 1rem;
          font-family: "SF Mono", Monaco, Consolas, monospace;
          font-size: 14px;
          line-height: 1.5;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          color: var(--text-primary);
          resize: vertical;
        }
        .editor:focus {
          outline: none;
          border-color: var(--accent);
        }
        .row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .input-group {
          flex: 1;
        }
        .input-group label {
          display: block;
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 0.25rem;
        }
        .input-textarea {
          width: 100%;
          padding: 0.5rem;
          font-family: "SF Mono", Monaco, Consolas, monospace;
          font-size: 14px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 0.25rem;
          color: var(--text-primary);
          resize: vertical;
        }
        .input-textarea:focus {
          outline: none;
          border-color: var(--accent);
        }
        .btn {
          padding: 0.5rem 1.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-primary {
          background: var(--accent);
          color: white;
          border: none;
        }
        .btn-primary:hover {
          background: var(--accent-hover);
        }
        .btn-primary:disabled {
          background: #1e40af;
          cursor: not-allowed;
        }
        .output {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 1rem;
          font-family: "SF Mono", Monaco, Consolas, monospace;
          font-size: 13px;
          white-space: pre-wrap;
          word-break: break-word;
          min-height: 150px;
          max-height: 400px;
          overflow: auto;
          margin: 0;
        }
        .output.error {
          border-color: var(--error);
        }
        .meta {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 0.5rem;
        }
        .workflow {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }
        .workflow-event {
          padding: 0.25rem 0;
          display: flex;
          gap: 0.5rem;
        }
        .workflow-event .type {
          font-weight: 500;
          width: 80px;
          flex-shrink: 0;
        }
        .workflow-event.start .type { color: var(--accent); }
        .workflow-event.step .type { color: var(--text-secondary); }
        .workflow-event.progress .type { color: var(--warning); }
        .workflow-event.complete .type { color: var(--success); }
        .workflow-event.abort .type { color: var(--error); }
      `}</style>
    </div>
  );
}

function StatusBadge({
  status,
  tanaConnected,
  clientError,
}: {
  status: ConnectionStatus;
  tanaConnected: boolean;
  clientError: string | null;
}) {
  const isConnected = status === "connected" && tanaConnected;
  const label =
    status === "connecting"
      ? "Connecting..."
      : status === "disconnected"
        ? "Disconnected"
        : tanaConnected
          ? "Connected to Tana"
          : clientError
            ? "Tana not connected"
            : "Checking...";

  return (
    <div
      className={`status-badge ${isConnected ? "connected" : "disconnected"}`}
      title={clientError || undefined}
    >
      <span className="dot" />
      <span>{label}</span>
      <style>{`
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.875rem;
        }
        .status-badge.connected {
          background: #14532d;
          color: #4ade80;
        }
        .status-badge.disconnected {
          background: #450a0a;
          color: #f87171;
        }
        .status-badge .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
        }
      `}</style>
    </div>
  );
}
