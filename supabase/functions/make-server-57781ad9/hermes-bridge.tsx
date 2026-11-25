/**
 * Hermes Bridge — authenticated Edge proxy to the dedicated executor MCP (Hermes).
 *
 * Configure (Supabase secrets):
 *   HERMES_BASE_URL — e.g. https://hermes.example.com or tunnel origin (no trailing slash)
 *
 * Mirrors engram-bridge policy: browser → Edge (JWT) → upstream Hermes HTTP API.
 */

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import type { Context } from "npm:hono";
import { authenticateUser } from "./openclaw-security.tsx";
import * as kv from "./kv_store.tsx";

const hermesBridge = new Hono();

const ENV_BASE_URL = (Deno.env.get("HERMES_BASE_URL") || "").replace(/\/$/, "");
const TUNNEL_SECRET = Deno.env.get("HERMES_TUNNEL_SECRET") || "";
const KV_TUNNEL_KEY = "hermes:tunnel_url";
const KV_TTL_MS = 24 * 60 * 60 * 1000;

// Resolution order: fresh kv-registered tunnel URL (self-healing quick tunnel)
// → HERMES_BASE_URL env → "" (unconfigured). Cached per isolate for 60s.
let urlCache: { url: string; at: number } | null = null;

async function resolveHermesBaseUrl(): Promise<string> {
  if (urlCache && Date.now() - urlCache.at < 60_000) return urlCache.url;
  let url = "";
  try {
    const row = (await kv.get(KV_TUNNEL_KEY)) as { url?: string; ts?: number } | null;
    if (row?.url && typeof row.ts === "number" && Date.now() - row.ts < KV_TTL_MS) {
      url = String(row.url).replace(/\/$/, "");
    }
  } catch { /* kv unavailable — fall through to env */ }
  if (!url) url = ENV_BASE_URL;
  urlCache = { url, at: Date.now() };
  return url;
}

const TIMEOUT_MS = {
  health: 8000,
  get: 15000,
  post: 45000,
} as const;

const MAX_BODY_BYTES = 128 * 1024;

function getRequestId(c: Context): string {
  const fromClient =
    c.req.header("X-Request-ID") ||
    c.req.header("x-request-id") ||
    c.req.header("X-Correlation-ID") ||
    "";
  const trimmed = fromClient.trim();
  if (trimmed.length > 0 && trimmed.length <= 128) return trimmed;
  return crypto.randomUUID();
}

function jsonWithRequestId(c: Context, body: object, status: number, requestId: string) {
  return c.json(body, status, { "X-Request-ID": requestId });
}

async function probeHermesHealth(baseUrl: string, requestId: string): Promise<{
  ok: boolean;
  pathUsed: string;
  httpStatus: number;
}> {
  const paths = ["/health", "/healthz", "/"];
  const signal = AbortSignal.timeout(TIMEOUT_MS.health);
  let lastPath = "/health";
  let lastStatus = 0;
  for (const p of paths) {
    lastPath = p;
    try {
      const r = await fetch(`${baseUrl}${p}`, {
        method: "GET",
        headers: { Accept: "application/json", "X-Request-ID": requestId },
        signal,
      });
      lastStatus = r.status;
      if (r.ok) return { ok: true, pathUsed: p, httpStatus: r.status };
    } catch {
      /* try next */
    }
  }
  return { ok: false, pathUsed: lastPath, httpStatus: lastStatus };
}

const HERMES_SERVICE_TOKEN = Deno.env.get("HERMES_SERVICE_TOKEN") || "";

function isServiceToken(authHeader: string | undefined): boolean {
  if (!HERMES_SERVICE_TOKEN || !authHeader) return false;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return token.length > 0 && token === HERMES_SERVICE_TOKEN;
}

async function requireSignedInUser(c: Context, requestId: string) {
  const authHeader = c.req.header("Authorization");
  // Fleet/agent service path: shared secret for unattended callers (Cortex
  // agents, workers). User-scoped tools are still policy-gated downstream.
  if (isServiceToken(authHeader)) {
    return { ok: true as const, caller: "service" as const };
  }
  const auth = await authenticateUser(authHeader);
  if (!auth.success || !auth.user) {
    return {
      ok: false as const,
      response: jsonWithRequestId(
        c,
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        401,
        requestId,
      ),
    };
  }
  const uid = auth.user.id;
  if (uid === "anon" || String(uid).startsWith("guest_")) {
    return {
      ok: false as const,
      response: jsonWithRequestId(
        c,
        { error: "Sign in required", code: "SIGN_IN_REQUIRED" },
        403,
        requestId,
      ),
    };
  }
  return { ok: true as const, caller: "user" as const };
}

hermesBridge.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = [
        "https://syncscript.app",
        "https://www.syncscript.app",
        "https://the-new-syncscript.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
      ];
      if (origin && allowed.includes(origin)) return origin;
      if (origin && origin.includes("syncscript") && origin.endsWith(".vercel.app")) {
        return origin;
      }
      return origin || "*";
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-ID", "X-Correlation-ID"],
    exposeHeaders: ["X-Request-ID"],
  }),
);

hermesBridge.get("/health", async (c) => {
  const requestId = getRequestId(c);
  const baseUrl = await resolveHermesBaseUrl();
  if (!baseUrl) {
    return jsonWithRequestId(
      c,
      {
        success: false,
        hermesStatus: "unconfigured",
        message: "Set HERMES_BASE_URL on the Edge function",
      },
      503,
      requestId,
    );
  }
  try {
    const probe = await probeHermesHealth(baseUrl, requestId);
    return c.json(
      {
        success: probe.ok,
        hermesStatus: probe.ok ? "connected" : "degraded",
        httpStatus: probe.httpStatus,
        probePath: probe.pathUsed,
      },
      probe.ok ? 200 : 503,
      { "X-Request-ID": requestId },
    );
  } catch (e) {
    return jsonWithRequestId(
      c,
      { success: false, hermesStatus: "disconnected", error: String(e) },
      503,
      requestId,
    );
  }
});

/** GET /tools — proxy to Hermes tool catalog (SyncScript contract: GET /v1/tools). */
hermesBridge.get("/tools", async (c) => {
  const requestId = getRequestId(c);
  const baseUrl = await resolveHermesBaseUrl();
  if (!baseUrl) {
    return jsonWithRequestId(
      c,
      { error: "Hermes not configured", code: "HERMES_UNCONFIGURED" },
      503,
      requestId,
    );
  }
  const gate = await requireSignedInUser(c, requestId);
  if (!gate.ok) return gate.response;

  const upstream = `${baseUrl}/v1/tools`;
  const authz = c.req.header("Authorization")?.trim();
  try {
    const r = await fetch(upstream, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Request-ID": requestId,
        "X-Hermes-Caller": gate.caller,
        ...(authz && authz.startsWith("Bearer ") ? { Authorization: authz } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS.get),
    });
    const text = await r.text();
    const ct = r.headers.get("content-type") || "application/json";
    return new Response(text, {
      status: r.status,
      headers: { "Content-Type": ct, "X-Request-ID": requestId },
    });
  } catch (e) {
    console.error("[Hermes Bridge] tools failed:", { requestId, err: String(e) });
    return jsonWithRequestId(
      c,
      { error: "Hermes upstream error", code: "HERMES_UPSTREAM" },
      502,
      requestId,
    );
  }
});

/**
 * POST /invoke — body: { tool: string, arguments?: object, idempotency_key?: string }
 * Proxies to Hermes POST /v1/invoke
 */
hermesBridge.post("/invoke", async (c) => {
  const requestId = getRequestId(c);
  const baseUrl = await resolveHermesBaseUrl();
  if (!baseUrl) {
    return jsonWithRequestId(
      c,
      { error: "Hermes not configured", code: "HERMES_UNCONFIGURED" },
      503,
      requestId,
    );
  }
  const gate = await requireSignedInUser(c, requestId);
  if (!gate.ok) return gate.response;

  const raw = await c.req.arrayBuffer();
  if (raw.byteLength === 0) {
    return jsonWithRequestId(c, { error: "Empty body", code: "EMPTY_BODY" }, 400, requestId);
  }
  if (raw.byteLength > MAX_BODY_BYTES) {
    return jsonWithRequestId(
      c,
      { error: "Payload too large", code: "PAYLOAD_TOO_LARGE" },
      413,
      requestId,
    );
  }
  try {
    JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return jsonWithRequestId(c, { error: "Invalid JSON body", code: "INVALID_JSON" }, 400, requestId);
  }

  const upstream = `${baseUrl}/v1/invoke`;
  const authz = c.req.header("Authorization")?.trim();
  try {
    const r = await fetch(upstream, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        "X-Hermes-Caller": gate.caller,
        ...(authz && authz.startsWith("Bearer ") ? { Authorization: authz } : {}),
      },
      body: raw,
      signal: AbortSignal.timeout(TIMEOUT_MS.post),
    });
    const text = await r.text();
    const ct = r.headers.get("content-type") || "application/json";
    return new Response(text, {
      status: r.status,
      headers: { "Content-Type": ct, "X-Request-ID": requestId },
    });
  } catch (e) {
    console.error("[Hermes Bridge] invoke failed:", { requestId, err: String(e) });
    return jsonWithRequestId(
      c,
      { error: "Hermes upstream error", code: "HERMES_UPSTREAM" },
      502,
      requestId,
    );
  }
});

/**
 * POST /tunnel-url — self-healing quick-tunnel registration.
 * The VM's hermes-tunnel.service publishes its current trycloudflare URL here
 * on every (re)start; resolveHermesBaseUrl prefers it over the static env.
 * Auth: X-Hermes-Tunnel-Secret === HERMES_TUNNEL_SECRET.
 * Body: { "url": "https://<tunnel>.trycloudflare.com" }
 */
hermesBridge.post("/tunnel-url", async (c) => {
  const requestId = getRequestId(c);
  if (!TUNNEL_SECRET) {
    return jsonWithRequestId(c, { error: "tunnel registration disabled", code: "TUNNEL_DISABLED" }, 503, requestId);
  }
  const provided = c.req.header("X-Hermes-Tunnel-Secret") || "";
  if (provided !== TUNNEL_SECRET) {
    return jsonWithRequestId(c, { error: "Forbidden", code: "FORBIDDEN" }, 403, requestId);
  }
  let body: { url?: string };
  try {
    body = await c.req.json();
  } catch {
    return jsonWithRequestId(c, { error: "Invalid JSON", code: "INVALID_JSON" }, 400, requestId);
  }
  const url = String(body?.url || "").trim().replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(trycloudflare\.com|cloudflare\.com|syncscript\.app)$/.test(url)) {
    return jsonWithRequestId(c, { error: "url must be an https tunnel hostname", code: "BAD_URL" }, 400, requestId);
  }
  try {
    await kv.set(KV_TUNNEL_KEY, { url, ts: Date.now() });
    urlCache = null; // force re-resolve on next request
    return jsonWithRequestId(c, { ok: true, registered: url }, 200, requestId);
  } catch (e) {
    return jsonWithRequestId(c, { error: String(e), code: "KV_WRITE_FAILED" }, 500, requestId);
  }
});

export default hermesBridge;
