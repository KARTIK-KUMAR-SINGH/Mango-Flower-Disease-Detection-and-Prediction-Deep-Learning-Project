"""Mango flower disease API: loads the Keras model once, serves /predict."""
import io
import os
import pickle
from pathlib import Path

import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps

MODEL_DIR = Path(os.getenv("MODEL_DIR", Path(__file__).resolve().parents[2] / "model"))
MODEL_PATH = MODEL_DIR / os.getenv("MODEL_FILE", "mango_disease_model.keras")
META_PATH = MODEL_DIR / os.getenv("META_FILE", "mango_disease_metadata.pkl")
MAX_BYTES = 10 * 1024 * 1024

# ---- load model + metadata once at startup ----
model = tf.keras.models.load_model(MODEL_PATH)
with open(META_PATH, "rb") as f:
    meta = pickle.load(f)
if not isinstance(meta, dict):
    meta = {"class_names": list(meta)}


def _class_names(m: dict) -> list[str]:
    for key in ("class_names", "classes", "labels", "class_labels"):
        if key in m:
            v = m[key]
            if isinstance(v, dict):  # {index: name} or {name: index}
                if all(isinstance(k, int) for k in v):
                    return [v[i] for i in sorted(v)]
                return [n for n, _ in sorted(v.items(), key=lambda kv: kv[1])]
            return [str(x) for x in v]
    for key in ("class_indices", "label_map", "idx_to_class"):
        if key in m:
            return _class_names({"classes": m[key]})
    n = model.output_shape[-1]
    return [f"class_{i}" for i in range(n)]


CLASS_NAMES = _class_names(meta)

# Input size comes from the model itself (most reliable).
_, H, W, _C = model.input_shape

# How pixels are prepared. Must match what you did during training.
#   "rescale" -> x / 255   (default)   "none" -> raw 0-255 (model has its own rescaling layer)
#   "mobilenet_v2" | "resnet50" | "vgg16" | "efficientnet" | "densenet" | "inception_v3" | "xception"
# PREPROCESS = os.getenv("PREPROCESS", str(meta.get("preprocessing", "rescale"))).lower()
PREPROCESS = os.getenv("PREPROCESS", "none").lower()

_APPS = tf.keras.applications
_PREP = {
    "mobilenet_v2": _APPS.mobilenet_v2.preprocess_input,
    "resnet50": _APPS.resnet50.preprocess_input,
    "vgg16": _APPS.vgg16.preprocess_input,
    "efficientnet": _APPS.efficientnet.preprocess_input,
    "densenet": _APPS.densenet.preprocess_input,
    "inception_v3": _APPS.inception_v3.preprocess_input,
    "xception": _APPS.xception.preprocess_input,
}


def preprocess(img: Image.Image) -> np.ndarray:
    img = ImageOps.exif_transpose(img).convert("RGB").resize((W, H), Image.BILINEAR)
    x = np.asarray(img, dtype=np.float32)[None, ...]
    if PREPROCESS == "rescale":
        return x / 255.0
    if PREPROCESS == "none":
        return x
    return _PREP[PREPROCESS](x)


app = FastAPI(title="Mango Flower Disease API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "classes": CLASS_NAMES, "input_size": [H, W], "preprocess": PREPROCESS}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Please upload an image file (JPG, PNG or WebP).")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image is larger than 10 MB.")
    try:
        img = Image.open(io.BytesIO(data))
        x = preprocess(img)
    except Exception:
        raise HTTPException(400, "That file could not be read as an image.")

    out = model.predict(x, verbose=0)[0].astype(np.float64)
    if out.shape[0] == 1:  # single sigmoid output -> two classes
        out = np.array([1 - out[0], out[0]])
    if not np.isclose(out.sum(), 1.0, atol=1e-3):  # logits -> softmax
        e = np.exp(out - out.max())
        out = e / e.sum()

    order = np.argsort(out)[::-1]
    names = CLASS_NAMES if len(CLASS_NAMES) == len(out) else [f"class_{i}" for i in range(len(out))]
    scores = [{"label": names[i], "confidence": float(out[i])} for i in order]
    return {"prediction": scores[0]["label"], "confidence": scores[0]["confidence"], "scores": scores}
