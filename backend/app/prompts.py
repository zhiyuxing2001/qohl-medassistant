"""提示词加载与上下文组装器（时间线累计 + 模板 + 示例）。

组装规则（v3）：
  【格式模板】该文书类型空白模板（data/templates/{code}/template.md，可无）
  【示例】已脱敏真实病历 1–N 份（few-shot）
  【患者资料】患者固定信息 + 住院要素
  【时间线资料】检验（异常优先、限最近 N 条）+ 影像 + 内镜 + 用药
  【此前文书】最近 M 篇已确认文书全文 + 更早篇用其摘要
  【医生补充要素】extra_fields（如拟手术方案）
  【任务】文书类型模板指令（prompts/{prompt_file}）
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from . import config
from .storage import Storage, KIND_LABEL

# 需要按日期过滤的条目类型（meds 特殊处理）
DATED_KINDS = ("labs", "imaging", "endoscopy")


def _fmt_ymd(d: str) -> str:
    return str(d)[:10] if d else ""


def _load_prompt(name: str) -> str:
    p = Path(config.PROMPTS_DIR) / name
    return p.read_text(encoding="utf-8") if p.exists() else f"（提示词模板缺失：{name}）"


def _filter_by_date(items: list[dict], cutoff: str) -> list[dict]:
    """组装按文书日期过滤：条目日期 <= 文书日期。"""
    if not cutoff:
        return items
    out = []
    for it in items:
        d = str(it.get("日期", "") or it.get("开始日期", ""))[:10]
        if not d or d <= cutoff:
            out.append(it)
    return out


def _timeline_block(st: Storage, pid: str, vid: str, cutoff: str, recent_labs: int) -> str:
    lines = []
    for kind in DATED_KINDS:
        items = _filter_by_date(st.list_items(pid, vid, kind), cutoff)
        if kind == "labs":
            # 异常优先 + 最近 N 条
            items = sorted(items, key=lambda x: (x.get("异常标志", "") == "", str(x.get("日期", ""))), reverse=False)
            items = items[-recent_labs:]
        if not items:
            continue
        lines.append(f"-- {KIND_LABEL[kind]} --")
        for it in items:
            if kind == "labs":
                lines.append(f"{_fmt_ymd(it.get('日期'))} {it.get('项目','')} {it.get('结果','')} {it.get('单位','')} "
                             f"{it.get('异常标志','')} 参考 {it.get('参考范围','')}" + ("" if it.get("置信度", 1.0) >= 0.9 else "（低置信度，待确认）"))
            else:
                lines.append(f"{_fmt_ymd(it.get('日期'))} {it.get('类型','')}: {str(it.get('检查所见',''))[:120]} / 意见: {str(it.get('诊断意见',''))[:120]}")
    # 用药
    meds = _filter_by_date(st.list_items(pid, vid, "meds"), cutoff)
    if meds:
        lines.append("-- 用药 --")
        for m in meds:
            status = m.get("状态", "在用")
            lines.append(f"{m.get('药品','')} {m.get('剂型','')} {m.get('剂量','')} {m.get('频次','')} {m.get('途径','')} "
                         f"[{status}] {_fmt_ymd(m.get('开始日期'))}~{_fmt_ymd(m.get('结束日期'))}")
    return "\n".join(lines)


def _prior_docs_block(st: Storage, pid: str, vid: str, cutoff: str, recent_full: int) -> str:
    docs = [d for d in st.list_documents(pid, vid)
            if d.get("status") == "已确认" and (not cutoff or str(d.get("doc_date", ""))[:10] <= cutoff)]
    if not docs:
        return "（无此前已确认文书）"
    lines = []
    full = docs[-recent_full:]
    older = docs[:-recent_full]
    if older:
        lines.append("-- 更早文书摘要 --")
        for d in older:
            lines.append(f"{d.get('doc_date','')}《{d.get('doc_type','')}》: {str(d.get('summary',''))[:100]}")
    lines.append("-- 最近文书全文 --")
    for d in full:
        lines.append(f"《{d.get('doc_type','')}》({d.get('doc_date','')}):\n{d.get('content','')[:4000]}")
    return "\n".join(lines)


def _materials_block(st: Storage, pid: str, vid: str, material_ids: Optional[list[str]]) -> str:
    if not material_ids:
        return ""
    ids = set(material_ids)
    lines = []
    for m in st.list_materials(pid, vid):
        if m.get("material_id") in ids:
            lines.append(f"材料《{m.get('文件名','')}》: {str(m.get('解析结果',''))[:800]}")
    return "\n".join(lines)


def _examples_block(st: Storage, code: str, max_examples: int) -> str:
    examples = [e for e in st.list_examples(code) if e.get("is_active") and e.get("anonymized")]
    if not examples:
        return ""
    lines = []
    for e in examples[:max_examples]:
        lines.append(f"--- 示例（仅供格式与文风参考）---\n{e.get('content','')[:3000]}")
    return "\n".join(lines)


def assemble_draft_messages(st: Storage, pid: str, vid: str, doc_type: str,
                            doc_date: str, extra_fields: dict, material_ids: Optional[list[str]] = None,
                            registry_entry: Optional[dict] = None,
                            vitals: Optional[dict] = None) -> tuple[list[dict], str]:
    """返回 (messages, prompt_version)。prompt_version = 注册表版本 + 模板/示例签名。"""
    reg = registry_entry or next((r for r in st.load_registry() if r.get("code") == doc_type), None)
    if reg is None:
        raise ValueError(f"未注册的文书类型: {doc_type}")
    prompt_file = reg.get("prompt_file", f"{doc_type}.md")
    task = _load_prompt(prompt_file)

    patient = st.get_patient(pid) or {}
    visit = st.get_visit(pid, vid) or {}
    template = st.read_template(doc_type)
    examples = _examples_block(st, doc_type, config.MAX_EXAMPLES)
    timeline = _timeline_block(st, pid, vid, doc_date, config.RECENT_LABS)
    prior = _prior_docs_block(st, pid, vid, doc_date, config.RECENT_DOCS_FULL)
    materials = _materials_block(st, pid, vid, material_ids)

    extra = "\n".join(f"{k}: {v}" for k, v in (extra_fields or {}).items())
    vitals_line = "  ".join(f"{k}: {v}" for k, v in (vitals or {}).items() if v)

    blocks = []
    if template:
        blocks.append(f"【格式模板】\n{template}")
    if examples:
        blocks.append(f"【示例】\n{examples}")
    blocks.append(
        f"【患者资料】\n"
        f"脱敏编号: {patient.get('脱敏编号','')} | 性别: {patient.get('性别','资料未提供')} | "
        f"年龄: {patient.get('年龄','资料未提供')} | 体重: {patient.get('体重','资料未提供')}kg\n"
        f"过敏史: {patient.get('过敏史','资料未提供')}\n既往史: {patient.get('既往史','资料未提供')}\n"
        f"家族史: {patient.get('家族史','资料未提供')}\n"
        f"住院号: {visit.get('住院号','')} | 入院日期: {visit.get('入院日期','')} | 状态: {visit.get('状态','')}\n"
        f"主诉: {visit.get('主诉','资料未提供')}\n现病史: {visit.get('现病史','资料未提供')}\n"
        f"体格检查: {visit.get('体格检查','资料未提供')}\n"
        f"入院诊断: {visit.get('入院诊断','资料未提供')}\n出院诊断: {visit.get('出院诊断','资料未提供')}"
    )
    if vitals_line:
        blocks.append(f"【生命体征】\n{vitals_line}")
    blocks.append(f"【时间线资料】（截至 {doc_date or '全部'}）\n{timeline or '（无）'}")
    blocks.append(f"【此前已确认文书】\n{prior}")
    if materials:
        blocks.append(f"【本文书挂载材料】\n{materials}")
    if extra:
        blocks.append(f"【医生补充要素】\n{extra}")

    user = "\n\n".join(blocks) + f"\n\n{task}"
    prompt_version = f"{prompt_file}@{_sig_of(st, doc_type)}"
    return [{"role": "system", "content": _load_prompt("system_base.md")},
            {"role": "user", "content": user}], prompt_version


def _sig_of(st: Storage, code: str) -> str:
    """模板/示例签名，用于 prompt_version 记录与回溯。"""
    import hashlib
    h = hashlib.md5()
    h.update(st.read_template(code).encode("utf-8"))
    for e in st.list_examples(code):
        h.update((e.get("example_id", "") + str(e.get("is_active"))).encode("utf-8"))
    return h.hexdigest()[:8]


def assemble_refine_messages(st: Storage, pid: str, vid: str, doc_id: str,
                             message: str, material_ids: Optional[list[str]] = None) -> list[dict]:
    """对话修订上下文：模板 + 当前全文 + 会话历史 + 新材料 + 轻量时间线。"""
    doc = st.get_document(pid, vid, doc_id)
    if doc is None:
        raise ValueError("文书不存在")
    doc_type = doc.get("doc_type", "")
    template = st.read_template(doc_type)
    current = doc.get("content", "")
    chat = st.list_chat(pid, vid, doc_id)[-config.MAX_CHAT_HISTORY * 2:]  # 最近 K 轮（user+assistant）
    materials = _materials_block(st, pid, vid, material_ids)
    timeline = _timeline_block(st, pid, vid, doc.get("doc_date", ""), config.RECENT_LABS)

    blocks = []
    if template:
        blocks.append(f"【格式模板】\n{template}")
    blocks.append(f"【当前文书全文】\n{current}")
    blocks.append(f"【时间线资料】\n{timeline or '（无）'}")
    if materials:
        blocks.append(f"【补充材料】\n{materials}")
    blocks.append(f"【修改指令】{message}")

    msgs = [{"role": "system", "content": _load_prompt("chat_refine.md")}]
    for m in chat:
        msgs.append({"role": m.get("role", "user"), "content": str(m.get("content", ""))[:2000]})
    msgs.append({"role": "user", "content": "\n\n".join(blocks)})
    return msgs


def assemble_plan_messages(st: Storage, pid: str, vid: str, cutoff: str = "") -> list[dict]:
    """诊疗计划：患者 + 时间线 + care_plan 指令（JSON 输出）。"""
    patient = st.get_patient(pid) or {}
    visit = st.get_visit(pid, vid) or {}
    timeline = _timeline_block(st, pid, vid, cutoff, config.RECENT_LABS)
    prior = _prior_docs_block(st, pid, vid, cutoff, config.RECENT_DOCS_FULL)
    user = (
        f"【患者资料】\n脱敏编号: {patient.get('脱敏编号','')} | 性别: {patient.get('性别','资料未提供')} | "
        f"年龄: {patient.get('年龄','资料未提供')} | 过敏史: {patient.get('过敏史','资料未提供')}\n"
        f"主诉: {visit.get('主诉','资料未提供')}\n现病史: {visit.get('现病史','资料未提供')}\n"
        f"入院诊断: {visit.get('入院诊断','资料未提供')}\n出院诊断: {visit.get('出院诊断','资料未提供')}\n\n"
        f"【时间线资料】\n{timeline or '（无）'}\n\n"
        f"【此前已确认文书】\n{prior}\n\n"
        f"{_load_prompt('care_plan.md')}"
    )
    return [{"role": "system", "content": _load_prompt("system_base.md")},
            {"role": "user", "content": user}]


def assemble_review_messages(st: Storage, pid: str, vid: str, cutoff: str = "") -> list[dict]:
    """辅助检查解读：时间线 + labs_review 指令。"""
    timeline = _timeline_block(st, pid, vid, cutoff, config.RECENT_LABS)
    user = (f"【时间线资料】\n{timeline or '（无）'}\n\n{_load_prompt('labs_review.md')}")
    return [{"role": "system", "content": _load_prompt("system_base.md")},
            {"role": "user", "content": user}]
