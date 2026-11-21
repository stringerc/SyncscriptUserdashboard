#!/usr/bin/env python3
"""
parakeet-stt-server — OpenAI-compatible transcription endpoint backed by
parakeet-mlx (NVIDIA Parakeet TDT 0.6B v3 in pure Apple MLX).

Runs on :8179. Consumed by /api/cortex/stt in vite.config.ts as the rung
between Groq whisper-large-v3-turbo and whisper.cpp :8178.

Endpoints:
  GET  /health                      -> {"ok": true}
  GET  /v1/models                   -> OpenAI model list
  POST /v1/audio/transcriptions     -> {text}  (multipart: file, model?, response_format?)

Install (one-time):
  uv venv tools/parakeet-stt/.venv
  uv pip install --python tools/parakeet-stt/.venv/bin/python \
      parakeet-mlx fastapi uvicorn python-multipart

Run:
  tools/parakeet-stt/.venv/bin/python tools/parakeet-stt/server.py
  # or: uv run --python 3.12 tools/parakeet-stt/server.py

First request downloads ~1.2GB of MLX weights to the HF cache.
"""

import os
import sys
import tempfile

# parakeet-mlx is optional at import time so /health works before install.
try:
    from parakeet_mlx import from_pretrained as parakeet_from_pretrained
except Exception as e:  # pragma: no cover
    parakeet_from_pretrained = None
    PARAKEET_IMPORT_ERROR = str(e)
else:
    PARAKEET_IMPORT_ERROR = None

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

MODEL_ID = os.environ.get("PARAKEET_MODEL", "mlx-community/parakeet-tdt-0.6b-v3")

app = FastAPI(title="parakeet-stt-server")
_model = None


def get_model():
    global _model
    if _model is None:
        if parakeet_from_pretrained is None:
            raise HTTPException(503, f"parakeet-mlx not installed: {PARAKEET_IMPORT_ERROR}")
        _model = parakeet_from_pretrained(MODEL_ID)
    return _model


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_ID, "ready": _model is not None,
            "importError": PARAKEET_IMPORT_ERROR}


@app.get("/v1/models")
def models():
    return {"object": "list", "data": [{
        "id": "parakeet-tdt-0.6b-v3", "object": "model",
        "owned_by": "parakeet-mlx", "created": 0,
    }]}


@app.post("/v1/audio/transcriptions")
async def transcribe(file: UploadFile = File(...), model: str = Form("parakeet-tdt-0.6b-v3"),
                     response_format: str = Form("json")):
    audio_bytes = await file.read()
    if len(audio_bytes) < 100:
        raise HTTPException(400, "empty audio")

    suffix = os.path.splitext(file.filename or "speech.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        model_obj = get_model()
        # parakeet-mlx API: model.transcribe(path) -> result with .text
        result = model_obj.transcribe(tmp_path)
        text = getattr(result, "text", None) or (result.get("text") if isinstance(result, dict) else str(result))
        return {"text": (text or "").strip()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"transcription failed: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8179"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
