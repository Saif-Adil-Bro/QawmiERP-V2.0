import io
import os
import traceback
from typing import Dict, List, Any, Optional

import numpy as np
import pytesseract
from pytesseract import Output
from PIL import Image
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR

app = FastAPI(title="QawmiERP PaddleOCR Microservice", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPPORTED_LANGS = {"bn", "ar", "en"}
_ocr_instances: Dict[str, Optional[PaddleOCR]] = {}


def get_ocr_engine(lang: str) -> Optional[PaddleOCR]:
    normalized_lang = lang.strip().lower() if lang else "bn"
    if normalized_lang not in SUPPORTED_LANGS:
        normalized_lang = "bn"

    if normalized_lang not in _ocr_instances:
        try:
            _ocr_instances[normalized_lang] = PaddleOCR(
                use_angle_cls=True,
                lang=normalized_lang,
                show_log=False,
            )
        except Exception as exc:
            if normalized_lang == "bn":
                print(f"[OCR] PaddleOCR does not support '{normalized_lang}' directly ({exc}); using server-side Bengali OCR.")
                _ocr_instances[normalized_lang] = None
            else:
                raise
    return _ocr_instances[normalized_lang]


def run_bengali_server_ocr(image: Image.Image) -> List[Dict[str, Any]]:
    data = pytesseract.image_to_data(image, lang="ben+eng", output_type=Output.DICT)
    line_groups: Dict[tuple, Dict[str, Any]] = {}
    n = len(data.get("text", []))
    for i in range(n):
        word = str(data["text"][i]).strip()
        if not word:
            continue
        conf_raw = float(data["conf"][i]) if data["conf"][i] != "-1" else 0.0
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        x = float(data["left"][i])
        y = float(data["top"][i])
        w = float(data["width"][i])
        h = float(data["height"][i])
        if key not in line_groups:
            line_groups[key] = {
                "words": [word],
                "confs": [max(0.0, conf_raw / 100.0)],
                "x1": x,
                "y1": y,
                "x2": x + w,
                "y2": y + h,
            }
        else:
            grp = line_groups[key]
            grp["words"].append(word)
            grp["confs"].append(max(0.0, conf_raw / 100.0))
            grp["x1"] = min(grp["x1"], x)
            grp["y1"] = min(grp["y1"], y)
            grp["x2"] = max(grp["x2"], x + w)
            grp["y2"] = max(grp["y2"], y + h)

    lines: List[Dict[str, Any]] = []
    for grp in sorted(line_groups.values(), key=lambda g: (g["y1"], g["x1"])):
        text = " ".join(grp["words"]).strip()
        if not text:
            continue
        avg_conf = sum(grp["confs"]) / len(grp["confs"]) if grp["confs"] else 0.0
        lines.append({
            "text": text,
            "confidence": round(avg_conf, 4),
            "bbox": [
                [grp["x1"], grp["y1"]],
                [grp["x2"], grp["y1"]],
                [grp["x2"], grp["y2"]],
                [grp["x1"], grp["y2"]],
            ],
        })
    return lines


def sort_ocr_boxes(raw_lines: List[Any], lang: str) -> List[Dict[str, Any]]:
    """
    Sort detected text boxes top-to-bottom, and within the same visual line:
    - right-to-left for Arabic ('ar')
    - left-to-right for Bengali ('bn') / English ('en')
    """
    parsed: List[Dict[str, Any]] = []
    for item in raw_lines:
        if not item or len(item) < 2:
            continue
        box = item[0]
        text_info = item[1]
        text = str(text_info[0]).strip() if text_info and len(text_info) > 0 else ""
        confidence = float(text_info[1]) if text_info and len(text_info) > 1 else 0.0
        if not text:
            continue

        xs = [float(pt[0]) for pt in box]
        ys = [float(pt[1]) for pt in box]
        y_center = sum(ys) / len(ys)
        x_min = min(xs)
        x_max = max(xs)
        height = max(ys) - min(ys)

        parsed.append({
            "text": text,
            "confidence": round(confidence, 4),
            "bbox": box,
            "y_center": y_center,
            "x_min": x_min,
            "x_max": x_max,
            "height": height,
        })

    if not parsed:
        return []

    # Sort primarily by y_center
    parsed.sort(key=lambda b: b["y_center"])

    # Group into visual rows using adaptive height threshold
    rows: List[List[Dict[str, Any]]] = []
    for item in parsed:
        placed = False
        for row in rows:
            avg_y = sum(r["y_center"] for r in row) / len(row)
            avg_h = max(12.0, sum(r["height"] for r in row) / len(row))
            if abs(item["y_center"] - avg_y) <= avg_h * 0.55:
                row.append(item)
                placed = True
                break
        if not placed:
            rows.append([item])

    # Sort each row horizontally
    is_rtl = lang == "ar"
    sorted_lines: List[Dict[str, Any]] = []
    for row in rows:
        row.sort(key=lambda b: -b["x_max"] if is_rtl else b["x_min"])
        for b in row:
            safe_bbox = [[float(pt[0]), float(pt[1])] for pt in b["bbox"]]
            sorted_lines.append({
                "text": b["text"],
                "confidence": b["confidence"],
                "bbox": safe_bbox,
            })

    return sorted_lines


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "QawmiERP PaddleOCR",
        "supported_langs": sorted(list(SUPPORTED_LANGS)),
        "loaded_langs": list(_ocr_instances.keys()),
    }


@app.post("/scan-question")
async def scan_question(
    file: UploadFile = File(...),
    lang: str = Form("bn"),
):
    normalized_lang = lang.strip().lower() if lang else "bn"
    if normalized_lang not in SUPPORTED_LANGS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language '{lang}'. Supported languages: bn, ar, en.",
        )

    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        image = Image.open(io.BytesIO(contents)).convert("RGB")
        ocr_engine = get_ocr_engine(normalized_lang)

        if ocr_engine is None:
            sorted_lines = run_bengali_server_ocr(image)
        else:
            img_array = np.array(image)
            result = ocr_engine.ocr(img_array, cls=True)
            raw_lines = result[0] if result and len(result) > 0 and result[0] else []
            sorted_lines = sort_ocr_boxes(raw_lines, normalized_lang)

        full_text = "\n".join(line["text"] for line in sorted_lines)

        return {
            "success": True,
            "lang": normalized_lang,
            "full_text": full_text,
            "lines": sorted_lines,
        }
    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"PaddleOCR processing failed: {type(exc).__name__}: {str(exc)}",
        )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
