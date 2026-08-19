"""自动脱敏辅助工具：正则识别常见敏感字段。

注意：仅辅助，不保证完全脱敏；示例启用前必须经人工复核（UI 强制）。
"""
from __future__ import annotations

import re
from typing import Any

PATTERNS: list[tuple[str, re.Pattern]] = [
    ("身份证号", re.compile(r"\b\d{17}[\dXx]\b")),
    ("手机号", re.compile(r"\b1[3-9]\d{9}\b")),
    ("座机号码", re.compile(r"\b0\d{2,3}-?\d{7,8}\b")),
    ("银行卡号", re.compile(r"\b\d{16,19}\b")),
    ("邮箱", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")),
    ("住院号/病历号", re.compile(r"(住院号|病历号|病案号|住院编号)[:：]?\s*[A-Za-z0-9-]{4,}")),
]


def detect(text: str) -> dict[str, Any]:
    """返回检测到的敏感字段列表。"""
    matches = []
    for kind, pat in PATTERNS:
        for m in pat.finditer(text or ""):
            matches.append({"类型": kind, "内容": m.group(0), "位置": [m.start(), m.end()]})
    return {"found": bool(matches), "matches": matches}


def anonymize(text: str) -> dict[str, Any]:
    """替换敏感字段为占位符，返回替换后的文本与替换计数。"""
    out = text or ""
    count = 0
    for kind, pat in PATTERNS:
        out, n = pat.subn(f"【{kind}已脱敏】", out)
        count += n
    return {"text": out, "replaced": count}
