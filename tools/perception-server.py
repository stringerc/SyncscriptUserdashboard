#!/usr/bin/env python3
"""Cortex perception sidecar — local vision/emotion/speaker models.

Endpoints (FastAPI, default :8940):
  GET  /health            -> {ok, models:{loaded:{...}}}
  POST /vision            {image, prompt?}        -> mlx-vlm (Qwen3-VL)
  POST /emotion           {audio}                 -> emotion2vec+ via funasr
  POST /speaker           {audio, numSpeakers?}   -> sherpa-onnx diarization

Models lazy-load on first use. Run:
  /tmp/cortex-ai-venv/bin/python tools/perception-server.py [--port 8940]
"""
import argparse, os, sys, threading, time, traceback

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="cortex-perception")
_lock = threading.Lock()
_models = {}

VISION_MODEL = os.environ.get("CORTEX_VLM_MODEL", "mlx-community/Qwen3-VL-4B-Instruct-4bit")
EMOTION_MODEL = os.environ.get("CORTEX_EMOTION_MODEL", "iic/emotion2vec_plus_large")
DIAR_MODEL_DIR = __import__("pathlib").Path(os.environ.get(
    "CORTEX_DIAR_MODEL_DIR",
    os.path.expanduser("~/.cache/cortex/sherpa-onnx-pyannote"),
))


def _load(key, fn):
    with _lock:
        if key not in _models:
            _models[key] = fn()
        return _models[key]


@app.get("/health")
def health():
    return {"ok": True, "models": {"loaded": {k: True for k in _models}, "config": {
        "vision": VISION_MODEL, "emotion": EMOTION_MODEL, "diar": DIAR_MODEL_DIR}}}


class VisionReq(BaseModel):
    image: str
    prompt: str = "Describe this image in detail."


@app.post("/vision")
def vision(req: VisionReq):
    t0 = time.time()
    try:
        from mlx_vlm import load, generate
        from mlx_vlm.prompt_utils import apply_chat_template
        from mlx_vlm.utils import load_config

        model, processor = _load("vision", lambda: load(VISION_MODEL))
        config = load_config(VISION_MODEL)
        prompt = apply_chat_template(processor, config, req.prompt, num_images=1)
        out = generate(model, processor, prompt, [req.image], max_tokens=512, verbose=False)
        text = out.text if hasattr(out, "text") else str(out)
        return {"ok": True, "model": VISION_MODEL, "answer": text.strip(),
                "latencyMs": int((time.time() - t0) * 1000)}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}", "trace": traceback.format_exc()[-800:]}


class AudioReq(BaseModel):
    audio: str


@app.post("/emotion")
def emotion(req: AudioReq):
    # emotion2vec needs torch, which lacks cp315 wheels — use tools/emotion-server.py (:8941, py<=3.13).
    return {"ok": False, "error": "use emotion-server.py on :8941 (torch unavailable on python 3.15)"}


class SpeakerReq(BaseModel):
    audio: str
    numSpeakers: int | None = None


@app.post("/speaker")
def speaker(req: SpeakerReq):
    t0 = time.time()
    try:
        import sherpa_onnx
        sd = _load("speaker", lambda: sherpa_onnx.OfflineSpeakerDiarization(
            sherpa_onnx.OfflineSpeakerDiarizationConfig(
                segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(
                    pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(
                        model=str(DIAR_MODEL_DIR / "pyannote-segmentation-3.0.onnx")),
                    num_threads=4),
                embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(
                    model=str(DIAR_MODEL_DIR / "3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"),
                    num_threads=4),
                clustering=sherpa_onnx.FastClusteringConfig(num_clusters=req.numSpeakers or -1),
                min_duration_on=0.3, min_duration_off=0.5)))
        import wave
        import numpy as np
        with wave.open(req.audio, 'rb') as w:
            frames = w.readframes(w.getnframes())
            pcm = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
            if w.getnchannels() > 1:
                pcm = pcm.reshape(-1, w.getnchannels()).mean(axis=1)
            sr = w.getframerate()
        # sherpa-onnx diarization expects 16kHz mono float32
        if sr != 16000:
            n16 = int(len(pcm) * 16000 / sr)
            pcm = np.interp(np.linspace(0, len(pcm) - 1, n16), np.arange(len(pcm)), pcm).astype(np.float32)
        sd_result = sd.process(pcm)
        sorted_segments = sd_result.sort_by_start_time()
        segments = [{"start": s.start, "end": s.end, "speaker": s.speaker}
                    for s in sorted_segments]
        return {"ok": True, "segments": segments, "count": len(segments),
                "speakers": sorted({s["speaker"] for s in segments}),
                "latencyMs": int((time.time() - t0) * 1000)}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}", "trace": traceback.format_exc()[-800:]}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=int(os.environ.get("CORTEX_PERCEPTION_PORT", 8940)))
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
