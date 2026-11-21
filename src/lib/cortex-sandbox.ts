/**
 * cortex-sandbox.ts — CONTAINED-lane enforcement boundary for governed tools.
 *
 * Executes untrusted/agent-supplied commands inside a microsandbox microVM
 * (libkrun / Apple Virtualization.framework on macOS arm64). Hardware-level
 * isolation means even `rm -rf /` inside the guest cannot touch the host
 * filesystem, network namespace, or process table — this is what upgrades a
 * tool from the "contained" blast-radius lane to safely runnable.
 *
 * Contract mirrors the governed-tool JSON shape used by vite.config.ts
 * (render_video et al.): callers get `{ ok, ...result, error?, durationMs }`.
 *
 * SDK surface coded against (microsandbox >= 0.7.x, docs.microsandbox.dev):
 *   import { Sandbox } from 'microsandbox'
 *   Sandbox.builder(name).image(src).workdir(p).envs(vars).ephemeral(true).create()
 *   sandbox.execWith(cmd, b => b.args([...]).cwd(p).envs(vars).timeout(ms))
 *     -> ExecOutput { code, success, stdout(), stderr() }
 *   sandbox.stop(); Sandbox.remove(name)
 * All SDK contact is isolated in `withSandbox()` / `sandboxStatus()` so the
 * surface is a one-place fix if the API shifts.
 */

import { execFile } from 'node:child_process';

/** Default guest image — small, useful, multi-arch OCI rootfs. */
export const DEFAULT_SANDBOX_IMAGE = 'python:3.12-alpine';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;
/** Grace period after the exec deadline before we force-kill the whole VM. */
const KILL_GRACE_MS = 5_000;
const MAX_OUTPUT_CHARS = 64 * 1024; // 64KB cap per stream
const STATUS_PROBE_MS = 5_000;

export interface SandboxNetPolicy {
  /**
   * 'allow'    — unrestricted egress (legacy default; back-compat).
   * 'deny'     — deny-all egress AND ingress (air-gapped guest).
   * 'allowlist'— deny-by-default; only `allowHosts` reachable.
   */
  mode?: 'allow' | 'deny' | 'allowlist';
  /** Domains ('api.example.com') or suffixes ('.example.com' / '*.example.com')
   *  permitted when mode='allowlist'. */
  allowHosts?: string[];
}

export interface SandboxSecretSpec {
  /** Guest env var that carries the $MSB_ placeholder. */
  envVar: string;
  /** Host env var resolved at sandbox start — preferred; the raw value
   *  never enters the guest, only the placeholder does. */
  hostEnv?: string;
  /** Direct secret value (discouraged — prefer hostEnv). */
  value?: string;
  /** Hosts the proxy may substitute the real value for. */
  allowedHosts: string[];
  /** Explicit placeholder (default `$MSB_<envVar>`). */
  placeholder?: string;
}

export interface SandboxRunOptions {
  /** OCI image / rootfs source. Defaults to DEFAULT_SANDBOX_IMAGE. */
  image?: string;
  /** Executable inside the guest (argv[0]). NOT a shell string. */
  command: string;
  /** argv[1..] — passed verbatim, never shell-interpolated. */
  args?: string[];
  /** Hard timeout; clamped to [1, MAX_TIMEOUT_MS]. Default 30s. */
  timeoutMs?: number;
  /** Working directory inside the guest. */
  workdir?: string;
  /** Guest env vars. Host env is NEVER forwarded — only this map is set. */
  env?: Record<string, string>;
  /** Egress policy. Default 'allow' preserves legacy behaviour; governed
   *  callers should pass 'deny' or 'allowlist' for untrusted lanes. */
  net?: SandboxNetPolicy;
  /** Host-side secrets injected as $MSB_ placeholders, substituted only for
   *  allowedHosts at the egress proxy — guest code never sees raw values. */
  secrets?: SandboxSecretSpec[];
}

export interface SandboxRunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  sandboxId?: string;
  error?: string;
}

export interface SandboxStatus {
  available: boolean;
  runtime: string | null;
  detail?: string;
}

/** Minimal structural types so we don't hard-depend on SDK typings. */
interface SdkExecOutput {
  code: number;
  stdout(): string;
  stderr(): string;
}
interface SdkExecOptionsBuilder {
  args(a: string[]): SdkExecOptionsBuilder;
  cwd(p: string): SdkExecOptionsBuilder;
  envs(v: Record<string, string>): SdkExecOptionsBuilder;
  timeout(ms: number): SdkExecOptionsBuilder;
}
interface SdkSandbox {
  name: string;
  id?: string;
  execWith(cmd: string, configure: (b: SdkExecOptionsBuilder) => SdkExecOptionsBuilder): Promise<SdkExecOutput>;
  stop(): Promise<void>;
  kill?(): Promise<void>;
}
interface SdkSandboxBuilder {
  image(src: string): SdkSandboxBuilder;
  workdir(p: string): SdkSandboxBuilder;
  envs(v: Record<string, string>): SdkSandboxBuilder;
  ephemeral(e: boolean): SdkSandboxBuilder;
  network(configure: (b: any) => any): SdkSandboxBuilder;
  secret(configure: (b: any) => any): SdkSandboxBuilder;
  create(): Promise<SdkSandbox>;
}
interface SdkModule {
  Sandbox: {
    builder(name: string): SdkSandboxBuilder;
    remove(name: string): Promise<void>;
    list?(): Promise<unknown>;
  };
}

/**
 * Sole point of contact with the microsandbox SDK. Returns the module or
 * throws — callers convert throws into fail-soft results.
 */
async function loadSdk(): Promise<SdkModule> {
  // Dynamic import keeps this module loadable (and fail-soft) before the
  // 'microsandbox' dependency is installed / bundled by the orchestrator.
  // @ts-ignore — optional dep; absence is handled as sandbox_unavailable.
  const mod = await import('microsandbox');
  const Sandbox = (mod as any)?.Sandbox;
  if (!Sandbox || typeof Sandbox.builder !== 'function') {
    throw new Error("microsandbox SDK loaded but 'Sandbox' export not found");
  }
  return { Sandbox: Sandbox as SdkModule['Sandbox'] };
}

function capOutput(s: string): string {
  return s.length > MAX_OUTPUT_CHARS ? s.slice(0, MAX_OUTPUT_CHARS) : s;
}

function clampTimeout(ms: number | undefined): number {
  if (ms == null || !Number.isFinite(ms)) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(Math.floor(ms), 1), MAX_TIMEOUT_MS);
}

function validate(opts: SandboxRunOptions): string | null {
  const cmd = String(opts?.command ?? '').trim();
  if (!cmd) return 'command is required';
  if (cmd.includes('\0') || cmd.length > 1024) return 'command is invalid';
  const args = opts.args ?? [];
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string' || a.includes('\0'))) {
    return 'args must be an array of strings without NUL bytes';
  }
  if (opts.workdir != null && (typeof opts.workdir !== 'string' || opts.workdir.includes('\0'))) {
    return 'workdir is invalid';
  }
  return null;
}

function sandboxName(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `cortex-${Date.now().toString(36)}-${rand}`.slice(0, 128);
}

/**
 * Run a command inside a fresh microVM sandbox. Always destroys the sandbox
 * afterwards (v1: no keepAlive). Never throws — failures return ok:false with
 * an `error` string prefixed `sandbox_unavailable:` / `sandbox_timeout:` etc.
 */
export async function runSandboxed(opts: SandboxRunOptions): Promise<SandboxRunResult> {
  const startMs = Date.now();
  const fail = (error: string, extra?: Partial<SandboxRunResult>): SandboxRunResult => ({
    ok: false,
    stdout: '',
    stderr: '',
    exitCode: null,
    durationMs: Date.now() - startMs,
    ...extra,
    error,
  });

  const invalid = validate(opts);
  if (invalid) return fail(`sandbox_invalid_args: ${invalid}`);

  const timeoutMs = clampTimeout(opts.timeoutMs);
  const name = sandboxName();
  const image = (opts.image ?? DEFAULT_SANDBOX_IMAGE).trim() || DEFAULT_SANDBOX_IMAGE;
  const env = opts.env && typeof opts.env === 'object' ? opts.env : {};
  const netMode = opts.net?.mode ?? 'allow';
  const allowHosts = (opts.net?.allowHosts ?? []).filter((h) => typeof h === 'string' && h.length > 0 && h.length <= 253);

  // Resolve secrets host-side; raw values are handed to the SDK builder and
  // never placed in guest env — the guest only sees $MSB_ placeholders that
  // the egress proxy substitutes for allowedHosts.
  const resolvedSecrets: Array<{ envVar: string; value: string; placeholder: string; hosts: string[] }> = [];
  const secretWarnings: string[] = [];
  for (const s of opts.secrets ?? []) {
    const envVar = String(s?.envVar || '').trim();
    const hosts = (s?.allowedHosts ?? []).filter((h) => typeof h === 'string' && h.includes('.'));
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(envVar) || !hosts.length) {
      secretWarnings.push(`secret spec rejected: bad envVar or no allowedHosts`);
      continue;
    }
    const value = s.value ?? (s.hostEnv ? process.env[s.hostEnv] : undefined);
    if (!value) {
      secretWarnings.push(`secret ${envVar}: host source empty — skipped`);
      continue;
    }
    resolvedSecrets.push({
      envVar,
      value: String(value),
      placeholder: s.placeholder || `$MSB_${envVar}`,
      hosts,
    });
  }

  let sdk: SdkModule;
  try {
    sdk = await loadSdk();
  } catch (e: any) {
    return fail(`sandbox_unavailable: ${e?.message || e}`);
  }

  let sandbox: SdkSandbox | null = null;
  try {
    let builder = sdk.Sandbox.builder(name)
      .image(image)
      .ephemeral(true); // auto-remove persisted state on stop
    if (opts.workdir) builder = builder.workdir(opts.workdir);
    const envKeys = Object.keys(env);
    if (envKeys.length) builder = builder.envs(env);

    // Network policy: deny-by-default with explicit host allowlist, or
    // full deny for air-gapped guests. Plain NetworkPolicy object — the
    // SDK accepts it directly (first-match-wins per direction).
    if (netMode !== 'allow') {
      const rules = allowHosts.map((h) => {
        const isSuffix = h.startsWith('.') || h.startsWith('*.');
        const clean = h.replace(/^\*\./, '');
        return {
          direction: 'egress' as const,
          destination: isSuffix ? { kind: 'domainSuffix' as const, suffix: clean } : { kind: 'domain' as const, domain: clean },
          protocols: ['tcp' as const],
          ports: [],
          action: 'allow' as const,
        };
      });
      builder = builder.network((b: any) => b
        .enabled(true)
        .policy({
          defaultEgress: 'deny',
          defaultIngress: 'deny',
          rules,
        }));
    }

    // Secret injection: placeholder env vars + per-host substitution rules.
    for (const sec of resolvedSecrets) {
      builder = builder.secret((b: any) => {
        let sb = b.env(sec.envVar).value(sec.value).placeholder(sec.placeholder);
        for (const host of sec.hosts) sb = sb.allow(host);
        return sb;
      });
    }

    sandbox = await builder.create();
  } catch (e: any) {
    return fail(`sandbox_unavailable: ${e?.message || e}`, { sandboxId: name });
  }

  const sandboxId = sandbox.id ?? sandbox.name ?? name;
  try {
    // execWith passes argv (no shell), per-exec cwd/env overlay, and an
    // SDK-enforced timeout that SIGKILLs the guest process on expiry.
    const execPromise = sandbox.execWith(String(opts.command).trim(), (b) => {
      let eb = b.args(opts.args ?? []).timeout(timeoutMs);
      if (opts.workdir) eb = eb.cwd(opts.workdir);
      const execEnvKeys = Object.keys(env);
      if (execEnvKeys.length) eb = eb.envs(env);
      return eb;
    });

    // Belt-and-suspenders hard deadline: if the SDK timeout fails to fire,
    // we kill the whole VM ourselves and report a timeout.
    let killer: ReturnType<typeof setTimeout> | null = null;
    const deadline = new Promise<'__deadline__'>((resolve) => {
      killer = setTimeout(() => {
        void sandbox?.kill?.().catch(() => { });
        void sandbox?.stop?.().catch(() => { });
        resolve('__deadline__');
      }, timeoutMs + KILL_GRACE_MS);
    });

    const outcome = await Promise.race([
      execPromise.then((out) => ({ kind: 'exec' as const, out })),
      deadline.then(() => ({ kind: 'deadline' as const })),
    ]);
    if (killer) clearTimeout(killer);

    if (outcome.kind === 'deadline') {
      return fail(`sandbox_timeout: command exceeded ${timeoutMs}ms + ${KILL_GRACE_MS}ms grace`, {
        sandboxId,
      });
    }

    const out = outcome.out as SdkExecOutput;
    const stdout = capOutput(out.stdout());
    const stderr = capOutput(
      (secretWarnings.length ? `[sandbox] ${secretWarnings.join('; ')}\n` : '') + out.stderr()
    );
    const exitCode = typeof out.code === 'number' ? out.code : null;
    const timedOut = /timeout/i.test(stderr) && exitCode !== 0 && stderr.length < 4096;
    return {
      ok: exitCode === 0 && !timedOut,
      stdout,
      stderr,
      exitCode,
      durationMs: Date.now() - startMs,
      sandboxId,
      ...(timedOut ? { error: `sandbox_timeout: ${stderr.trim().slice(0, 200)}` } : {}),
    };
  } catch (e: any) {
    const msg = String(e?.message || e || 'unknown error');
    const prefix = /timeout|timed out|deadline/i.test(msg) ? 'sandbox_timeout' : 'sandbox_exec_error';
    return fail(`${prefix}: ${msg}`, { sandboxId });
  } finally {
    // v1 contract: ALWAYS destroy. stop() then remove() the named sandbox.
    if (sandbox) {
      try { await sandbox.stop(); } catch { /* already stopped */ }
    }
    try { await sdk.Sandbox.remove(name); } catch { /* ephemeral may have auto-removed */ }
  }
}

/**
 * Probe whether microsandbox is usable on this host: SDK importable AND the
 * runtime reachable (Sandbox.list() round-trips). `runtime` reports the msb
 * version string when the CLI is on PATH.
 */
export async function sandboxStatus(): Promise<SandboxStatus> {
  // 1. Is the `msb` CLI on PATH?
  const runtime = await new Promise<string | null>((resolve) => {
    execFile('msb', ['--version'], { timeout: 3000 }, (err, stdout) => {
      if (err) return resolve(null);
      resolve(String(stdout || '').trim() || 'msb (version unknown)');
    });
  });

  // 2. Can we load the SDK and reach the runtime?
  let sdk: SdkModule;
  try {
    sdk = await loadSdk();
  } catch (e: any) {
    return { available: false, runtime, detail: `sdk_load_failed: ${e?.message || e}` };
  }

  try {
    const probe = Promise.resolve()
      .then(() => (sdk.Sandbox.list ? sdk.Sandbox.list() : Promise.resolve(null)));
    await Promise.race([
      probe,
      new Promise((_, rej) => setTimeout(() => rej(new Error('probe timeout')), STATUS_PROBE_MS)),
    ]);
    return { available: true, runtime, detail: runtime ? undefined : 'msb CLI not on PATH (SDK may still work)' };
  } catch (e: any) {
    return {
      available: false,
      runtime,
      detail: `runtime_unreachable: ${e?.message || e}`,
    };
  }
}
