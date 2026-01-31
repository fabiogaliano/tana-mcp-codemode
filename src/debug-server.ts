#!/usr/bin/env bun
/**
 * Debug Server - WebSocket UI for Testing
 *
 * Provides a web-based interface for testing Tana API scripts.
 * Run with: bun run src/debug-server.ts
 * Open: http://localhost:3333
 */

import { createClient } from "./tana-client";
import { createTanaAPI } from "./tana-api";
import { executeSandbox } from "./sandbox";
import { getWorkflowEvents, getRecentWorkflows } from "./workflow";
import { initDb } from "./history";

const PORT = parseInt(process.env.DEBUG_PORT || "3333", 10);

interface ExecuteRequest {
  type: "execute";
  code: string;
  sessionId?: string;
  input?: string;
}

interface GetWorkflowRequest {
  type: "getWorkflow";
  sessionId: string;
}

interface ListWorkflowsRequest {
  type: "listWorkflows";
  limit?: number;
}

type WebSocketMessage = ExecuteRequest | GetWorkflowRequest | ListWorkflowsRequest;

async function main() {
  initDb();

  let tana: ReturnType<typeof createTanaAPI> | null = null;
  let clientError: string | null = null;

  try {
    const client = createClient();
    tana = createTanaAPI(client);
  } catch (e) {
    clientError = e instanceof Error ? e.message : String(e);
    console.error("Warning: Could not create Tana client:", clientError);
  }

  const server = Bun.serve({
    port: PORT,
    async fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket upgrade
      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req);
        if (!upgraded) {
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        return undefined;
      }

      // Serve static files from ui/dist
      if (url.pathname === "/" || url.pathname === "/index.html") {
        const file = Bun.file("./ui/dist/index.html");
        if (await file.exists()) {
          return new Response(file, {
            headers: { "Content-Type": "text/html" },
          });
        }
        return new Response(getEmbeddedUI(), {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Serve assets
      if (url.pathname.startsWith("/assets/")) {
        const file = Bun.file(`./ui/dist${url.pathname}`);
        if (await file.exists()) {
          const ext = url.pathname.split(".").pop();
          const contentType =
            ext === "js" ? "application/javascript" :
            ext === "css" ? "text/css" :
            "application/octet-stream";
          return new Response(file, { headers: { "Content-Type": contentType } });
        }
      }

      // Health check
      if (url.pathname === "/health") {
        return Response.json({ status: "ok", tanaConnected: !!tana, clientError });
      }

      return new Response("Not found", { status: 404 });
    },

    websocket: {
      async message(ws, message) {
        try {
          const data = JSON.parse(String(message)) as WebSocketMessage;

          switch (data.type) {
            case "execute": {
              if (!tana) {
                ws.send(JSON.stringify({
                  type: "error",
                  error: clientError || "Tana client not initialized",
                }));
                return;
              }

              const sessionId = data.sessionId || crypto.randomUUID();
              ws.send(JSON.stringify({ type: "started", sessionId }));

              const result = await executeSandbox(
                data.code,
                tana,
                sessionId,
                data.input
              );

              const events = getWorkflowEvents(sessionId);

              ws.send(JSON.stringify({
                type: "result",
                sessionId,
                ...result,
                workflowEvents: events,
              }));
              break;
            }

            case "getWorkflow": {
              const events = getWorkflowEvents(data.sessionId);
              ws.send(JSON.stringify({
                type: "workflow",
                sessionId: data.sessionId,
                events,
              }));
              break;
            }

            case "listWorkflows": {
              const workflows = getRecentWorkflows(data.limit ?? 20);
              ws.send(JSON.stringify({
                type: "workflows",
                workflows,
              }));
              break;
            }

            default:
              ws.send(JSON.stringify({
                type: "error",
                error: "Unknown message type",
              }));
          }
        } catch (e) {
          ws.send(JSON.stringify({
            type: "error",
            error: e instanceof Error ? e.message : String(e),
          }));
        }
      },

      open(ws) {
        console.log("Client connected");
        ws.send(JSON.stringify({
          type: "connected",
          tanaConnected: !!tana,
          clientError,
        }));
      },

      close() {
        console.log("Client disconnected");
      },
    },
  });

  console.log(`Debug server running at http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  if (clientError) {
    console.log(`Warning: ${clientError}`);
  }
}

function getEmbeddedUI(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tana MCP Debug</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0a0a0a;
      color: #e4e4e7;
      min-height: 100vh;
      padding: 1rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; color: #fff; }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }
    .status.connected { background: #14532d; color: #4ade80; }
    .status.disconnected { background: #450a0a; color: #f87171; }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }
    .editor {
      width: 100%;
      min-height: 200px;
      padding: 1rem;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 14px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      color: #e4e4e7;
      resize: vertical;
      margin-bottom: 1rem;
    }
    .editor:focus { outline: none; border-color: #3b82f6; }
    .row { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .input-group { flex: 1; }
    .input-group label { display: block; font-size: 0.875rem; color: #a1a1aa; margin-bottom: 0.25rem; }
    .input-group input, .input-group textarea {
      width: 100%;
      padding: 0.5rem;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 14px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.25rem;
      color: #e4e4e7;
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
      background: #3b82f6;
      color: white;
      border: none;
    }
    .btn-primary:hover { background: #2563eb; }
    .btn-primary:disabled { background: #1e40af; cursor: not-allowed; }
    .output {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      padding: 1rem;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
      min-height: 150px;
      max-height: 400px;
      overflow: auto;
    }
    .output.error { border-color: #dc2626; }
    .section { margin-bottom: 1.5rem; }
    .section-title { font-size: 0.875rem; color: #a1a1aa; margin-bottom: 0.5rem; }
    .workflow {
      font-size: 0.875rem;
      color: #a1a1aa;
    }
    .workflow-event {
      padding: 0.25rem 0;
      display: flex;
      gap: 0.5rem;
    }
    .workflow-event .type {
      font-weight: 500;
      width: 80px;
    }
    .workflow-event.start .type { color: #3b82f6; }
    .workflow-event.step .type { color: #a1a1aa; }
    .workflow-event.progress .type { color: #eab308; }
    .workflow-event.complete .type { color: #22c55e; }
    .workflow-event.abort .type { color: #ef4444; }
    .meta { font-size: 0.75rem; color: #71717a; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Tana MCP Debug</h1>
    <div id="status" class="status disconnected">
      <span class="dot"></span>
      <span>Connecting...</span>
    </div>

    <div class="section">
      <textarea id="code" class="editor" placeholder="// Write your script here
const workspaces = await tana.workspaces.list();
console.log({ workspaces });"></textarea>
    </div>

    <div class="row">
      <div class="input-group">
        <label>Input Data (optional)</label>
        <textarea id="input" rows="2" placeholder='{"nodeIds": ["abc", "def"]}'></textarea>
      </div>
      <div class="input-group" style="flex: 0 0 auto;">
        <label>&nbsp;</label>
        <button id="run" class="btn btn-primary" disabled>Run</button>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Output</div>
      <div id="output" class="output">Ready</div>
      <div id="meta" class="meta"></div>
    </div>

    <div class="section" id="workflow-section" style="display: none;">
      <div class="section-title">Workflow Events</div>
      <div id="workflow" class="workflow"></div>
    </div>
  </div>

  <script>
    const statusEl = document.getElementById('status');
    const codeEl = document.getElementById('code');
    const inputEl = document.getElementById('input');
    const runBtn = document.getElementById('run');
    const outputEl = document.getElementById('output');
    const metaEl = document.getElementById('meta');
    const workflowSection = document.getElementById('workflow-section');
    const workflowEl = document.getElementById('workflow');

    let ws = null;
    let connected = false;

    function connect() {
      ws = new WebSocket(\`ws://\${location.host}/ws\`);

      ws.onopen = () => {
        connected = true;
        runBtn.disabled = false;
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'connected':
            statusEl.className = 'status ' + (data.tanaConnected ? 'connected' : 'disconnected');
            statusEl.innerHTML = '<span class="dot"></span><span>' +
              (data.tanaConnected ? 'Connected to Tana' : 'Tana not connected') + '</span>';
            if (data.clientError) {
              outputEl.textContent = 'Warning: ' + data.clientError;
            }
            break;

          case 'started':
            outputEl.textContent = 'Executing...';
            outputEl.className = 'output';
            metaEl.textContent = 'Session: ' + data.sessionId;
            break;

          case 'result':
            outputEl.textContent = data.output || (data.error ? 'Error: ' + data.error : '(no output)');
            outputEl.className = 'output' + (data.error ? ' error' : '');
            metaEl.textContent = 'Completed in ' + data.durationMs + 'ms | Session: ' + data.sessionId;
            runBtn.disabled = false;

            if (data.workflowEvents && data.workflowEvents.length > 0) {
              workflowSection.style.display = 'block';
              workflowEl.innerHTML = data.workflowEvents.map(e =>
                '<div class="workflow-event ' + e.eventType + '">' +
                '<span class="type">' + e.eventType + '</span>' +
                '<span>' + e.message + '</span></div>'
              ).join('');
            } else {
              workflowSection.style.display = 'none';
            }
            break;

          case 'error':
            outputEl.textContent = 'Error: ' + data.error;
            outputEl.className = 'output error';
            runBtn.disabled = false;
            break;
        }
      };

      ws.onclose = () => {
        connected = false;
        runBtn.disabled = true;
        statusEl.className = 'status disconnected';
        statusEl.innerHTML = '<span class="dot"></span><span>Disconnected</span>';
        setTimeout(connect, 2000);
      };
    }

    runBtn.addEventListener('click', () => {
      if (!connected || !ws) return;
      runBtn.disabled = true;
      workflowSection.style.display = 'none';

      ws.send(JSON.stringify({
        type: 'execute',
        code: codeEl.value,
        input: inputEl.value || undefined,
      }));
    });

    // Ctrl+Enter to run
    codeEl.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runBtn.click();
      }
    });

    connect();
  </script>
</body>
</html>`;
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
