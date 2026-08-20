"""诊疗计划（guided_json 结构化输出）+ 自由对话（visit 级会话）。"""
import json

from fastapi import APIRouter, HTTPException

from .. import config
from ..llm import CARE_PLAN_SCHEMA, complete
from ..prompts import assemble_plan_messages, assemble_review_messages
from ..storage import storage

router = APIRouter(prefix="/api/patients/{pid}/visits/{vid}", tags=["suggestions"])


# ---------------- 诊疗计划 ----------------
@router.get("/suggestions")
def list_suggestions(pid: str, vid: str):
    return storage.list_suggestions(pid, vid)


@router.post("/suggestions/plan")
def plan(pid: str, vid: str):
    visit = storage.get_visit(pid, vid) or {}
    diagnosis = f"{visit.get('入院诊断','')} {visit.get('主诉','')}".strip()
    pathway = storage.match_pathway(diagnosis) if diagnosis else None
    pathway_text = pathway.get("内容", "") if pathway else None
    messages = assemble_plan_messages(storage, pid, vid, pathway_text=pathway_text)
    text = complete(messages, config.TEMP_PLAN, json_schema=CARE_PLAN_SCHEMA)
    try:
        data = json.loads(text)
    except Exception:
        raise HTTPException(502, f"模型输出非法 JSON（已触发重试机制，请重试）: {text[:200]}")
    return storage.add_suggestion(pid, vid, {"type": "诊疗计划", "content": data})


@router.post("/suggestions/{sid}/status")
def set_status(pid: str, vid: str, sid: str, body: dict):
    rec = storage.set_suggestion_status(pid, vid, sid, body.get("status", "待采纳"))
    if rec is None:
        raise HTTPException(404, "计划不存在")
    return rec


# ---------------- 辅助检查解读 ----------------
@router.post("/labs/review")
def labs_review(pid: str, vid: str):
    messages = assemble_review_messages(storage, pid, vid)
    text = complete(messages, config.TEMP_DRAFT)
    return {"review": text}


# ---------------- 自由对话（visit 级，chatbot-ui 兼容） ----------------
@router.get("/chats")
def list_chats(pid: str, vid: str):
    return storage.list_chats(pid, vid)


@router.post("/chats")
def save_chat(pid: str, vid: str, body: dict):
    chat_id = body.get("chat_id") or storage._new_id()
    return storage.save_chat(vid, chat_id, {
        "chat_id": chat_id,
        "title": body.get("title", ""),
        "messages": body.get("messages", []),
        "updated_at": storage._now(),
    })
