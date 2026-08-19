"""数字型 PDF 文本/表格提取（pdfplumber）。"""
from __future__ import annotations

import io
from typing import Any, Optional

import pdfplumber


def extract_text(pdf_bytes: bytes) -> str:
    """提取全部文本；若为空说明可能是扫描件。"""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        pages = []
        for page in pdf.pages:
            t = page.extract_text() or ""
            pages.append(t)
    return "\n".join(pages)


def extract_tables(pdf_bytes: bytes) -> list[list[list[str]]]:
    """提取所有页面中的表格（宽松模式）。"""
    tables: list[list[list[str]]] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            for tbl in page.extract_tables():
                tables.append(tbl)
    return tables


def is_digital(pdf_bytes: bytes, min_chars: int = 30) -> tuple[bool, str]:
    """判断是否为数字型 PDF：文本长度 >= min_chars。返回 (是否数字型, 提取文本)。"""
    try:
        text = extract_text(pdf_bytes)
    except Exception as e:
        return False, f"解析失败: {e}"
    return len(text.strip()) >= min_chars, text
