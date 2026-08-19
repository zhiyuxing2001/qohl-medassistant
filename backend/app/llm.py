"""LLM 客户端：OpenAI 兼容端点（vLLM）+ stub 模式。

- 生产：VLLM_BASE_URL 指向服务器 vLLM（OpenAI 兼容 /v1）；
- 开发/测试：LLM_STUB=1 时返回占位文本，用于无 GPU 环境跑通全链路。
"""
from __future__ import annotations

import json
from typing import Optional

from openai import OpenAI

from . import config

# 诊疗计划 JSON Schema（guided_json 使用）
CARE_PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "检查建议": {"type": "array", "items": {"type": "string"}},
        "治疗建议": {"type": "array", "items": {"type": "string"}},
        "用药调整": {"type": "array", "items": {"type": "string"}},
        "随访计划": {"type": "array", "items": {"type": "string"}},
        "风险与注意": {"type": "array", "items": {"type": "string"}},
        "资料缺口": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["检查建议", "治疗建议", "用药调整", "随访计划", "风险与注意", "资料缺口"],
    "additionalProperties": False,
}


def _stub_text(messages: list[dict], json_schema: Optional[dict]) -> str:
    last = messages[-1]["content"]
    if json_schema is not None:
        obj = {k: ["（stub 占位，正式使用时由 DeepSeek 生成）"] for k in json_schema["properties"]}
        return json.dumps(obj, ensure_ascii=False, indent=2)
    if "【修改指令】" in last or "修订" in str(last)[:200]:
        return ("已按修改指令完成修订（stub 模式，未接入真实模型）。\n\n"
                "患者，男，56岁，主诉\"上腹痛3天\"。\n"
                "现病史：患者3天前无明显诱因出现上腹部隐痛……（占位文本，正式使用时由 DeepSeek 模型生成）")
    return ("（stub 模式生成，未接入真实模型。请配置 VLLM_BASE_URL 指向服务器 vLLM。）\n\n"
            "患者，男，56岁，主诉\"上腹痛3天\"。\n"
            "现病史：患者3天前无明显诱因出现上腹部隐痛……（占位文本，正式使用时由 DeepSeek 模型生成）")


def complete(messages: list[dict], temperature: float, max_tokens: Optional[int] = None,
             json_schema: Optional[dict] = None, stream: bool = False):
    """返回文本（stream=False）或生成器（stream=True，逐段 delta）。"""
    max_tokens = max_tokens or config.MAX_TOKENS
    if config.LLM_STUB:
        text = _stub_text(messages, json_schema)
        if stream:
            return iter([text])
        return text

    client = OpenAI(base_url=config.VLLM_BASE_URL, api_key=config.LLM_API_KEY,
                    timeout=config.LLM_TIMEOUT)
    kwargs = dict(model=config.LLM_MODEL, messages=messages, temperature=temperature,
                  max_tokens=max_tokens, stream=stream)
    if json_schema is not None:
        kwargs["response_format"] = {"type": "json_object"}
        kwargs["extra_body"] = {"guided_json": json.dumps(json_schema)}
    resp = client.chat.completions.create(**kwargs)
    if stream:
        def gen():
            for chunk in resp:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        return gen()
    return resp.choices[0].message.content
