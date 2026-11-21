#!/usr/bin/env python3
"""speaches launcher — OpenAI-compatible local speech server for Cortex.

Exposes /v1/audio/transcriptions (faster-whisper), /v1/audio/speech
(Kokoro/Piper), /v1/chat/completions, /v1/models, /v1/vad on 127.0.0.1:8932.
Pairs with `mlx_lm.server` (:8931) as the local OpenAI-compatible stack —
speaches covers audio, mlx-lm covers the chat brain.

Env:
  SPEACHES_PORT   (default 8932)
  SPEACHES_MODEL  faster-whisper model id (default: Systran/faster-whisper-small)
  WHISPER__*      passthrough to speaches Config (e.g. WHISPER__INFERENCE_DEVICE=cpu)

Run:  tools/speaches/.venv/bin/python tools/speaches/server.py
"""
import os

import uvicorn  # noqa: E402
from speaches.main import create_app  # noqa: E402


def main() -> None:
    # speaches resolves realtime-console/dist relative to CWD — pin CWD to
    # this directory so the server works from any launch directory.
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(os.environ.get('SPEACHES_PORT', '8932'))
    host = os.environ.get('SPEACHES_HOST', '127.0.0.1')
    # speaches mounts realtime-console/dist unconditionally; the prebuilt
    # console isn't in the git repo (dist/ is gitignored), so provide a
    # minimal placeholder when it's absent.
    console = os.path.join(os.getcwd(), 'realtime-console', 'dist')
    if not os.path.isdir(console):
        os.makedirs(console, exist_ok=True)
        with open(os.path.join(console, 'index.html'), 'w') as f:
            f.write('<!doctype html><title>speaches realtime console not built</title>')
    app = create_app()
    uvicorn.run(app, host=host, port=port, log_level='warning')


if __name__ == '__main__':
    main()
