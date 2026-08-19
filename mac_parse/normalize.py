"""检验项目名归一化：把各医院不同写法的项目名映射到统一标准名。

词典为可配置 JSON（normalize_dict.json）。规则：
1. 先查全等映射（精确匹配别名表）；
2. 再查包含匹配（按包含关系降级匹配）。
未命中的项目名原样保留并标记 low_confidence。
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DICT_PATH = Path(__file__).parent / "normalize_dict.json"


def _load_dict() -> dict[str, Any]:
    if DICT_PATH.exists():
        return json.loads(DICT_PATH.read_text(encoding="utf-8"))
    return {"aliases": {}}


def normalize_item_name(raw: str) -> tuple[str, float]:
    """返回 (标准名, 置信度)。"""
    name = (raw or "").strip()
    if not name:
        return name, 0.0
    d = _load_dict()
    aliases = d.get("aliases", {})

    # 1) 精确匹配
    if name in aliases:
        return aliases[name]["standard"], 1.0

    # 2) 包含匹配（标准名包含别名 或 别名包含标准名的近似）
    for alias, info in aliases.items():
        if alias and (alias in name or name in alias):
            return info["standard"], 0.9

    return name, 0.5  # 未归一化，低置信度
