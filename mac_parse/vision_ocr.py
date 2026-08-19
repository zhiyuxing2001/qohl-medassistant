"""扫描件 OCR：macOS 原生 Vision 框架（pyobjc 封装），支持简体中文，离线。"""
from __future__ import annotations

import io
from typing import Optional

import Vision
import Quartz
from Foundation import NSData, NSURL


def ocr_image_bytes(image_bytes: bytes, lang: str = "zh-Hans") -> str:
    """对图片字节做 OCR，返回识别文本。"""
    data = NSData.dataWithBytes_length_(image_bytes, len(image_bytes))
    src = Quartz.CGImageSourceCreateWithData(data, None)
    if src is None:
        raise ValueError("无法解码图片")
    cg_image = Quartz.CGImageSourceCreateImageAtIndex(src, 0, None)
    if cg_image is None:
        raise ValueError("CGImage 创建失败")

    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setRecognitionLanguages_([lang])
    request.setUsesLanguageCorrection_(True)

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, None)
    success = handler.performRequests_error_([request], None)
    if not success:
        return ""

    lines = []
    for obs in request.results() or []:
        text = obs.topCandidates_(1)
        if text and len(text) > 0:
            lines.append(str(text[0].string()))
    return "\n".join(lines)


def ocr_pdf_scanned(pdf_bytes: bytes) -> str:
    """扫描版 PDF：逐页渲染为图片后 OCR（PyMuPDF 渲染）。"""
    import fitz  # PyMuPDF

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    texts = []
    for page in doc:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x 提升小字识别率
        img_bytes = pix.tobytes("png")
        try:
            texts.append(ocr_image_bytes(img_bytes))
        except Exception as e:
            texts.append(f"（第{page.number + 1}页 OCR 失败: {e}）")
    doc.close()
    return "\n".join(texts)
