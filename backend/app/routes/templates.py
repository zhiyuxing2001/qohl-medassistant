"""模板与示例管理 + 脱敏辅助。"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..anon import anonymize, detect
from ..models import ExampleIn, TemplateIn
from ..storage import storage

router = APIRouter(prefix="/api", tags=["templates"])


class ActiveIn(BaseModel):
    active: bool


class TextIn(BaseModel):
    text: str


@router.get("/templates")
def list_templates():
    out = []
    for reg in storage.load_registry():
        out.append({
            **reg,
            "template": storage.read_template(reg["code"]),
            "examples": storage.list_examples(reg["code"]),
        })
    return out


@router.put("/templates/{code}/template")
def save_template(code: str, data: TemplateIn):
    storage.write_template(code, data.text)
    return {"ok": True, "code": code}


@router.post("/templates/{code}/examples")
def add_example(code: str, data: ExampleIn):
    return storage.add_example(code, data.content, data.source, data.anonymized)


@router.post("/templates/{code}/examples/{ex_id}/active")
def set_active(code: str, ex_id: str, data: ActiveIn):
    rec = storage.set_example_active(code, ex_id, data.active)
    if rec is None:
        raise HTTPException(404, "示例不存在")
    if data.active and not rec.get("anonymized"):
        raise HTTPException(400, "未脱敏示例禁止启用，请先脱敏并人工复核")
    return rec


# ---------------- 脱敏辅助 ----------------
@router.post("/anon/detect")
def anon_detect(data: TextIn):
    return detect(data.text)


@router.post("/anon/replace")
def anon_replace(data: TextIn):
    return anonymize(data.text)
