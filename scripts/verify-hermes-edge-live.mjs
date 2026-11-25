#!/usr/bin/env node
/**
 * Live smoke: Supabase Edge Hermes bridge GET /health (requires Supabase invoke headers).
 *
 * Env:
 *   HERMES_EDGE_LIVE_VERIFY=1 — fail if no base URL (strict)
 *   HERMES_REQUIRE_CONNECTED=1 — require success===true && hermesStatus===connected
 *   ENGRAM_LIVE_USE_DEFAULT_PROJECT_URL=1 — use public project URL from engram-public-supabase-url.mjs
 */
import {
  PUBLIC_SUPABASE_ANON_KEY,
  PUBLIC_SUPABASE_PROJECT_URL,
} from "./engram-public-supabase-url.mjs";

const fromEnv = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/$/, "");

const usePublicDefault = process.env.ENGRAM_LIVE_USE_DEFAULT_PROJECT_URL === "1";
const baseUrl = fromEnv || (usePublicDefault ? PUBLIC_SUPABASE_PROJECT_URL.replace(/\/$/, "") : "");
const strict = process.env.HERMES_EDGE_LIVE_VERIFY === "1";
const requireConnected = process.env.HERMES_REQUIRE_CONNECTED === "1";
const allowNotDeployed = process.env.HERMES_LIVE_ALLOW_NOT_DEPLOYED === "1";

const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  PUBLIC_SUPABASE_ANON_KEY;

function headers() {
  return {
    Accept: "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
}

async function main() {
  if (!baseUrl) {
    const msg =
      "verify-hermes-edge-live: skip (no SUPABASE_URL). Set ENGRAM_LIVE_USE_DEFAULT_PROJECT_URL=1 or HERMES_EDGE_LIVE_VERIFY=1 to fail.";
    if (strict) {
      console.error(msg);
      process.exit(1);
    }
    console.error(msg);
    process.exit(0);
  }

  const healthUrl = `${baseUrl}/functions/v1/make-server-57781ad9/hermes/health`;
  console.error(`verify-hermes-edge-live: ${healthUrl}`);

  const res = await fetch(healthUrl, { method: "GET", headers: headers() });
  const text = await res.text();
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {
    /* ignore */
  }

  if (res.status === 404 && allowNotDeployed) {
    console.error("verify-hermes-edge-live: 404 — allowNotDeployed");
    process.exit(0);
  }

  if (!res.ok) {
    console.error(`verify-hermes-edge-live: HTTP ${res.status}`, text.slice(0, 200));
    process.exit(1);
  }

  if (requireConnected && (!body.success || body.hermesStatus !== "connected")) {
    console.error("verify-hermes-edge-live: require connected failed", body);
    process.exit(1);
  }

  console.error("verify-hermes-edge-live: ok", {
    hermesStatus: body.hermesStatus,
    probePath: body.probePath,
  });

  // Stage 2 — service-caller path: fleet invokes authenticate with
  // HERMES_SERVICE_TOKEN (not a user JWT). Verify tools catalog + a
  // read-class invoke round-trip when the token is available.
  const serviceToken = process.env.HERMES_SERVICE_TOKEN || "";
  if (serviceToken) {
    const svcHeaders = {
      Accept: "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${serviceToken}`,
    };
    const toolsRes = await fetch(`${baseUrl}/functions/v1/make-server-57781ad9/hermes/tools`, {
      method: "GET",
      headers: svcHeaders,
    });
    const toolsBody = await toolsRes.json().catch(() => ({}));
    const names = (toolsBody?.tools || []).map((t) => t?.name || t);
    const hasV2 = names.includes("fs_read") && names.includes("shell_exec");
    console.error("verify-hermes-edge-live: service tools", {
      http: toolsRes.status,
      count: names.length,
      v2: hasV2,
    });
    if (toolsRes.status === 401 || toolsRes.status === 403) {
      console.error("verify-hermes-edge-live: service token rejected by bridge");
      process.exit(1);
    }
    if (process.env.HERMES_VERIFY_INVOKE === "1") {
      const invRes = await fetch(`${baseUrl}/functions/v1/make-server-57781ad9/hermes/invoke`, {
        method: "POST",
        headers: { ...svcHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "list_tools", arguments: {} }),
      });
      const invBody = await invRes.json().catch(() => ({}));
      console.error("verify-hermes-edge-live: service invoke", {
        http: invRes.status,
        ok: invBody?.ok,
        run_id: invBody?.run_id,
      });
      if (!invRes.ok || invBody?.ok !== true) {
        console.error("verify-hermes-edge-live: invoke round-trip failed", invBody);
        process.exit(1);
      }
    }
  } else {
    console.error("verify-hermes-edge-live: HERMES_SERVICE_TOKEN unset — service-path stage skipped");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
