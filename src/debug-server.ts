#!/usr/bin/env bun
/**
 * Debug Server - WebSocket UI for Testing
 *
 * Provides a web-based interface for testing Tana API scripts.
 * Run with: bun run src/debug-server.ts
 * Open: http://localhost:3333
 *
 * In dev mode, proxies to Vite for hot-reload and dynamic glob resolution.
 */

import { createClient } from "./api/client";
import { createTanaAPI } from "./api/tana";
import { executeSandbox } from "./sandbox/executor";
import { getWorkflowEvents, getRecentWorkflows } from "./sandbox/workflow";
import { initDb } from "./storage/history";
import { spawn, type Subprocess } from "bun";

const PORT = parseInt(process.env.DEBUG_PORT || "3333", 10);
const VITE_PORT = 5188; // Use unique port to avoid conflicts
let viteProcess: Subprocess | null = null;

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

async function startVite(): Promise<void> {
  console.log("Starting Vite dev server...");

  viteProcess = spawn({
    cmd: ["bunx", "vite", "--port", String(VITE_PORT), "--strictPort"],
    cwd: "./ui",
    stdout: "inherit",
    stderr: "inherit",
  });

  // Wait for Vite to be ready
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://localhost:${VITE_PORT}`, { method: "HEAD" });
      if (res.ok) {
        console.log("Vite dev server ready");
        return;
      }
    } catch {
      // Not ready yet
    }
    await Bun.sleep(200);
  }
  console.warn("Vite may not be fully ready, continuing anyway...");
}

async function proxyToVite(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const viteUrl = `http://localhost:${VITE_PORT}${url.pathname}${url.search}`;

  try {
    const proxyReq = new Request(viteUrl, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
    return await fetch(proxyReq);
  } catch (e) {
    return new Response(`Vite proxy error: ${e}`, { status: 502 });
  }
}

async function main() {
  initDb();

  // Start Vite dev server for dynamic glob resolution
  await startVite();

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

      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req);
        if (!upgraded) {
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        return undefined;
      }

      if (url.pathname === "/health") {
        return Response.json({ status: "ok", tanaConnected: !!tana, clientError });
      }

      // Proxy everything else to Vite dev server
      return proxyToVite(req);
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
                sessionId
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
  console.log(`Vite dev server: http://localhost:${VITE_PORT} (proxied)`);
  if (clientError) {
    console.log(`Warning: ${clientError}`);
  }

  // Cleanup on shutdown
  const cleanup = () => {
    if (viteProcess) {
      console.log("Stopping Vite dev server...");
      viteProcess.kill();
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
