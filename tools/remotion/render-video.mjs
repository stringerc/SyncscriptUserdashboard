#!/usr/bin/env node
/**
 * render-video.mjs — programmatic Remotion render via @remotion/renderer.
 *
 * Usage:
 *   node render-video.mjs --composition <id> --out <path>
 *                         [--props '<json>'] [--concurrency <n>]
 *                         [--fps <n>] [--codec <h264|vp8|h265|mp3|...>]
 *                         [--frames <start-end>] [--still <path>]
 *
 * Prints a single-line JSON result to stdout:
 *   {"ok":true,"out":"...","durationMs":123}
 *   {"ok":false,"error":"..."}
 *
 * This script imports @remotion/bundler + @remotion/renderer directly so the
 * main app's governed `render_video` tool does not need to shell out to the
 * slow `npx remotion render` CLI.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { props: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "--composition":
        args.composition = next();
        break;
      case "--out":
        args.out = next();
        break;
      case "--props":
        args.props = next();
        break;
      case "--concurrency":
        args.concurrency = parseInt(next(), 10);
        break;
      case "--fps":
        args.fps = parseFloat(next());
        break;
      case "--codec":
        args.codec = next();
        break;
      case "--frames":
        args.frames = next();
        break;
      case "--still":
        args.still = next();
        break;
      case "--entry":
        args.entry = next();
        break;
      default:
        throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

function fail(error) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(error) }) + "\n");
  process.exit(1);
}

async function main() {
  const t0 = Date.now();
  const args = parseArgs(process.argv.slice(2));

  if (!args.composition) fail("--composition is required");
  if (!args.out && !args.still) fail("--out (or --still) is required");

  let inputProps;
  if (args.props !== undefined) {
    try {
      inputProps = JSON.parse(args.props);
    } catch (e) {
      fail(`--props is not valid JSON: ${e.message}`);
    }
  }

  // Ensure the headless Chrome binary is available (no-op if cached).
  // Returns {path, type} in Remotion 4.x.
  const browserInfo = await ensureBrowser();
  const browserExecutable =
    typeof browserInfo === "string" ? browserInfo : browserInfo?.path ?? null;

  const entryPoint =
    args.entry ?? path.join(__dirname, "src", "index.ts");

  const serveUrl = await bundle({
    entryPoint,
    // Keep node_modules resolution anchored at this project root.
    rootDir: __dirname,
  });

  const composition = await selectComposition({
    serveUrl,
    id: args.composition,
    inputProps,
    browserExecutable,
  });

  // Headless-safe Chromium options. angle gives real WebGL for three.js
  // scenes; fall back-able via env if a machine lacks GPU support.
  const chromiumOptions = {
    gl: process.env.REMOTION_GL ?? "angle",
    disableWebSecurity: false,
  };

  if (args.still) {
    const outLocation = path.isAbsolute(args.still)
      ? args.still
      : path.resolve(process.cwd(), args.still);
    const frame = args.frames ? parseInt(args.frames.split("-")[0], 10) : 0;
    await renderStill({
      composition,
      serveUrl,
      output: outLocation,
      inputProps,
      frame,
      chromiumOptions,
      browserExecutable,
    });
    process.stdout.write(
      JSON.stringify({
        ok: true,
        out: outLocation,
        durationMs: Date.now() - t0,
        frame,
      }) + "\n"
    );
    return;
  }

  const outLocation = path.isAbsolute(args.out)
    ? args.out
    : path.resolve(process.cwd(), args.out);

  let frameRange;
  if (args.frames) {
    const [s, e] = args.frames.split("-").map((v) => parseInt(v, 10));
    frameRange = [s, e ?? s];
  }

  await renderMedia({
    composition,
    serveUrl,
    codec: args.codec ?? "h264",
    outputLocation: outLocation,
    inputProps,
    chromiumOptions,
    concurrency: args.concurrency,
    frameRange,
    browserExecutable,
    onProgress: () => {},
  });

  process.stdout.write(
    JSON.stringify({
      ok: true,
      out: outLocation,
      durationMs: Date.now() - t0,
      frames: composition.durationInFrames,
      fps: composition.fps,
    }) + "\n"
  );
}

main().catch((e) => fail(e && e.stack ? e.stack : e));
