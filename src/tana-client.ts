/**
 * Tana Local API HTTP Client
 *
 * Handles all HTTP communication with the Tana Desktop app's local API.
 * Uses Bearer token authentication and AbortController for timeout handling.
 */

export class TanaAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown,
    public suggestion?: string
  ) {
    super(message);
    this.name = "TanaAPIError";
  }
}

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  retryableCodes: new Set([408, 429, 500, 502, 503, 504]),
};

function isRetryableError(error: unknown): boolean {
  if (error instanceof TanaAPIError && error.statusCode) {
    return RETRY_CONFIG.retryableCodes.has(error.statusCode);
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("econnrefused") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("timeout") ||
      msg.includes("network")
    );
  }
  return false;
}

function getFriendlyError(error: unknown): { message: string; suggestion: string } {
  if (error instanceof TanaAPIError) {
    switch (error.statusCode) {
      case 401:
        return {
          message: "Authentication failed",
          suggestion: "Check TANA_API_TOKEN - it may have expired. Generate a new token in Tana: Settings > API > Generate Token",
        };
      case 403:
        return {
          message: "Access forbidden",
          suggestion: "Your API token may lack permissions for this operation. Try generating a new token.",
        };
      case 404:
        return {
          message: "Resource not found",
          suggestion: "The node or workspace may have been deleted, or the ID is incorrect.",
        };
      case 429:
        return {
          message: "Rate limited",
          suggestion: "Too many requests. Wait a moment and try again.",
        };
      case 500:
      case 502:
      case 503:
        return {
          message: "Tana server error",
          suggestion: "Tana is experiencing issues. Try again in a few seconds.",
        };
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("econnrefused")) {
      return {
        message: "Cannot connect to Tana",
        suggestion: "Make sure Tana Desktop is running with Local API enabled. Check the port in Tana settings.",
      };
    }
    if (msg.includes("timeout") || msg.includes("etimedout")) {
      return {
        message: "Request timed out",
        suggestion: "Tana took too long to respond. Try again or increase TANA_TIMEOUT.",
      };
    }
  }

  return {
    message: error instanceof Error ? error.message : "Unknown error",
    suggestion: "Check if Tana Desktop is running and your API token is valid.",
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface TanaClientConfig {
  baseUrl: string;
  token: string;
  timeout: number;
}

export class TanaClient {
  private baseUrl: string;
  private token: string;
  private timeout: number;

  constructor(config: TanaClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token;
    this.timeout = config.timeout;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const url = `${this.baseUrl}${path}`;
        const headers: Record<string, string> = {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        };

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorBody: unknown;
          try {
            errorBody = await response.json();
          } catch {
            errorBody = await response.text();
          }
          const error = new TanaAPIError(
            `Tana API error: ${response.status} ${response.statusText}`,
            response.status,
            errorBody
          );

          if (isRetryableError(error) && attempt < RETRY_CONFIG.maxRetries) {
            lastError = error;
            const delayMs = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1);
            console.error(`Retry ${attempt}/${RETRY_CONFIG.maxRetries} after ${delayMs}ms...`);
            await delay(delayMs);
            continue;
          }
          throw error;
        }

        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          return (await response.json()) as T;
        }
        return (await response.text()) as unknown as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof TanaAPIError && !isRetryableError(error)) {
          const friendly = getFriendlyError(error);
          throw new TanaAPIError(friendly.message, error.statusCode, error.response, friendly.suggestion);
        }

        if (error instanceof Error && error.name === "AbortError") {
          const friendly = getFriendlyError(new Error("timeout"));
          throw new TanaAPIError(friendly.message, undefined, undefined, friendly.suggestion);
        }

        if (isRetryableError(error) && attempt < RETRY_CONFIG.maxRetries) {
          lastError = error;
          const delayMs = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1);
          console.error(`Retry ${attempt}/${RETRY_CONFIG.maxRetries} after ${delayMs}ms...`);
          await delay(delayMs);
          continue;
        }

        const friendly = getFriendlyError(error);
        throw new TanaAPIError(friendly.message, undefined, undefined, friendly.suggestion);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const friendly = getFriendlyError(lastError);
    throw new TanaAPIError(
      `Failed after ${RETRY_CONFIG.maxRetries} attempts: ${friendly.message}`,
      undefined,
      undefined,
      friendly.suggestion
    );
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  async delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("DELETE", path, body);
  }
}

export function createClient(): TanaClient {
  const baseUrl = process.env.TANA_API_URL || "http://127.0.0.1:8262";
  const token = process.env.TANA_API_TOKEN;
  const timeout = parseInt(process.env.TANA_TIMEOUT || "10000", 10);

  if (!token) {
    throw new Error(
      "TANA_API_TOKEN environment variable is required. " +
        "Get your token from Tana Desktop: Settings > API > Generate Token"
    );
  }

  return new TanaClient({ baseUrl, token, timeout });
}
