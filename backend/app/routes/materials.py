"""资料库：检验/影像/内镜/用药条目 + 材料（结构化数据入库）。"""
from fastapi import APIRouter, HTTPException

from ..models import LabItem, ResultItem, MedItem, MaterialIn
from ..storage import storage, KINDS

router = APIRouter(prefix="/api/patients/{pid}/visits/{vid}", tags=["materials"])

KIND_MODEL = {"labs": LabItem, "imaging": ResultItem, "endoscopy": ResultItem, "meds": MedItem}


@router.get("/items/{kind}")
def list_items(pid: str, vid: str, kind: str):
    if kind not in KINDS:
        raise HTTPException(400, f"kind 必须是 {KINDS}")
    return storage.list_items(pid, vid, kind)


@router.post("/items/{kind}")
def add_item(pid: str, vid: str, kind: str, data: LabItem | ResultItem | MedItem):
    if kind not in KIND_MODEL:
        raise HTTPException(400, f"kind 必须是 {list(KIND_MODEL)}")
    if not isinstance(data, KIND_MODEL[kind]):
        data = KIND_MODEL[kind](**data.model_dump())
    return storage.add_item(pid, vid, kind, data.model_dump())


@router.put("/items/{kind}/{item_id}")
def update_item(pid: str, vid: str, kind: str, item_id: str, data: LabItem | ResultItem | MedItem):
    if kind not in KIND_MODEL:
        raise HTTPException(400, f"kind 必须是 {list(KIND_MODEL)}")
    rec = storage.update_item(pid, vid, kind, item_id, data.model_dump())
    if rec is None:
        raise HTTPException(404, "条目不存在")
    return rec


@router.delete("/items/{kind}/{item_id}")
def delete_item(pid: str, vid: str, kind: str, item_id: str):
    ok = storage.delete_item(pid, vid, kind, item_id)
    if not ok:
        raise HTTPException(404, "条目不存在")
    return {"ok": True}


# ---------------- 材料 ----------------
@router.get("/materials")
def list_materials(pid: str, vid: str):
    return storage.list_materials(pid, vid)


@router.post("/materials")
def add_material(pid: str, vid: str, data: MaterialIn):
    parsed = data.解析结果 or None
    return storage.add_material(pid, vid, data.model_dump(), parsed)
