"""Mac 解析服务入口（本地运行，默认端口 8001）。

端点：
  POST /parse/pdf    上传 PDF → 数字/扫描自动判别 + 提取 → 结构化检验项
  POST /parse/image   上传图片 → Vision OCR → 文本
  POST /parse/labs    粘贴检验文本 → 尝试结构化
  GET  /health

原则：原件只存 Mac（~/qohl-assistant/uploads），上送服务器的只有结构化 JSON。
"""
from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .normalize import normalize_item_name
from .parse_pdf import extract_tables, is_digital
from .vision_ocr import ocr_image_bytes, ocr_pdf_scanned

UPLOADS_DIR = Path(os.environ.get("GI_UPLOADS_DIR", str(Path.home() / "qohl-assistant" / "uploads")))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="GI Mac Parse Service", version="0.5")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# 检验行正则：项目 + 数值 + 剩余部分（单位/参考范围/标志 启发式拆分）
LAB_LINE = re.compile(
    r"^(?P<name>[^\d]{1,24}?)\s*(?P<value>\d+(?:\.\d+)?)\s*(?P<rest>.*)$"
)


def _split_rest(rest: str) -> tuple[str, str, str]:
    """把 '10^9/L 3.5-9.5 ↑' 拆为 (单位, 参考范围, 异常标志)。

    参考范围以包含 - ~ — – < > 的 token 识别；标志只在行尾（↑/↓/H/L）。
    """
    rest = rest.strip()
    flag = ""
    if rest and rest[-1] in ("↑", "H", "h", "↓", "L", "l"):
        last = rest[-1]
        flag = "↑" if last in ("↑", "H", "h") else "↓"
        rest = rest[:-1].strip()
    tokens = rest.split()
    ref = ""
    unit = ""
    for i, t in enumerate(tokens):
        if re.search(r"[-~—–<>]", t):
            ref = t
            unit = " ".join(tokens[:i])
            break
    if not ref:
        unit = " ".join(tokens)
    return unit, ref, flag


def _parse_lab_text(text: str, base_conf: float = 0.7) -> list[dict]:
    items = []
    for line in (text or "").splitlines():
        line = line.strip().strip("|")
        m = LAB_LINE.match(line)
        if not m:
            continue
        raw_name = m.group("name").strip().strip(":：")
        standard, conf = normalize_item_name(raw_name)
        unit, ref, flag = _split_rest(m.group("rest").strip())
        items.append({
            "项目": standard,
            "原始项目名": raw_name,
            "结果": m.group("value"),
            "单位": unit,
            "参考范围": ref,
            "异常标志": flag,
            "置信度": round(min(conf, base_conf), 2),
        })
    return items


def _parse_table_rows(tables: list, base_conf: float = 0.85) -> list[dict]:
    items = []
    for tbl in tables:
        for row in tbl:
            cells = [str(c or "").strip() for c in row]
            cells = [c for c in cells if c]
            if len(cells) < 3:
                continue
            if not re.match(r"^\d+(\.\d+)?$", cells[1]):
                continue
            raw_name = cells[0].strip(":：")
            standard, conf = normalize_item_name(raw_name)
            flag = "↑" if any(ch in cells[-1] for ch in ("↑", "H")) else ("↓" if any(ch in cells[-1] for ch in ("↓", "L")) else "")
            items.append({
                "项目": standard,
                "原始项目名": raw_name,
                "结果": cells[1],
                "单位": cells[2] if len(cells) > 2 and not re.search(r"\d", cells[2]) else "",
                "参考范围": next((c for c in cells[3:] if re.search(r"[\d~\-—<>]", c)), ""),
                "异常标志": flag,
                "置信度": round(min(conf, base_conf), 2),
            })
    return items


@app.get("/health")
def health():
    return {"status": "ok", "uploads_dir": str(UPLOADS_DIR)}


@app.post("/parse/pdf")
async def parse_pdf(file: UploadFile):
    data = await file.read()
    mid = uuid.uuid4().hex[:12]
    fname = f"{mid}_{file.filename or 'upload.pdf'}"
    path = UPLOADS_DIR / fname
    path.write_bytes(data)  # 原件仅存 Mac

    digital, text = is_digital(data)
    tables = extract_tables(data) if digital else []
    items = _parse_table_rows(tables) if tables else []
    base_conf = 0.85 if digital else 0.5
    if not digital:
        try:
            ocr_text = ocr_pdf_scanned(data)
            text = (text + "\n" + ocr_text).strip()
        except Exception as e:
            text = f"（扫描件 OCR 失败: {e}）"
    if not items and text:
        items = _parse_lab_text(text, base_conf=base_conf)

    return {
        "material_id": mid,
        "saved_path": str(path),
        "is_digital": digital,
        "text": text[:20000],
        "tables": tables[:20],
        "items": items,
        "confidence": base_conf,
    }


@app.post("/parse/image")
async def parse_image(file: UploadFile):
    data = await file.read()
    mid = uuid.uuid4().hex[:12]
    fname = f"{mid}_{file.filename or 'upload.png'}"
    (UPLOADS_DIR / fname).write_bytes(data)
    try:
        text = ocr_image_bytes(data)
    except Exception as e:
        text = f"（OCR 失败: {e}）"
    return {"material_id": mid, "saved_path": str(UPLOADS_DIR / fname), "text": text[:20000],
            "items": _parse_lab_text(text, base_conf=0.5)}


class LabsTextIn(BaseModel):
    text: str


@app.post("/parse/labs")
def parse_labs(data: LabsTextIn):
    items = _parse_lab_text(data.text)
    return {"items": items}
