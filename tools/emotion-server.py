#!/usr/bin/env python3
"""Cortex emotion sidecar — emotion2vec+ speech affect via funasr/torch.

Requires a Python <=3.13 venv with torch+funasr (torch lacks cp315 wheels):
  python3.13 -m venv .venv && .venv/bin/pip install torch torchaudio funasr soundfile
  .venv/bin/python tools/emotion-server.py [--port 8941]

POST /emotion {audio: "/abs/path.wav"} -> {ok, labels, scores}
GET  /health -> {ok}
"""
import argparse, os, time, traceback
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="cortex-emotion")
_model = None
MODEL = os.environ.get("CORTEX_EMOTION_MODEL", "iic/emotion2vec_plus_large")


def get_model():
    global _model
    if _model is None:
        from funasr import AutoModel
        _model = AutoModel(model=MODEL, disable_update=True)
    return _model


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL, "loaded": _model is not None}


def _jsonable(v):
    import numpy as np
    if isinstance(v, dict):
        return {str(k): _jsonable(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_jsonable(x) for x in v]
    if isinstance(v, np.generic):
        return v.item()
    if isinstance(v, np.ndarray):
        return v.tolist()
    return v


class AudioReq(BaseModel):
    audio: str


@app.post("/emotion")
def emotion(req: AudioReq):
    t0 = time.time()
    try:
        model = get_model()
        res = model.generate(input=req.audio, granularity="utterance")
        r = res[0] if res else {}
        return {"ok": True, "model": MODEL,
                "labels": _jsonable(r.get("labels", r.get("emotion", {}))),
                "scores": _jsonable(r.get("scores", {})),
                "latencyMs": int((time.time() - t0) * 1000)}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}",
                "trace": traceback.format_exc()[-800:]}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=int(os.environ.get("CORTEX_EMOTION_PORT", 8941)))
    ap.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args()
    uvicorn.run(app, host=a.host, port=a.port, log_level="warning")
