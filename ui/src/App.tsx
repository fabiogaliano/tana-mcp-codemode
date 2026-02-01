import { useState, useEffect, useRef, useCallback } from "react";
import {
  createWSClient,
  type ConnectionStatus,
  type WSMessage,
  type ExecutionResult,
  type WorkflowEvent,
} from "./lib/ws-client";
import { colors, typography, radius, spacing } from "./design-system";

const DEFAULT_CODE = `// Example: List workspaces
const workspaces = await tana.workspaces.list();
console.log({ workspaces });`;

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [tanaConnected, setTanaConnected] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const [code, setCode] = useState(DEFAULT_CODE);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("Ready to execute...");
  const [isError, setIsError] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEvent[]>([]);

  const clientRef = useRef<ReturnType<typeof createWSClient> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.substring(0, start) + "  " + code.substring(end);
      setCode(newCode);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const isConnected = status === "connected" && tanaConnected;

  return (
    <div className="debug-page">
      <div className="debug-layout">
        <div className="editor-panel">
          <div className="panel-header">
            <h2 className="panel-title">Script</h2>
            <StatusBadge
              status={status}
              tanaConnected={tanaConnected}
              clientError={clientError}
            />
          </div>

          <div className="editor-wrapper">
            <textarea
              ref={textareaRef}
              className="code-editor"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="// Write your TypeScript code here..."
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            <div className="editor-footer">
              <span className="hint">Cmd + Enter to run</span>
            </div>
          </div>

          <div className="input-section">
            <label className="input-label">Input Data (optional)</label>
            <textarea
              className="input-editor"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='{"nodeIds": ["abc", "def"]}'
              rows={3}
            />
          </div>

          <button
            className={`run-button ${isRunning ? "running" : ""}`}
            onClick={handleRun}
            disabled={!isConnected || isRunning}
          >
            {isRunning ? "Running..." : "Run Script"}
          </button>
        </div>

        <div className="output-panel">
          <div className="panel-header">
            <h2 className="panel-title">Output</h2>
            {durationMs !== null && (
              <div className="duration-badge">{durationMs}ms</div>
            )}
          </div>

          <pre className={`output-content ${isError ? "error" : ""}`}>
            {output}
          </pre>

          {sessionId && (
            <div className="session-info">
              <span className="session-label">Session</span>
              <code className="session-id">{sessionId}</code>
            </div>
          )}

          {workflowEvents.length > 0 && (
            <div className="workflow-section">
              <h3 className="workflow-title">Workflow Events</h3>
              <div className="workflow-list">
                {workflowEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`workflow-event ${event.eventType}`}
                  >
                    <span className="event-type">{event.eventType}</span>
                    <span className="event-message">{event.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

        .debug-page {
          padding: ${spacing.xl};
          background: ${colors.bg.deep};
          min-height: calc(100vh - 56px);
          font-family: ${typography.sans};
        }

        .debug-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: ${spacing.xl};
          max-width: 1600px;
          margin: 0 auto;
        }

        .editor-panel, .output-panel {
          background: ${colors.bg.elevated};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.lg};
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: ${spacing.lg};
          border-bottom: 1px solid ${colors.border.subtle};
          background: ${colors.bg.base};
        }

        .panel-title {
          font-size: ${typography.lg};
          font-weight: ${typography.semibold};
          color: ${colors.text.primary};
        }

        .editor-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .code-editor {
          flex: 1;
          width: 100%;
          min-height: 280px;
          padding: ${spacing.lg};
          font-family: ${typography.mono};
          font-size: 13px;
          line-height: 1.6;
          background: transparent;
          border: none;
          color: ${colors.text.primary};
          resize: none;
          outline: none;
        }

        .code-editor::placeholder {
          color: ${colors.text.muted};
        }

        .editor-footer {
          padding: ${spacing.sm} ${spacing.lg};
          border-top: 1px solid ${colors.border.subtle};
          background: ${colors.bg.base};
        }

        .hint {
          font-size: ${typography.xs};
          color: ${colors.text.muted};
        }

        .input-section {
          padding: ${spacing.lg};
          border-top: 1px solid ${colors.border.subtle};
        }

        .input-label {
          display: block;
          font-size: ${typography.xs};
          font-weight: ${typography.medium};
          color: ${colors.text.muted};
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: ${spacing.sm};
        }

        .input-editor {
          width: 100%;
          padding: ${spacing.md};
          font-family: ${typography.mono};
          font-size: 13px;
          line-height: 1.5;
          background: ${colors.bg.base};
          border: 1px solid ${colors.border.subtle};
          border-radius: ${radius.md};
          color: ${colors.text.primary};
          resize: vertical;
          outline: none;
          transition: border-color 150ms ease;
        }

        .input-editor:focus {
          border-color: ${colors.winner.secondary};
        }

        .run-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: ${spacing.sm};
          margin: ${spacing.lg};
          padding: ${spacing.md} ${spacing.xl};
          font-family: ${typography.sans};
          font-size: ${typography.base};
          font-weight: ${typography.semibold};
          color: ${colors.bg.deep};
          background: ${colors.winner.primary};
          border: none;
          border-radius: ${radius.md};
          cursor: pointer;
          transition: all 150ms ease;
        }

        .run-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }

        .run-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .run-button.running {
          background: ${colors.bg.hover};
          color: ${colors.text.secondary};
        }

        .output-content {
          flex: 1;
          margin: 0;
          padding: ${spacing.lg};
          font-family: ${typography.mono};
          font-size: 13px;
          line-height: 1.6;
          color: ${colors.text.secondary};
          white-space: pre-wrap;
          word-break: break-word;
          overflow: auto;
          min-height: 200px;
        }

        .output-content.error {
          color: ${colors.error};
        }

        .duration-badge {
          font-family: ${typography.mono};
          font-size: ${typography.xs};
          color: ${colors.winner.primary};
          background: ${colors.winner.primarySoft};
          padding: ${spacing.xs} ${spacing.sm};
          border-radius: ${radius.sm};
        }

        .session-info {
          display: flex;
          align-items: center;
          gap: ${spacing.sm};
          padding: ${spacing.md} ${spacing.lg};
          border-top: 1px solid ${colors.border.subtle};
          background: ${colors.bg.base};
        }

        .session-label {
          font-size: ${typography.xs};
          color: ${colors.text.muted};
          text-transform: uppercase;
        }

        .session-id {
          font-family: ${typography.mono};
          font-size: ${typography.xs};
          color: ${colors.text.secondary};
        }

        .workflow-section {
          border-top: 1px solid ${colors.border.subtle};
          padding: ${spacing.lg};
        }

        .workflow-title {
          font-size: ${typography.xs};
          font-weight: ${typography.semibold};
          color: ${colors.text.muted};
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: ${spacing.md};
        }

        .workflow-list {
          display: flex;
          flex-direction: column;
          gap: ${spacing.sm};
        }

        .workflow-event {
          display: flex;
          align-items: center;
          gap: ${spacing.sm};
          padding: ${spacing.sm} ${spacing.md};
          border-radius: ${radius.sm};
          font-size: ${typography.sm};
          background: ${colors.bg.base};
        }

        .event-type {
          font-weight: ${typography.medium};
          width: 70px;
          flex-shrink: 0;
        }

        .workflow-event.start .event-type { color: ${colors.winner.secondary}; }
        .workflow-event.step .event-type { color: ${colors.text.secondary}; }
        .workflow-event.progress .event-type { color: ${colors.winner.secondary}; }
        .workflow-event.complete .event-type { color: ${colors.winner.primary}; }
        .workflow-event.abort .event-type { color: ${colors.error}; }

        .event-message {
          color: ${colors.text.secondary};
        }

        @media (max-width: 1200px) {
          .debug-layout {
            grid-template-columns: 1fr;
          }
        }
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
          ? "Connected"
          : "Tana unavailable";

  return (
    <div
      className={`status-badge ${isConnected ? "connected" : "disconnected"}`}
      title={clientError || undefined}
    >
      <span className="status-dot" />
      <span>{label}</span>
      <style>{`
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 500;
        }
        .status-badge.connected {
          background: ${colors.winner.primarySoft};
          color: ${colors.winner.primary};
        }
        .status-badge.disconnected {
          background: ${colors.errorSoft};
          color: ${colors.error};
        }
        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }
      `}</style>
    </div>
  );
}
