"""模板（文书类型/病种 多维）与示例管理 + 典型病例库 + 脱敏辅助。"""
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


class VariantIn(BaseModel):
    病种: str = "通用"
    text: str = ""


class CaseIn(BaseModel):
    科室: str = ""
    病种: str = ""
    标题: str = ""
    内容: str = ""


class PathwayIn(BaseModel):
    病种: str = ""
    科室: str = ""
    内容: str = ""


class ShortcutsIn(BaseModel):
    诊断: list[str] = []


# ---------------- 模板（多维：文书类型 / 病种 / 模板 + 示例） ----------------
@router.get("/templates")
def list_templates():
    out = []
    for reg in storage.load_registry():
        variants = []
        for v in storage.list_template_variants(reg["code"]):
            variants.append({
                "病种": v,
                "template": storage.read_template(reg["code"], v),
                "examples": storage.list_examples(reg["code"], v),
            })
        if not variants:
            variants.append({"病种": "通用", "template": "", "examples": []})
        out.append({**reg, "variants": variants})
    return out


@router.put("/templates/{code}/variants/{variant}")
def save_template(code: str, variant: str, data: TemplateIn):
    storage.write_template(code, data.text, variant)
    return {"ok": True, "code": code, "variant": variant}


@router.get("/templates/{code}/variants")
def list_variants(code: str):
    return storage.list_template_variants(code)


@router.post("/templates/{code}/variants/{variant}/examples")
def add_example(code: str, variant: str, data: ExampleIn):
    return storage.add_example(code, data.content, data.source, data.anonymized, variant)


@router.post("/templates/{code}/variants/{variant}/examples/{ex_id}/active")
def set_active(code: str, variant: str, ex_id: str, data: ActiveIn):
    rec = storage.set_example_active(code, ex_id, data.active, variant)
    if rec is None:
        raise HTTPException(404, "示例不存在")
    if data.active and not rec.get("anonymized"):
        raise HTTPException(400, "未脱敏示例禁止启用，请先脱敏并人工复核")
    return rec


# ---------------- 典型病例库（科室 / 病种 / 病例） ----------------
@router.get("/cases")
def list_cases():
    return storage.list_cases()


@router.post("/cases")
def create_case(data: CaseIn):
    if not data.标题.strip():
        raise HTTPException(400, "标题不能为空")
    return storage.create_case(data.科室, data.病种, data.标题, data.内容)


@router.get("/cases/{case_id}")
def get_case(case_id: str):
    c = storage.get_case(case_id)
    if not c:
        raise HTTPException(404, "病例不存在")
    return c


@router.put("/cases/{case_id}")
def update_case(case_id: str, data: CaseIn):
    rec = storage.update_case(case_id, data.model_dump())
    if not rec:
        raise HTTPException(404, "病例不存在")
    return rec


@router.delete("/cases/{case_id}")
def delete_case(case_id: str):
    if not storage.delete_case(case_id):
        raise HTTPException(404, "病例不存在")
    return {"ok": True}


# ---------------- 临床路径 ----------------
@router.get("/pathways")
def list_pathways():
    return storage.list_pathways()


@router.post("/pathways")
def create_pathway(data: PathwayIn):
    if not data.病种.strip():
        raise HTTPException(400, "病种不能为空")
    return storage.create_pathway(data.病种, data.科室, data.内容)


@router.get("/pathways/{pathway_id}")
def get_pathway(pathway_id: str):
    p = storage.get_pathway(pathway_id)
    if not p:
        raise HTTPException(404, "路径不存在")
    return p


@router.put("/pathways/{pathway_id}")
def update_pathway(pathway_id: str, data: PathwayIn):
    rec = storage.update_pathway(pathway_id, data.model_dump())
    if not rec:
        raise HTTPException(404, "路径不存在")
    return rec


@router.delete("/pathways/{pathway_id}")
def delete_pathway(pathway_id: str):
    if not storage.delete_pathway(pathway_id):
        raise HTTPException(404, "路径不存在")
    return {"ok": True}


# ---------------- 诊断快捷键 ----------------
@router.get("/shortcuts")
def get_shortcuts():
    return storage.get_shortcuts()


@router.put("/shortcuts")
def save_shortcuts(data: ShortcutsIn):
    return storage.save_shortcuts(data.诊断)


# ---------------- 脱敏辅助 ----------------
@router.post("/anon/detect")
def anon_detect(data: TextIn):
    return detect(data.text)


@router.post("/anon/replace")
def anon_replace(data: TextIn):
    return anonymize(data.text)
