#!/usr/bin/env node
/**
 * Hermes v2 executor — sovereign tool-execution host for SyncScript/Cortex.
 *
 * Contract: integrations/HERMES.md (extended: /v1/runs journal, dry-run, policy classes)
 *
 * Every mutating call in the fleet collapses here: declarative tool registry,
 * server-side policy (caller class × tool class), idempotency, dry-run, and a
 * JSONL invoke journal for forensic replay.
 *
 * Env:
 *   SYNCSCRIPT_EDGE_BASE     — Edge base for user-scoped tools (task/calendar)
 *   HERMES_EXECUTOR_PORT     — default 18880
 *   HERMES_FS_ROOTS          — comma-separated roots for fs and git tools (default: cwd)
 *   HERMES_GIT_ROOTS         — comma-separated git roots (default: HERMES_FS_ROOTS)
 *   HERMES_SHELL_ALLOWLIST   — comma-separated executable names (see DEFAULT_SHELL_ALLOW)
 *   HERMES_SHELL_DENY        — regex; matching cmdlines are refused
 *   HERMES_HTTP_ALLOWLIST    — comma-separated host suffixes for http_request
 *   HERMES_JOURNAL_PATH      — default ./hermes-journal.jsonl
 *   HERMES_JOURNAL_MAX_BYTES — rotate at this size (default 20MB)
 *   HERMES_RATE_PER_MIN      — per-tool invoke budget per caller (default 60)
 *   HERMES_MAX_OUTPUT        — stdout/stderr/http-body cap bytes (default 65536)
 */
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { execFile } from "node:child_process";

const PORT = Number(process.env.HERMES_EXECUTOR_PORT || 18880);
const EDGE = (process.env.SYNCSCRIPT_EDGE_BASE || "").replace(/\/$/, "");
const VERSION = "2.0.0";

const csv = (v, dflt) =>
  (process.env[v] || dflt || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const FS_ROOTS = csv("HERMES_FS_ROOTS", process.cwd()).map((p) => path.resolve(p));
const GIT_ROOTS = csv("HERMES_GIT_ROOTS", "").length
  ? csv("HERMES_GIT_ROOTS", "").map((p) => path.resolve(p))
  : FS_ROOTS;
const SHELL_ALLOW = new Set(
  csv(
    "HERMES_SHELL_ALLOWLIST",
    "ls,cat,head,tail,wc,df,du,ps,git,node,npm,npx,python3,pip3,jq,sed,awk,sort,uniq,date,whoami,hostname,uname,rg,fd,file,stat,realpath,readlink,basename,dirname,echo,test,[,md5,shasum,base64,xargs,tee,mkdir,touch,cp,mv,ln,chmod,rsync,tar,zip,unzip"
  )
);
const SHELL_DENY = new RegExp(
  process.env.HERMES_SHELL_DENY ||
    "rm\\s+-[a-z]*r[a-z]*f|mkfs|dd\\s+if=|shutdown|reboot|halt|poweroff|init\\s+[06]|\\|\\s*(sudo\\s+)?(ba|z|da|k)?sh\\b|wget\\b[^|]*\\|\\s*(sudo\\s+)?(ba|z|da|k)?sh\\b|\\$\\(|`[^`]+`|\\beval\\b|\\bexec\\b.*\\brm\\b",
  "i"
);
const HTTP_ALLOW = csv("HERMES_HTTP_ALLOWLIST", "kwhnrlzibgfedtxpkbgb.supabase.co,localhost,127.0.0.1");
const JOURNAL_PATH = process.env.HERMES_JOURNAL_PATH || path.join(process.cwd(), "hermes-journal.jsonl");
const JOURNAL_MAX = Number(process.env.HERMES_JOURNAL_MAX_BYTES || 20 * 1024 * 1024);
const SNAP_DIR = process.env.HERMES_SNAPSHOT_DIR || path.join(path.dirname(JOURNAL_PATH), "hermes-snapshots");
const SNAP_MAX = Number(process.env.HERMES_SNAPSHOT_MAX_BYTES || 1024 * 1024);
const SNAP_KEEP = Number(process.env.HERMES_SNAPSHOT_KEEP || 200);
const RATE_PER_MIN = Number(process.env.HERMES_RATE_PER_MIN || 60);
const MAX_OUT = Number(process.env.HERMES_MAX_OUTPUT || 65536);
const FS_DENY_NAME = /(^|\/)(\.env($|\.)|[^/]*\.(pem|key|p12|pfx)$|id_rsa|id_ed25519|credentials|secrets?\.|.*token.*\.(json|txt)$)/i;

// ── Policy classes ─────────────────────────────────────────────────
// read: no side effects. mutate: reversible/local writes. dangerous: needs care.
// serviceOk: fleet service-token callers may invoke. needsUserJwt: acts as the
// user via Edge (task/calendar) — service callers are refused.

const TOOLS = [
  {
    name: "list_tools",
    description: "Return catalog of executor tools (introspection).",
    cls: "read",
    serviceOk: true,
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "apply_task_patch",
    description: "Idempotent task field update via Edge PUT /tasks/:id (KV tasks store).",
    cls: "mutate",
    serviceOk: false,
    needsUserJwt: true,
    input_schema: {
      type: "object",
      required: ["task_id", "patch"],
      properties: {
        task_id: { type: "string" },
        patch: { type: "object" },
        idempotency_key: { type: "string" },
        dry_run: { type: "boolean" },
      },
    },
  },
  {
    name: "create_calendar_hold",
    description:
      "Create a calendar hold via Edge POST /calendar/hold. provider=auto syncs Google + Outlook when both linked.",
    cls: "mutate",
    serviceOk: false,
    needsUserJwt: true,
    input_schema: {
      type: "object",
      required: ["title", "start_iso"],
      properties: {
        title: { type: "string" },
        start_iso: { type: "string" },
        end_iso: { type: "string" },
        provider: { type: "string", enum: ["auto", "google", "outlook"] },
        time_zone: { type: "string" },
        idempotency_key: { type: "string" },
        dry_run: { type: "boolean" },
      },
    },
  },
  {
    name: "fs_read",
    description: "Read a UTF-8 file inside HERMES_FS_ROOTS. Binary/large files rejected.",
    cls: "read",
    serviceOk: true,
    input_schema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
        max_bytes: { type: "number" },
        dry_run: { type: "boolean" },
      },
    },
  },
  {
    name: "fs_write",
    description: "Write a UTF-8 file inside HERMES_FS_ROOTS (creates parents). Journaled with before/after hash.",
    cls: "mutate",
    serviceOk: true,
    input_schema: {
      type: "object",
      required: ["path", "content"],
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        create_dirs: { type: "boolean" },
        dry_run: { type: "boolean" },
      },
    },
  },
  {
    name: "fs_patch",
    description: "Exact-string replace inside a rooted file. Fails if old_string absent; replace_all optional.",
    cls: "mutate",
    serviceOk: true,
    input_schema: {
      type: "object",
      required: ["path", "old_string", "new_string"],
      properties: {
        path: { type: "string" },
        old_string: { type: "string" },
        new_string: { type: "string" },
        replace_all: { type: "boolean" },
        dry_run: { type: "boolean" },
      },
    },
  },
  {
    name: "shell_exec",
    description: "Run an allowlisted executable (no shell) inside a rooted cwd. Output capped.",
    cls: "mutate",
    serviceOk: true,
    input_schema: {
      type: "object",
      required: ["command"],
      properties: {
        command: { type: "string", description: "Executable name or path" },
        args: { type: "array", items: { type: "string" } },
        cmdline: { type: "string", description: "Alternative: full command line, whitespace-split" },
        cwd: { type: "string" },
        timeout_ms: { type: "number" },
        dry_run: { type: "boolean" },
      },
    },
  },
  {
    name: "http_request",
    description: "HTTP request to allowlisted hosts only (HERMES_HTTP_ALLOWLIST).",
    cls: "mutate",
    serviceOk: true,
    input_schema: {
      type: "object",
      required: ["method", "url"],
      properties: {
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] },
        url: { type: "string" },
        headers: { type: "object" },
        body: { type: "string" },
        timeout_ms: { type: "number" },
        dry_run: { type: "boolean" },
      },
    },
  },
  {
    name: "rollback",
    description: "Restore a file mutated by fs_write/fs_patch to its pre-run state. Refuses if the file changed since (hash check).",
    cls: "mutate",
    serviceOk: true,
    input_schema: {
      type: "object",
      required: ["run_id"],
      properties: {
        run_id: { type: "string" },
        dry_run: { type: "boolean" },
      },
    },
  },
  {
    name: "git_op",
    description: "Scoped git operations inside HERMES_GIT_ROOTS. Read ops free; add/commit mutate; push dangerous.",
    cls: "mutate",
    serviceOk: true,
    input_schema: {
      type: "object",
      required: ["repo", "op"],
      properties: {
        repo: { type: "string", description: "Path inside git roots containing .git" },
        op: { type: "string", enum: ["status", "diff", "log", "show", "branch", "add", "commit", "push"] },
        args: { type: "array", items: { type: "string" } },
        message: { type: "string", description: "commit message" },
        dry_run: { type: "boolean" },
      },
    },
  },
];

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

// ── Infra ──────────────────────────────────────────────────────────

const idempotent = new Set();
const rateWindows = new Map(); // `${caller}:${tool}` -> number[]

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

function redactArgs(args) {
  if (!args || typeof args !== "object") return args ?? null;
  const out = {};
  for (const [k, v] of Object.entries(args)) {
    out[k] = /token|secret|passw|api[_-]?key|authorization|credential/i.test(k)
      ? "[redacted]"
      : typeof v === "string" && v.length > 4000
        ? `${v.slice(0, 4000)}…[truncated ${v.length}B]`
        : v;
  }
  return out;
}

async function journalAppend(entry) {
  try {
    await fsp.mkdir(path.dirname(JOURNAL_PATH), { recursive: true });
    try {
      const st = await fsp.stat(JOURNAL_PATH);
      if (st.size > JOURNAL_MAX) {
        const raw = await fsp.readFile(JOURNAL_PATH, "utf8");
        const lines = raw.split("\n");
        await fsp.writeFile(JOURNAL_PATH, lines.slice(Math.floor(lines.length / 2)).join("\n"));
      }
    } catch { /* first write */ }
    await fsp.appendFile(JOURNAL_PATH, JSON.stringify(entry) + "\n");
  } catch (e) {
    console.error("[hermes] journal write failed:", e?.message || e);
  }
}

async function* journalLines() {
  try {
    const raw = await fsp.readFile(JOURNAL_PATH, "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try { yield JSON.parse(line); } catch { /* skip corrupt */ }
    }
  } catch { /* no journal yet */ }
}

function rateLimitOk(caller, tool) {
  if (RATE_PER_MIN <= 0) return true;
  const key = `${caller}:${tool}`;
  const now = Date.now();
  const arr = (rateWindows.get(key) || []).filter((t) => now - t < 60_000);
  if (arr.length >= RATE_PER_MIN) {
    rateWindows.set(key, arr);
    return false;
  }
  arr.push(now);
  rateWindows.set(key, arr);
  return true;
}

// ── Path / policy helpers ──────────────────────────────────────────

async function resolveRootedPath(p, roots) {
  if (!p || typeof p !== "string") return { error: "path required" };
  const abs = path.resolve(String(p));
  let real = abs;
  try {
    real = await fsp.realpath(abs);
  } catch {
    // non-existent file: realpath the parent chain that exists
    let dir = path.dirname(abs);
    const missing = [path.basename(abs)];
    while (dir !== path.dirname(dir)) {
      try {
        const rd = await fsp.realpath(dir);
        real = path.join(rd, ...missing.reverse());
        break;
      } catch {
        missing.unshift(path.basename(dir));
        dir = path.dirname(dir);
      }
    }
    if (real === abs && !(await fsp.realpath(abs).catch(() => null))) {
      // fallthrough: lexical resolve is acceptable for not-yet-existing files
      real = abs;
    }
  }
  const norm = path.resolve(real);
  const ok = roots.some((root) => {
    const r = path.resolve(root);
    return norm === r || norm.startsWith(r + path.sep);
  });
  if (!ok) return { error: `path outside allowed roots: ${norm}` };
  if (FS_DENY_NAME.test(norm)) return { error: `path denied by secret-file policy: ${norm}` };
  return { path: norm };
}

function hostAllowed(urlStr) {
  let u;
  try { u = new URL(urlStr); } catch { return { error: "invalid URL" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { error: `protocol ${u.protocol} not allowed` };
  }
  const host = u.hostname.toLowerCase();
  const ok = HTTP_ALLOW.some((a) => {
    const al = a.toLowerCase();
    return host === al || host.endsWith("." + al);
  });
  if (!ok) return { error: `host not in HERMES_HTTP_ALLOWLIST: ${host}` };
  return { url: u };
}

// ── Mutation snapshots (rollback substrate) ────────────────────────

/** Persist before-state for a successful fs mutation so `rollback` can
 *  restore it. Content is stored only when it fits SNAP_MAX; larger files
 *  record hashes only and rollback refuses honestly. */
async function snapshotMutation(runId, tool, filePath, beforeExists, beforeContent, beforeHash, afterHash) {
  if (!runId) return null;
  try {
    await fsp.mkdir(SNAP_DIR, { recursive: true });
    const storeContent = beforeExists && beforeContent != null && Buffer.byteLength(beforeContent) <= SNAP_MAX;
    const snap = {
      run_id: runId,
      tool,
      path: filePath,
      ts: new Date().toISOString(),
      before_exists: beforeExists,
      before_sha256: beforeHash,
      after_sha256: afterHash,
      before_content: storeContent ? beforeContent : null,
      content_truncated: beforeExists && !storeContent,
    };
    await fsp.writeFile(path.join(SNAP_DIR, `${runId}.snap.json`), JSON.stringify(snap));
    // Bound snapshot count — keep newest SNAP_KEEP.
    try {
      const files = (await fsp.readdir(SNAP_DIR)).filter((f) => f.endsWith(".snap.json"));
      if (files.length > SNAP_KEEP) {
        const stats = await Promise.all(files.map(async (f) => ({ f, m: (await fsp.stat(path.join(SNAP_DIR, f))).mtimeMs })));
        stats.sort((a, b) => b.m - a.m);
        for (const old of stats.slice(SNAP_KEEP)) {
          await fsp.unlink(path.join(SNAP_DIR, old.f)).catch(() => {});
        }
      }
    } catch { /* prune is best-effort */ }
    return { snapshot: `${runId}.snap.json`, rollbackable: storeContent || !beforeExists };
  } catch (e) {
    console.error("[hermes] snapshot write failed:", e?.message || e);
    return null;
  }
}

// ── Tool handlers ──────────────────────────────────────────────────

async function edgeFetch(pathname, init, authHeader) {
  if (!EDGE) {
    return { ok: false, status: 503, text: "SYNCSCRIPT_EDGE_BASE not configured on executor host" };
  }
  const url = `${EDGE}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  const headers = { Accept: "application/json", ...(init.headers || {}) };
  if (authHeader) headers.Authorization = authHeader;
  try {
    const r = await fetch(url, { ...init, headers });
    const text = await r.text();
    return { ok: r.ok, status: r.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: String(e?.message || e) };
  }
}

async function edgeJson(res) {
  try { return res.text ? JSON.parse(res.text) : {}; } catch { return { raw: res.text?.slice(0, 500) }; }
}

function runCmd(file, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      {
        cwd: opts.cwd,
        timeout: opts.timeout_ms || 30000,
        maxBuffer: MAX_OUT * 2,
        env: process.env,
        shell: false,
      },
      (err, stdout, stderr) => {
        const cap = (s) => (s && s.length > MAX_OUT ? s.slice(0, MAX_OUT) + `\n…[truncated ${s.length}B]` : s || "");
        resolve({
          code: err ? (typeof err.code === "number" ? err.code : 1) : 0,
          signal: err?.signal || null,
          stdout: cap(stdout),
          stderr: cap(stderr),
          error: err && !stdout && !stderr ? String(err.message || err) : null,
        });
      }
    );
  });
}

const HANDLERS = {
  async list_tools(ctx) {
    return { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, cls: t.cls, serviceOk: t.serviceOk })) };
  },

  async apply_task_patch(ctx) {
    const { args, authHeader, push, dryRun } = ctx;
    const taskId = args?.task_id;
    if (!taskId) { push("validate", "error", "task_id required"); return { ok: false, error: "task_id required" }; }
    const patch = args?.patch && typeof args.patch === "object" ? args.patch : {};
    push("validate", "ok", `task ${taskId}`);
    if (dryRun) return { dry_run: true, would_call: { method: "PUT", path: `/tasks/${taskId}`, body: patch } };
    const res = await edgeFetch(`/tasks/${encodeURIComponent(taskId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }, authHeader);
    const body = await edgeJson(res);
    if (!res.ok) {
      push("edge", "error", `PUT /tasks ${res.status}`);
      return { ok: false, error: body?.error || res.text?.slice(0, 300) || `HTTP ${res.status}` };
    }
    push("edge", "ok", "task updated");
    return { task: body };
  },

  async create_calendar_hold(ctx) {
    const { args, authHeader, push, dryRun } = ctx;
    const title = args?.title;
    const start = args?.start_iso;
    if (!title || !start) { push("validate", "error", "title and start_iso required"); return { ok: false, error: "title and start_iso required" }; }
    const payload = {
      title,
      start_iso: start,
      ...(args?.end_iso ? { end_iso: args.end_iso } : {}),
      ...(args?.provider ? { provider: String(args.provider).toLowerCase() } : {}),
      ...(args?.time_zone ? { time_zone: args.time_zone } : {}),
    };
    push("validate", "ok", `hold "${String(title).slice(0, 60)}" @ ${start}`);
    if (dryRun) return { dry_run: true, would_call: { method: "POST", path: "/calendar/hold", body: payload } };
    const res = await edgeFetch("/calendar/hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, authHeader);
    const body = await edgeJson(res);
    if (!res.ok) {
      push("calendar", "error", `POST /calendar/hold ${res.status}`);
      return { ok: false, error: body?.error || res.text?.slice(0, 300) || `HTTP ${res.status}` };
    }
    push("calendar", "ok", "hold created");
    return body;
  },

  async fs_read(ctx) {
    const { args, push, dryRun } = ctx;
    const r = await resolveRootedPath(args?.path, FS_ROOTS);
    if (r.error) { push("policy", "error", r.error); return { ok: false, error: r.error }; }
    const maxBytes = Math.min(Number(args?.max_bytes) || MAX_OUT, MAX_OUT);
    if (dryRun) return { dry_run: true, would_read: { path: r.path, max_bytes: maxBytes } };
    const st = await fsp.stat(r.path).catch(() => null);
    if (!st || !st.isFile()) { push("fs", "error", "not a file"); return { ok: false, error: `not a file: ${r.path}` }; }
    if (st.size > 64 * 1024 * 1024) { push("fs", "error", `file too large (${st.size}B)`); return { ok: false, error: "file exceeds 64MB read cap", size: st.size }; }
    const raw = await fsp.readFile(r.path);
    const truncated = raw.length > maxBytes;
    const content = raw.subarray(0, maxBytes).toString("utf8");
    push("fs", "ok", `${st.size}B from ${r.path}${truncated ? " (truncated)" : ""}`);
    return { path: r.path, size: st.size, truncated, content, sha256: sha256(raw.subarray(0, maxBytes).toString("utf8")) };
  },

  async fs_write(ctx) {
    const { args, push, dryRun } = ctx;
    const r = await resolveRootedPath(args?.path, FS_ROOTS);
    if (r.error) { push("policy", "error", r.error); return { ok: false, error: r.error }; }
    const content = String(args?.content ?? "");
    if (content.length > MAX_OUT * 4) { push("policy", "error", "content too large"); return { ok: false, error: "content exceeds 256KB" }; }
    let beforeHash = null;
    let beforeContent = null;
    try {
      beforeContent = await fsp.readFile(r.path, "utf8");
      beforeHash = sha256(beforeContent);
      if (Buffer.byteLength(beforeContent) > SNAP_MAX) beforeContent = null; // too big to snapshot
    } catch { /* new file */ }
    const afterHash = sha256(content);
    if (dryRun) return { dry_run: true, would_write: { path: r.path, bytes: Buffer.byteLength(content), before_sha256: beforeHash, after_sha256: afterHash } };
    if (args?.create_dirs !== false) await fsp.mkdir(path.dirname(r.path), { recursive: true });
    await fsp.writeFile(r.path, content, "utf8");
    push("fs", "ok", `wrote ${Buffer.byteLength(content)}B to ${r.path}`);
    const snap = await snapshotMutation(ctx.runId, "fs_write", r.path, beforeHash != null, beforeContent, beforeHash, afterHash);
    return { path: r.path, bytes: Buffer.byteLength(content), before_sha256: beforeHash, after_sha256: afterHash, ...(snap ? { snapshot: snap } : {}) };
  },

  async fs_patch(ctx) {
    const { args, push, dryRun } = ctx;
    const r = await resolveRootedPath(args?.path, FS_ROOTS);
    if (r.error) { push("policy", "error", r.error); return { ok: false, error: r.error }; }
    const oldStr = String(args?.old_string ?? "");
    const newStr = String(args?.new_string ?? "");
    if (!oldStr) { push("validate", "error", "old_string required"); return { ok: false, error: "old_string required" }; }
    const content = await fsp.readFile(r.path, "utf8").catch(() => null);
    if (content == null) { push("fs", "error", "file not found"); return { ok: false, error: `not found: ${r.path}` }; }
    const occurrences = content.split(oldStr).length - 1;
    if (occurrences === 0) { push("validate", "error", "old_string not found"); return { ok: false, error: "old_string not found in file" }; }
    if (!args?.replace_all && occurrences > 1) {
      push("validate", "error", `${occurrences} occurrences — set replace_all or narrow old_string`);
      return { ok: false, error: `ambiguous: ${occurrences} occurrences`, occurrences };
    }
    const beforeHash = sha256(content);
    const patched = args?.replace_all ? content.split(oldStr).join(newStr) : content.replace(oldStr, newStr);
    const afterHash = sha256(patched);
    if (dryRun) return { dry_run: true, would_patch: { path: r.path, occurrences, before_sha256: beforeHash, after_sha256: afterHash } };
    await fsp.writeFile(r.path, patched, "utf8");
    push("fs", "ok", `patched ${occurrences} occurrence(s) in ${r.path}`);
    const snap = await snapshotMutation(ctx.runId, "fs_patch", r.path, true, content, beforeHash, afterHash);
    return { path: r.path, occurrences, before_sha256: beforeHash, after_sha256: afterHash, ...(snap ? { snapshot: snap } : {}) };
  },

  async shell_exec(ctx) {
    const { args, push, dryRun } = ctx;
    let argv;
    if (Array.isArray(args?.args) && args.args.every((a) => typeof a === "string")) {
      argv = [String(args.command), ...args.args];
    } else if (typeof args?.cmdline === "string" && args.cmdline.trim()) {
      argv = args.cmdline.trim().split(/\s+/);
    } else if (typeof args?.command === "string" && args.command.trim()) {
      argv = args.command.trim().split(/\s+/);
    } else {
      push("validate", "error", "command or cmdline required");
      return { ok: false, error: "command required" };
    }
    const bin = path.basename(argv[0]);
    if (!SHELL_ALLOW.has(bin)) {
      push("policy", "error", `executable not allowlisted: ${bin}`);
      return { ok: false, error: `command not in HERMES_SHELL_ALLOWLIST: ${bin}`, allowed: [...SHELL_ALLOW].slice(0, 50) };
    }
    const cmdline = argv.join(" ");
    if (SHELL_DENY.test(cmdline)) {
      push("policy", "error", "cmdline matched deny policy");
      return { ok: false, error: "cmdline denied by HERMES_SHELL_DENY policy" };
    }
    let cwd = process.cwd();
    if (args?.cwd) {
      const r = await resolveRootedPath(args.cwd, FS_ROOTS);
      if (r.error) { push("policy", "error", r.error); return { ok: false, error: r.error }; }
      cwd = r.path;
    }
    if (dryRun) return { dry_run: true, would_exec: { cmdline, cwd, timeout_ms: args?.timeout_ms || 30000 } };
    push("exec", "ok", `${bin} (${argv.length - 1} args)`);
    const out = await runCmd(argv[0], argv.slice(1), { cwd, timeout_ms: args?.timeout_ms });
    if (out.error) push("exec", "error", out.error);
    else push("exec", out.code === 0 ? "ok" : "error", `exit ${out.code}`);
    return { cmdline, cwd, code: out.code, signal: out.signal, stdout: out.stdout, stderr: out.stderr, timed_out: out.signal === "SIGTERM" };
  },

  async http_request(ctx) {
    const { args, push, dryRun } = ctx;
    const method = String(args?.method || "GET").toUpperCase();
    const host = hostAllowed(String(args?.url || ""));
    if (host.error) { push("policy", "error", host.error); return { ok: false, error: host.error }; }
    const headers = {};
    if (args?.headers && typeof args.headers === "object") {
      for (const [k, v] of Object.entries(args.headers)) {
        if (/^(host|connection|content-length|transfer-encoding)$/i.test(k)) continue;
        headers[k] = String(v);
      }
    }
    const body = args?.body != null ? String(args.body) : undefined;
    if (body && body.length > 256 * 1024) { push("policy", "error", "body too large"); return { ok: false, error: "body exceeds 256KB" }; }
    if (dryRun) return { dry_run: true, would_request: { method, url: host.url.href, headers: Object.keys(headers), body_bytes: body ? Buffer.byteLength(body) : 0 } };
    push("http", "ok", `${method} ${host.url.host}`);
    try {
      const r = await fetch(host.url.href, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : body,
        signal: AbortSignal.timeout(Math.min(Number(args?.timeout_ms) || 30000, 120000)),
        redirect: "follow",
      });
      const text = await r.text();
      const truncated = text.length > MAX_OUT;
      push("http", r.ok ? "ok" : "error", `HTTP ${r.status}`);
      return {
        status: r.status,
        ok: r.ok,
        headers: Object.fromEntries([...r.headers.entries()].slice(0, 40)),
        body: truncated ? text.slice(0, MAX_OUT) + `\n…[truncated]` : text,
      };
    } catch (e) {
      push("http", "error", String(e?.message || e));
      return { ok: false, error: String(e?.message || e) };
    }
  },

  async rollback(ctx) {
    const { args, push, dryRun } = ctx;
    const runId = String(args?.run_id || "");
    if (!/^[A-Za-z0-9-]{8,64}$/.test(runId)) {
      push("validate", "error", "run_id required");
      return { ok: false, error: "valid run_id required" };
    }
    const snapPath = path.join(SNAP_DIR, `${runId}.snap.json`);
    const snap = await fsp.readFile(snapPath, "utf8").then(JSON.parse).catch(() => null);
    if (!snap) {
      push("lookup", "error", `no snapshot for ${runId}`);
      return { ok: false, error: `no mutation snapshot found for run ${runId} (expired, pruned, or not an fs mutation)` };
    }
    if (snap.tool !== "fs_write" && snap.tool !== "fs_patch") {
      push("policy", "error", `snapshot tool ${snap.tool} not rollbackable`);
      return { ok: false, error: `run ${runId} was ${snap.tool} — only fs_write/fs_patch are rollbackable` };
    }
    // Re-validate the recorded path against CURRENT roots — policy may have tightened.
    const r = await resolveRootedPath(snap.path, FS_ROOTS);
    if (r.error) {
      push("policy", "error", r.error);
      return { ok: false, error: `snapshot path no longer allowed: ${r.error}` };
    }
    const target = r.path;
    const cur = await fsp.readFile(target).catch(() => null);
    if (!cur) {
      push("verify", "error", "target file missing");
      return { ok: false, error: `target file missing: ${target} — cannot verify state` };
    }
    const curHash = sha256(cur.toString("utf8"));
    if (curHash !== snap.after_sha256) {
      push("verify", "error", "file changed since run");
      return {
        ok: false,
        error: `file changed since run ${runId} — blind rollback refused`,
        current_sha256: curHash,
        expected_sha256: snap.after_sha256,
      };
    }
    if (snap.content_truncated || (snap.before_exists && snap.before_content == null)) {
      push("policy", "error", "snapshot content not stored (size cap)");
      return { ok: false, error: `before-content exceeds snapshot cap (${SNAP_MAX}B) — rollback unavailable for ${target}` };
    }
    if (dryRun) {
      return { dry_run: true, would_rollback: { path: target, run_id: runId, original_tool: snap.tool, restores: snap.before_exists ? "prior content" : "file deletion" } };
    }
    if (snap.before_exists) {
      await fsp.writeFile(target, snap.before_content, "utf8");
      push("rollback", "ok", `restored ${target} from run ${runId}`);
      return { path: target, run_id: runId, reverted_tool: snap.tool, action: "restored" };
    }
    await fsp.unlink(target);
    push("rollback", "ok", `deleted ${target} (created by run ${runId})`);
    return { path: target, run_id: runId, reverted_tool: snap.tool, action: "deleted" };
  },

  async git_op(ctx) {
    const { args, push, dryRun } = ctx;
    const op = String(args?.op || "");
    const repo = args?.repo;
    const OPS = {
      status: { cls: "read", argv: ["status", "--short", "--branch"] },
      diff: { cls: "read", argv: ["diff", "--stat"] },
      log: { cls: "read", argv: ["log", "--oneline", "-n", "20"] },
      show: { cls: "read", argv: ["show", "--stat", "HEAD"] },
      branch: { cls: "read", argv: ["branch", "-a"] },
      add: { cls: "mutate", argv: ["add", "-A"] },
      commit: { cls: "mutate", argv: null }, // built from message
      push: { cls: "dangerous", argv: null }, // positional remote branch only
    };
    const spec = OPS[op];
    if (!spec) { push("validate", "error", `unknown op ${op}`); return { ok: false, error: `unknown op: ${op}`, ops: Object.keys(OPS) }; }
    const r = await resolveRootedPath(repo, GIT_ROOTS);
    if (r.error) { push("policy", "error", r.error); return { ok: false, error: r.error }; }
    const gitDir = path.join(r.path, ".git");
    try { await fsp.stat(gitDir); } catch {
      push("validate", "error", "not a git repository");
      return { ok: false, error: `not a git repo: ${r.path}` };
    }
    let argv;
    if (op === "commit") {
      const msg = String(args?.message || "").trim();
      if (!msg) { push("validate", "error", "message required for commit"); return { ok: false, error: "message required" }; }
      argv = ["commit", "-m", msg.slice(0, 2000)];
    } else if (op === "push") {
      const extra = (args?.args || []).map(String);
      if (extra.length > 2 || extra.some((a) => a.startsWith("-"))) {
        push("policy", "error", "push accepts at most [remote] [branch]");
        return { ok: false, error: "push args must be positional [remote] [branch]" };
      }
      argv = ["push", ...(extra.length ? extra : ["origin", "HEAD"])];
    } else {
      const extra = (args?.args || []).map(String);
      if (extra.some((a) => a.includes("..") || a.startsWith("--exec") || a === "-c" || a.startsWith("-c"))) {
        push("policy", "error", "arg rejected by git policy");
        return { ok: false, error: "git args rejected by policy" };
      }
      argv = [...spec.argv, ...extra];
    }
    const cmdline = `git -C ${r.path} ${argv.join(" ")}`;
    if (dryRun) return { dry_run: true, would_exec: { cmdline } };
    push("git", "ok", op);
    const out = await runCmd("git", ["-C", r.path, ...argv], { timeout_ms: 60000 });
    push("git", out.code === 0 ? "ok" : "error", `exit ${out.code}`);
    return { op, repo: r.path, cmdline, code: out.code, stdout: out.stdout, stderr: out.stderr };
  },
};

// ── Invoke pipeline ────────────────────────────────────────────────

async function invokeTool(tool, args, idemKey, authHeader, caller) {
  const runId = randomUUID();
  const trace = [];
  const push = (step, status, detail) => {
    trace.push({ step, status, detail: detail || null, at: new Date().toISOString() });
  };
  const t0 = Date.now();
  const spec = TOOL_MAP.get(tool);

  const finish = async (out) => {
    const entry = {
      run_id: runId,
      ts: new Date().toISOString(),
      tool,
      cls: spec?.cls || "unknown",
      caller,
      ok: out.ok !== false && !(out.error && out.ok === false),
      dry_run: !!out.dry_run,
      args: redactArgs(args),
      result_summary: typeof out.result === "string" ? out.result.slice(0, 500) : undefined,
      error: out.error || null,
      duration_ms: Date.now() - t0,
      trace: trace.slice(0, 25),
    };
    await journalAppend(entry);
    return { ok: out.ok !== false, tool, run_id: runId, result: out.result, error: out.error, trace, ...(out.dry_run ? { dry_run: true } : {}) };
  };

  push("parse", "ok", tool);

  if (!spec) {
    push("route", "error", `unknown tool ${tool}`);
    return finish({ ok: false, error: `Unknown tool: ${tool}` });
  }

  // Policy gate 1: caller class
  if (caller === "service" && !spec.serviceOk) {
    push("policy", "error", "service caller not permitted for this tool");
    return finish({ ok: false, error: `Tool ${tool} requires a signed-in user caller` });
  }
  if (spec.needsUserJwt && (!authHeader || !authHeader.startsWith("Bearer "))) {
    push("auth", "error", "Authorization Bearer required");
    return finish({ ok: false, error: "Missing Authorization — user JWT required" });
  }

  // Policy gate 2: rate limit
  if (!rateLimitOk(caller, tool)) {
    push("policy", "error", `rate limit ${RATE_PER_MIN}/min exceeded`);
    return finish({ ok: false, error: `Rate limit exceeded (${RATE_PER_MIN}/min per caller)` });
  }

  // Idempotency
  if (idemKey && idempotent.has(idemKey)) {
    push("idempotency", "ok", "duplicate key");
    return finish({ ok: true, result: { cached: true }, deduped: true });
  }
  if (idemKey) idempotent.add(idemKey);

  // Dry-run flag (top-level or inside arguments)
  const dryRun = args?.dry_run === true;
  const cleanArgs = { ...(args || {}) };
  delete cleanArgs.dry_run;

  try {
    const result = await HANDLERS[tool]({ args: cleanArgs, authHeader, caller, runId, push, dryRun });
    if (result && typeof result === "object" && "ok" in result && result.ok === false) {
      return finish({ ok: false, error: result.error || "tool failed", result: result.result });
    }
    const isDry = result && typeof result === "object" && result.dry_run;
    return finish({ ok: true, result: isDry ? result : (result?.result !== undefined ? result.result : result), ...(isDry ? { dry_run: true } : {}) });
  } catch (e) {
    push("exec", "error", String(e?.message || e));
    return finish({ ok: false, error: String(e?.message || e) });
  }
}

// ── HTTP server ────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const u = new URL(req.url || "/", "http://localhost");
  const pathOnly = u.pathname;
  const authHeader = req.headers.authorization || "";
  const caller = String(req.headers["x-hermes-caller"] || "").toLowerCase() === "service" ? "service" : "user";

  if (req.method === "GET" && (pathOnly === "/health" || pathOnly === "/healthz" || pathOnly === "/")) {
    json(res, 200, {
      status: "ok",
      role: "hermes-executor",
      version: VERSION,
      port: PORT,
      contract: "syncscript/v1",
      edge_configured: Boolean(EDGE),
      fs_roots: FS_ROOTS,
      git_roots: GIT_ROOTS,
      tools: TOOLS.length,
      journal: JOURNAL_PATH,
    });
    return;
  }

  if (req.method === "GET" && pathOnly === "/v1/tools") {
    json(res, 200, {
      tools: TOOLS.map((t) => ({ ...t, input_schema: t.input_schema })),
      version: VERSION,
    });
    return;
  }

  if (req.method === "GET" && pathOnly === "/v1/runs") {
    const limit = Math.min(Number(u.searchParams.get("limit")) || 50, 500);
    const toolFilter = u.searchParams.get("tool");
    const callerFilter = u.searchParams.get("caller");
    const okFilter = u.searchParams.get("ok");
    const runs = [];
    (async () => {
      for await (const e of journalLines()) {
        if (toolFilter && e.tool !== toolFilter) continue;
        if (callerFilter && e.caller !== callerFilter) continue;
        if (okFilter != null && okFilter !== "" && String(e.ok) !== okFilter) continue;
        runs.push(e);
      }
      runs.reverse();
      json(res, 200, { runs: runs.slice(0, limit), total_scanned: runs.length });
    })().catch((e) => json(res, 500, { ok: false, error: String(e?.message || e) }));
    return;
  }

  const runMatch = pathOnly.match(/^\/v1\/runs\/([A-Za-z0-9-]+)$/);
  if (req.method === "GET" && runMatch) {
    const id = runMatch[1];
    (async () => {
      for await (const e of journalLines()) {
        if (e.run_id === id) {
          json(res, 200, e);
          return;
        }
      }
      json(res, 404, { ok: false, error: `run not found: ${id}` });
    })().catch((e) => json(res, 500, { ok: false, error: String(e?.message || e) }));
    return;
  }

  if (req.method === "POST" && pathOnly === "/v1/invoke") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 512 * 1024) req.destroy();
    });
    req.on("end", async () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const tool = parsed.tool || parsed.name;
        const args = parsed.arguments || parsed.args || {};
        const idemKey = parsed.idempotency_key || parsed.idempotencyKey || "";
        if (!tool) {
          json(res, 400, { ok: false, error: "tool required" });
          return;
        }
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          json(res, 401, { ok: false, error: "Authorization Bearer required" });
          return;
        }
        const out = await invokeTool(tool, args, idemKey, authHeader, caller);
        json(res, out.ok ? 200 : (out.error?.startsWith("Unknown tool") ? 404 : 400), out);
      } catch (e) {
        json(res, 400, { ok: false, error: String(e?.message || e) });
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, "0.0.0.0", () => {
  console.error(
    `[hermes-executor v${VERSION}] http://127.0.0.1:${PORT}  EDGE=${EDGE || "(unset)"}  fs_roots=${FS_ROOTS.length}  tools=${TOOLS.length}  journal=${JOURNAL_PATH}`,
  );
});
