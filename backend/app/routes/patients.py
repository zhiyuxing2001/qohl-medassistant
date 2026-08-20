"""患者与住院 CRUD + 统一时间线。"""
from fastapi import APIRouter, HTTPException

from ..models import PatientIn, VisitIn
from ..storage import storage

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("")
def list_patients():
    return storage.list_patients()


@router.post("")
def create_patient(data: PatientIn):
    return storage.create_patient(data.model_dump())


@router.get("/{pid}")
def get_patient(pid: str):
    p = storage.get_patient(pid)
    if not p:
        raise HTTPException(404, "患者不存在")
    return p


@router.put("/{pid}")
def update_patient(pid: str, data: PatientIn):
    p = storage.get_patient(pid)
    if not p:
        raise HTTPException(404, "患者不存在")
    return storage.save_patient(pid, {**p, **data.model_dump()})


@router.delete("/{pid}")
def delete_patient(pid: str):
    storage.delete_patient(pid)
    return {"ok": True}


# ---------------- 住院 ----------------
@router.get("/{pid}/visits")
def list_visits(pid: str):
    return storage.list_visits(pid)


@router.post("/{pid}/visits")
def create_visit(pid: str, data: VisitIn):
    return storage.create_visit(pid, data.model_dump())


@router.get("/{pid}/visits/{vid}")
def get_visit(pid: str, vid: str):
    v = storage.get_visit(pid, vid)
    if not v:
        raise HTTPException(404, "住院记录不存在")
    return v


@router.put("/{pid}/visits/{vid}")
def update_visit(pid: str, vid: str, data: VisitIn):
    v = storage.get_visit(pid, vid)
    if not v:
        raise HTTPException(404, "住院记录不存在")
    return storage.save_visit(pid, vid, {**v, **data.model_dump()})


@router.delete("/{pid}/visits/{vid}")
def delete_visit(pid: str, vid: str):
    storage.delete_visit(pid, vid)
    return {"ok": True}


# ---------------- 统一时间线 ----------------
@router.get("/{pid}/visits/{vid}/timeline")
def timeline(pid: str, vid: str):
    items = []
    for kind in ("labs", "imaging", "endoscopy", "meds"):
        for it in storage.list_items(pid, vid, kind):
            items.append({
                "date": it.get("日期") or it.get("开始日期") or "",
                "kind": kind,
                "item": it,
            })
    for d in storage.list_documents(pid, vid):
        items.append({"date": d.get("doc_date", ""), "kind": "document", "item": d})
    items.sort(key=lambda x: str(x["date"]))
    return items


# ---------------- 完整病历导出 ----------------
@router.get("/{pid}/visits/{vid}/export-all")
def export_all(pid: str, vid: str):
    from urllib.parse import quote
    from fastapi.responses import Response

    from ..docx_export import export_all_docx

    patient = storage.get_patient(pid)
    visit = storage.get_visit(pid, vid)
    if not patient or not visit:
        raise HTTPException(404, "患者或住院记录不存在")
    docs = [d for d in storage.list_documents(pid, vid) if d.get("status") == "已确认"]
    type_names = {r.get("code"): r.get("name") for r in storage.load_registry()}
    buf = export_all_docx(patient, visit, docs, type_names)
    filename = f"完整病历_{patient.get('姓名','') or patient.get('脱敏编号','') or pid}.docx"
    disposition = f"attachment; filename=\"record.docx\"; filename*=UTF-8''{quote(filename)}"
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": disposition},
    )
