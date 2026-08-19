"""文书：生成 / 人工编辑 / 修订历史 / 回退 / 确认 / 对话修订(SSE) / 导出。"""
import json
from datetime import date

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from .. import config
from ..consistency import check_consistency
from ..docx_export import export_docx
from ..llm import complete
from ..models import ChatRequest, GenerateRequest
from ..prompts import assemble_draft_messages, assemble_refine_messages
from ..storage import storage

router = APIRouter(prefix="/api/patients/{pid}/visits/{vid}/documents", tags=["documents"])


def _get_doc_or_404(pid: str, vid: str, doc_id: str):
    doc = storage.get_document(pid, vid, doc_id)
    if doc is None:
        raise HTTPException(404, "文书不存在")
    return doc


@router.get("")
def list_documents(pid: str, vid: str):
    return storage.list_documents(pid, vid)


@router.post("/generate")
def generate(pid: str, vid: str, req: GenerateRequest):
    doc_date = req.doc_date or date.today().isoformat()
    messages, prompt_version = assemble_draft_messages(
        storage, pid, vid, req.doc_type, doc_date, req.extra_fields, req.material_ids)
    text = complete(messages, config.TEMP_DRAFT)
    doc = storage.create_document(pid, vid, req.doc_type, doc_date, text,
                                  prompt_version=prompt_version, extra=req.extra_fields)
    labs = storage.list_items(pid, vid, "labs")
    warnings = check_consistency(text, labs)
    return {"document": doc, "warnings": warnings, "prompt_version": prompt_version}


@router.get("/{doc_id}")
def get_document(pid: str, vid: str, doc_id: str):
    return _get_doc_or_404(pid, vid, doc_id)


@router.put("/{doc_id}/content")
def edit_content(pid: str, vid: str, doc_id: str, body: dict):
    content = body.get("content", "")
    _get_doc_or_404(pid, vid, doc_id)
    storage.save_revision(pid, vid, doc_id, content, reason="人工编辑")
    return storage.get_document(pid, vid, doc_id)


@router.get("/{doc_id}/revisions")
def list_revisions(pid: str, vid: str, doc_id: str):
    _get_doc_or_404(pid, vid, doc_id)
    return storage.list_revisions(pid, vid, doc_id)


@router.get("/{doc_id}/revisions/{rev}")
def get_revision(pid: str, vid: str, doc_id: str, rev: str):
    _get_doc_or_404(pid, vid, doc_id)
    content = storage.get_revision(pid, vid, doc_id, rev)
    if content is None:
        raise HTTPException(404, "修订版本不存在")
    return {"revision": rev, "content": content}


@router.post("/{doc_id}/revert")
def revert(pid: str, vid: str, doc_id: str, body: dict):
    _get_doc_or_404(pid, vid, doc_id)
    rev = body.get("revision", "")
    no = storage.revert_revision(pid, vid, doc_id, rev)
    if no is None:
        raise HTTPException(404, "修订版本不存在")
    return storage.get_document(pid, vid, doc_id)


@router.post("/{doc_id}/confirm")
def confirm(pid: str, vid: str, doc_id: str):
    doc = _get_doc_or_404(pid, vid, doc_id)
    summary = ""
    try:
        summary = (complete(
            [{"role": "user", "content": f"请用2-3句话概括以下文书的核心内容（患者、诊断、关键处理）：\n{doc.get('content','')[:3000]}"}],
            config.TEMP_SUMMARY, max_tokens=120) or "").strip()
    except Exception as e:
        print(f"[confirm] 摘要生成失败（忽略）: {e}")
    storage.confirm_document(pid, vid, doc_id, summary)
    return storage.get_document(pid, vid, doc_id)


@router.post("/{doc_id}/chat")
async def chat(pid: str, vid: str, doc_id: str, req: ChatRequest):
    doc = _get_doc_or_404(pid, vid, doc_id)
    messages = assemble_refine_messages(storage, pid, vid, doc_id, req.message, req.material_ids)
    storage.append_chat(pid, vid, doc_id, "user", req.message, req.material_ids)
    gen = complete(messages, config.TEMP_DRAFT, stream=True)

    def event_stream():
        collected: list[str] = []
        yield f"data: {json.dumps({'event': 'start', 'doc_id': doc_id}, ensure_ascii=False)}\n\n"
        for delta in gen:
            collected.append(delta)
            yield f"data: {json.dumps({'event': 'delta', 'text': delta}, ensure_ascii=False)}\n\n"
        full = "".join(collected)
        rev = storage.save_revision(pid, vid, doc_id, full, reason="对话")
        storage.append_chat(pid, vid, doc_id, "assistant", full, revision=f"r{rev}")
        yield f"data: {json.dumps({'event': 'done', 'revision': f'r{rev}'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/{doc_id}/export")
def export(pid: str, vid: str, doc_id: str):
    doc = _get_doc_or_404(pid, vid, doc_id)
    reg = {r.get("code"): r.get("name", doc_id) for r in storage.load_registry()}
    title = f"{reg.get(doc.get('doc_type'), doc.get('doc_type'))}（{doc.get('doc_date', '')}）"
    buf = export_docx(title, doc.get("content", ""))
    from urllib.parse import quote
    from fastapi.responses import Response
    filename = f"{title}.docx"
    # RFC 5987：中文文件名用 filename* 编码，避免 latin-1 报错
    disposition = f"attachment; filename=\"document.docx\"; filename*=UTF-8''{quote(filename)}"
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": disposition},
    )
