"""生成后一致性校验（启发式）：输出中出现的检验数值须能在输入资料中溯源。

实现说明：对每个已知检验项目，若输出文本中出现该项目名称，则提取紧随其后的数值，
若该数值不在该项目输入结果集合中，标记为疑似虚构。启发式工具，供 UI 标黄提示，
不阻断生成。
"""
from __future__ import annotations

import re
from typing import Any


def check_consistency(content: str, input_items: list[dict]) -> dict[str, Any]:
    warnings = []
    for item in input_items:
        name = str(item.get("项目", ""))
        if not name or name not in content:
            continue
        known = {str(item.get("结果", "")).strip()}
        # 名称后可能出现 "项目 数值 单位" 或 "项目:数值"
        pat = re.compile(re.escape(name) + r"[\s:：]*([0-9]+(?:\.[0-9]+)?)")
        for m in pat.finditer(content):
            val = m.group(1)
            if val not in known:
                warnings.append({
                    "项目": name,
                    "输出数值": val,
                    "输入结果": sorted(known),
                    "提示": "输出中的数值与输入资料不一致，请核对",
                })
    return {"has_warnings": bool(warnings), "warnings": warnings[:20]}
