"""文件夹 + JSON 存储层（无数据库）。

目录结构即数据模型：
  data/
    registry/document_types.json        # 文书类型注册表
    templates/{code}/template.md        # 空白模板
    templates/{code}/examples/          # 脱敏示例（.md + .json 元数据）
    chats/{visit_id}/                   # 自由对话（chatbot-ui 兼容）
    patients/{pid}/patient.json
    patients/{pid}/visits/{vid}/
      visit.json  labs/ imaging/ endoscopy/ meds/ materials/
      documents/{doc_id}/ doc.json content.md revisions/ chat.json
      suggestions/

原则：
- 原子写：临时文件 + os.replace，断电不产生半截文件；
- JSON 读取失败返回默认值并告警（损坏项跳过）；
- 单用户低并发，不做复杂锁。
"""
from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from .config import DATA_DIR

KINDS = ("labs", "imaging", "endoscopy", "meds")
KIND_LABEL = {"labs": "检验", "imaging": "影像", "endoscopy": "内镜", "meds": "用药"}


# ---------------------------------------------------------------- 工具
def _safe_name(s: str) -> str:
    return re.sub(r"[^\w\u4e00-\u9fff.-]", "_", str(s)).strip("._") or "item"


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _ts() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def _atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def _read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:  # 损坏项跳过并告警
        print(f"[storage] 警告: JSON 读取失败 {path}: {e}")
        return default


def _write_json(path: Path, data: Any) -> None:
    _atomic_write(path, json.dumps(data, ensure_ascii=False, indent=2))


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


# ---------------------------------------------------------------- 存储类
class Storage:
    def __init__(self, data_dir: Path = DATA_DIR):
        self.root = Path(data_dir)
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "registry").mkdir(exist_ok=True)
        (self.root / "templates").mkdir(exist_ok=True)
        (self.root / "chats").mkdir(exist_ok=True)

    # ---------------- 路径 ---------------- 
    def _patient_dir(self, pid: str) -> Path:
        return self.root / "patients" / _safe_name(pid)

    def _visit_dir(self, pid: str, vid: str) -> Path:
        return self._patient_dir(pid) / "visits" / _safe_name(vid)

    def _doc_dir(self, pid: str, vid: str, doc_id: str) -> Path:
        return self._visit_dir(pid, vid) / "documents" / _safe_name(doc_id)

    # ---------------- 患者 ---------------- 
    def list_patients(self) -> list[dict]:
        out = []
        base = self.root / "patients"
        if base.exists():
            for d in sorted(base.iterdir()):
                if d.is_dir():
                    p = self.get_patient(d.name)
                    if p:
                        out.append(p)
        return out

    def get_patient(self, pid: str) -> Optional[dict]:
        p = _read_json(self._patient_dir(pid) / "patient.json")
        if p is None:
            return None
        p.setdefault("patient_id", pid)
        return p

    def create_patient(self, data: dict) -> dict:
        pid = _new_id()
        self.save_patient(pid, data)
        return self.get_patient(pid)

    def save_patient(self, pid: str, data: dict) -> dict:
        rec = dict(data)
        rec["patient_id"] = pid
        rec.setdefault("created_at", _now())
        rec["updated_at"] = _now()
        _write_json(self._patient_dir(pid) / "patient.json", rec)
        return rec

    def delete_patient(self, pid: str) -> None:
        import shutil
        d = self._patient_dir(pid)
        if d.exists():
            shutil.rmtree(d)

    # ---------------- 住院 ---------------- 
    def list_visits(self, pid: str) -> list[dict]:
        out = []
        base = self._patient_dir(pid) / "visits"
        if base.exists():
            for d in sorted(base.iterdir()):
                if d.is_dir():
                    v = self.get_visit(pid, d.name)
                    if v:
                        out.append(v)
        return out

    def get_visit(self, pid: str, vid: str) -> Optional[dict]:
        v = _read_json(self._visit_dir(pid, vid) / "visit.json")
        if v is None:
            return None
        v.setdefault("visit_id", vid)
        return v

    def create_visit(self, pid: str, data: dict) -> dict:
        vid = _new_id()
        self.save_visit(pid, vid, data)
        return self.get_visit(pid, vid)

    def save_visit(self, pid: str, vid: str, data: dict) -> dict:
        rec = dict(data)
        rec["visit_id"] = vid
        rec.setdefault("created_at", _now())
        rec["updated_at"] = _now()
        _write_json(self._visit_dir(pid, vid) / "visit.json", rec)
        return rec

    def delete_visit(self, pid: str, vid: str) -> None:
        import shutil
        d = self._visit_dir(pid, vid)
        if d.exists():
            shutil.rmtree(d)

    # ---------------- 时间线条目（检验/影像/内镜/用药） ----------------
    def list_items(self, pid: str, vid: str, kind: str) -> list[dict]:
        assert kind in KINDS, f"kind 必须是 {KINDS}"
        out = []
        base = self._visit_dir(pid, vid) / kind
        if base.exists():
            for f in sorted(base.glob("*.json")):
                it = _read_json(f)
                if it is not None:
                    it.setdefault("item_id", f.stem)
                    out.append(it)
        out.sort(key=lambda x: (str(x.get("日期", "")), str(x.get("开始日期", ""))))
        return out

    def add_item(self, pid: str, vid: str, kind: str, item: dict) -> dict:
        assert kind in KINDS
        item_id = f"{_ts()}_{_new_id()}"
        rec = dict(item)
        rec["item_id"] = item_id
        rec.setdefault("created_at", _now())
        _write_json(self._visit_dir(pid, vid) / kind / f"{item_id}.json", rec)
        return rec

    def update_item(self, pid: str, vid: str, kind: str, item_id: str, item: dict) -> Optional[dict]:
        path = self._visit_dir(pid, vid) / kind / f"{_safe_name(item_id)}.json"
        old = _read_json(path)
        if old is None:
            return None
        rec = {**old, **dict(item)}
        rec["item_id"] = item_id
        rec["updated_at"] = _now()
        _write_json(path, rec)
        return rec

    def delete_item(self, pid: str, vid: str, kind: str, item_id: str) -> bool:
        path = self._visit_dir(pid, vid) / kind / f"{_safe_name(item_id)}.json"
        if path.exists():
            path.unlink()
            return True
        return False

    # ---------------- 材料（仅存结构化数据与指针；原件留在 Mac） ----------------
    def list_materials(self, pid: str, vid: str) -> list[dict]:
        out = []
        base = self._visit_dir(pid, vid) / "materials"
        if base.exists():
            for f in sorted(base.glob("*.json")):
                if f.name.endswith("_parsed.json"):
                    continue
                it = _read_json(f)
                if it is not None:
                    out.append(it)
        return out

    def add_material(self, pid: str, vid: str, meta: dict, parsed: Optional[dict] = None) -> dict:
        mid = f"{_ts()}_{_new_id()}"
        rec = dict(meta)
        rec["material_id"] = mid
        rec.setdefault("created_at", _now())
        _write_json(self._visit_dir(pid, vid) / "materials" / f"{mid}.json", rec)
        if parsed is not None:
            _write_json(self._visit_dir(pid, vid) / "materials" / f"{mid}_parsed.json", parsed)
        return rec

    # ---------------- 文书 ---------------- 
    def list_documents(self, pid: str, vid: str) -> list[dict]:
        out = []
        base = self._visit_dir(pid, vid) / "documents"
        if base.exists():
            for d in sorted(base.iterdir()):
                if d.is_dir():
                    doc = _read_json(d / "doc.json")
                    if doc is not None:
                        doc.setdefault("doc_id", d.name)
                        content_path = d / "content.md"
                        if content_path.exists():
                            doc["preview"] = content_path.read_text(encoding="utf-8")[:60]
                        out.append(doc)
        out.sort(key=lambda x: str(x.get("doc_date", "")))
        return out

    def get_document(self, pid: str, vid: str, doc_id: str) -> Optional[dict]:
        doc = _read_json(self._doc_dir(pid, vid, doc_id) / "doc.json")
        if doc is None:
            return None
        doc["doc_id"] = doc_id
        cp = self._doc_dir(pid, vid, doc_id) / "content.md"
        doc["content"] = cp.read_text(encoding="utf-8") if cp.exists() else ""
        return doc

    def create_document(self, pid: str, vid: str, doc_type: str, doc_date: str,
                        content: str, prompt_version: str = "", extra: Optional[dict] = None,
                        vitals: Optional[dict] = None) -> dict:
        doc_id = _new_id()
        d = self._doc_dir(pid, vid, doc_id)
        doc = {
            "doc_id": doc_id,
            "doc_type": doc_type,
            "doc_date": doc_date,
            "status": "草稿",
            "summary": "",
            "prompt_version": prompt_version,
            "extra": extra or {},
            "vitals": vitals or {},
            "created_at": _now(),
            "updated_at": _now(),
        }
        _write_json(d / "doc.json", doc)
        self._write_revision(pid, vid, doc_id, content, reason="生成", revision_no=1)
        return self.get_document(pid, vid, doc_id)

    def update_document_vitals(self, pid: str, vid: str, doc_id: str, vitals: dict) -> Optional[dict]:
        d = self._doc_dir(pid, vid, doc_id)
        doc = _read_json(d / "doc.json")
        if doc is None:
            return None
        doc["vitals"] = vitals or {}
        doc["updated_at"] = _now()
        _write_json(d / "doc.json", doc)
        return doc

    def _next_revision_no(self, pid: str, vid: str, doc_id: str) -> int:
        rdir = self._doc_dir(pid, vid, doc_id) / "revisions"
        if not rdir.exists():
            return 1
        nums = [int(p.stem[1:]) for p in rdir.glob("r*.md") if p.stem[1:].isdigit()]
        return (max(nums) + 1) if nums else 1

    def _write_revision(self, pid: str, vid: str, doc_id: str, content: str,
                        reason: str, revision_no: Optional[int] = None) -> int:
        d = self._doc_dir(pid, vid, doc_id)
        no = revision_no or self._next_revision_no(pid, vid, doc_id)
        _atomic_write(d / "revisions" / f"r{no}.md", content)
        _atomic_write(d / "content.md", content)
        doc = _read_json(d / "doc.json") or {}
        doc["status"] = "草稿"  # 任何修订都回到草稿态
        doc["updated_at"] = _now()
        _write_json(d / "doc.json", doc)
        return no

    def save_revision(self, pid: str, vid: str, doc_id: str, content: str, reason: str = "对话") -> int:
        return self._write_revision(pid, vid, doc_id, content, reason)

    def confirm_document(self, pid: str, vid: str, doc_id: str, summary: str = "") -> Optional[dict]:
        d = self._doc_dir(pid, vid, doc_id)
        doc = _read_json(d / "doc.json")
        if doc is None:
            return None
        doc["status"] = "已确认"
        doc["summary"] = summary
        doc["confirmed_at"] = _now()
        doc["updated_at"] = _now()
        _write_json(d / "doc.json", doc)
        return doc

    def list_revisions(self, pid: str, vid: str, doc_id: str) -> list[dict]:
        rdir = self._doc_dir(pid, vid, doc_id) / "revisions"
        out = []
        if rdir.exists():
            for f in sorted(rdir.glob("r*.md")):
                out.append({"revision": f.stem, "content": f.read_text(encoding="utf-8")})
        return out

    def get_revision(self, pid: str, vid: str, doc_id: str, rev: str) -> Optional[str]:
        p = self._doc_dir(pid, vid, doc_id) / "revisions" / f"{_safe_name(rev)}.md"
        return p.read_text(encoding="utf-8") if p.exists() else None

    def revert_revision(self, pid: str, vid: str, doc_id: str, rev: str) -> Optional[int]:
        content = self.get_revision(pid, vid, doc_id, rev)
        if content is None:
            return None
        return self._write_revision(pid, vid, doc_id, content, reason=f"回退到{rev}")

    # ---------------- 文书对话线程 ----------------
    def list_chat(self, pid: str, vid: str, doc_id: str) -> list[dict]:
        return _read_json(self._doc_dir(pid, vid, doc_id) / "chat.json", []) or []

    def append_chat(self, pid: str, vid: str, doc_id: str, role: str, content: str,
                    material_ids: Optional[list] = None, revision: str = "") -> dict:
        msgs = self.list_chat(pid, vid, doc_id)
        msg = {
            "role": role,
            "content": content,
            "material_ids": material_ids or [],
            "revision": revision,
            "created_at": _now(),
        }
        msgs.append(msg)
        _write_json(self._doc_dir(pid, vid, doc_id) / "chat.json", msgs)
        return msg

    # ---------------- 诊疗计划 ----------------
    def list_suggestions(self, pid: str, vid: str) -> list[dict]:
        out = []
        base = self._visit_dir(pid, vid) / "suggestions"
        if base.exists():
            for f in sorted(base.glob("*.json")):
                it = _read_json(f)
                if it is not None:
                    out.append(it)
        return out

    def add_suggestion(self, pid: str, vid: str, data: dict) -> dict:
        sid = f"{_ts()}_{_new_id()}"
        rec = dict(data)
        rec["suggestion_id"] = sid
        rec.setdefault("status", "待采纳")
        rec.setdefault("created_at", _now())
        _write_json(self._visit_dir(pid, vid) / "suggestions" / f"{sid}.json", rec)
        return rec

    def set_suggestion_status(self, pid: str, vid: str, sid: str, status: str) -> Optional[dict]:
        path = self._visit_dir(pid, vid) / "suggestions" / f"{_safe_name(sid)}.json"
        rec = _read_json(path)
        if rec is None:
            return None
        rec["status"] = status
        _write_json(path, rec)
        return rec

    # ---------------- 自由对话（visit 级，chatbot-ui 兼容结构） ----------------
    def list_chats(self, pid: str, vid: str) -> list[dict]:
        base = self.root / "chats" / _safe_name(vid)
        out = []
        if base.exists():
            for f in sorted(base.glob("*.json")):
                it = _read_json(f)
                if it is not None:
                    out.append(it)
        return out

    def save_chat(self, vid: str, chat_id: str, data: dict) -> dict:
        path = self.root / "chats" / _safe_name(vid) / f"{_safe_name(chat_id)}.json"
        _write_json(path, data)
        return data

    # ---------------- 注册表与模板示例（多维：文书类型 / 病种 / 模板） ----------------
    def load_registry(self) -> list[dict]:
        reg = _read_json(self.root / "registry" / "document_types.json", []) or []
        if not reg:
            reg = default_registry()
            self.save_registry(reg)
        return reg

    def save_registry(self, reg: list[dict]) -> None:
        _write_json(self.root / "registry" / "document_types.json", reg)

    def _tpl_dir(self, code: str) -> Path:
        return self.root / "templates" / _safe_name(code)

    def _tpl_variant_dir(self, code: str, variant: str = "通用") -> Path:
        return self._tpl_dir(code) / _safe_name(variant or "通用")

    def list_template_variants(self, code: str) -> list[str]:
        base = self._tpl_dir(code)
        variants = {"通用"}
        if base.exists():
            variants.update(d.name for d in base.iterdir() if d.is_dir())
        return sorted(variants)

    def read_template(self, code: str, variant: str = "通用") -> str:
        p = self._tpl_variant_dir(code, variant) / "template.md"
        return p.read_text(encoding="utf-8") if p.exists() else ""

    def write_template(self, code: str, text: str, variant: str = "通用") -> None:
        _atomic_write(self._tpl_variant_dir(code, variant) / "template.md", text)

    def list_examples(self, code: str, variant: str = "通用") -> list[dict]:
        base = self._tpl_variant_dir(code, variant) / "examples"
        out = []
        if base.exists():
            for f in sorted(base.glob("*.md")):
                meta = _read_json(base / f"{f.stem}.json", {}) or {}
                meta["example_id"] = f.stem
                meta["content"] = f.read_text(encoding="utf-8")
                out.append(meta)
        return out

    def add_example(self, code: str, content: str, source: str = "",
                    anonymized: bool = False, variant: str = "通用") -> dict:
        ex_id = f"{_ts()}_{_new_id()}"
        base = self._tpl_variant_dir(code, variant) / "examples"
        _atomic_write(base / f"{ex_id}.md", content)
        meta = {"source": source, "anonymized": anonymized, "is_active": False, "created_at": _now()}
        _write_json(base / f"{ex_id}.json", meta)
        meta["example_id"] = ex_id
        return meta

    def set_example_active(self, code: str, ex_id: str, active: bool, variant: str = "通用") -> Optional[dict]:
        base = self._tpl_variant_dir(code, variant) / "examples"
        meta = _read_json(base / f"{_safe_name(ex_id)}.json")
        if meta is None:
            return None
        meta["is_active"] = bool(active)
        _write_json(base / f"{_safe_name(ex_id)}.json", meta)
        return meta

    # ---------------- 典型病例库（科室 / 病种 / 病例） ----------------
    def _cases_dir(self) -> Path:
        return self.root / "cases"

    def list_cases(self) -> list[dict]:
        """返回树形：{科室: {病种: [case...]}} 的扁平化列表（含路径）。"""
        out = []
        base = self._cases_dir()
        if base.exists():
            for dept_dir in sorted(base.iterdir()):
                if not dept_dir.is_dir():
                    continue
                for disease_dir in sorted(dept_dir.iterdir()):
                    if not disease_dir.is_dir():
                        continue
                    for f in sorted(disease_dir.glob("*.json")):
                        c = _read_json(f)
                        if c is not None:
                            c.setdefault("case_id", f.stem)
                            out.append(c)
        return out

    def get_case(self, case_id: str) -> Optional[dict]:
        for c in self.list_cases():
            if c.get("case_id") == case_id:
                return c
        return None

    def create_case(self, 科室: str, 病种: str, 标题: str, 内容: str) -> dict:
        case_id = _new_id()
        rec = {"case_id": case_id, "科室": 科室, "病种": 病种, "标题": 标题,
               "内容": 内容, "created_at": _now(), "updated_at": _now()}
        _write_json(self._cases_dir() / _safe_name(科室) / _safe_name(病种) / f"{case_id}.json", rec)
        return rec

    def update_case(self, case_id: str, data: dict) -> Optional[dict]:
        for c in self.list_cases():
            if c.get("case_id") != case_id:
                continue
            rec = {**c, **data, "case_id": case_id, "updated_at": _now()}
            path = self._cases_dir() / _safe_name(rec.get("科室", "")) / _safe_name(rec.get("病种", "")) / f"{case_id}.json"
            _write_json(path, rec)
            return rec
        return None

    def delete_case(self, case_id: str) -> bool:
        c = self.get_case(case_id)
        if not c:
            return False
        path = self._cases_dir() / _safe_name(c.get("科室", "")) / _safe_name(c.get("病种", "")) / f"{case_id}.json"
        if path.exists():
            path.unlink()
            return True
        return False


# ---------------------------------------------------------------- 默认注册表
def default_registry() -> list[dict]:
    """MVP 文书类型注册表（阶段/顺序/模板/所需要素）。"""
    return [
        {"code": "admission", "name": "入院记录", "phase": "入院", "sort": 10,
         "prompt_file": "admission.md", "required_fields": ["主诉", "现病史", "既往史", "个人史", "家族史", "体格检查", "初步诊断"], "is_active": True},
        {"code": "first_progress", "name": "首次病程记录", "phase": "入院", "sort": 20,
         "prompt_file": "first_progress.md", "required_fields": ["病例特点", "拟诊讨论", "诊疗计划"], "is_active": True},
        {"code": "progress_ward", "name": "查房/日常病程记录", "phase": "日常", "sort": 30,
         "prompt_file": "progress_ward.md", "required_fields": ["今日病情变化", "查体", "处理"], "is_active": True},
        {"code": "stage_summary", "name": "阶段小结", "phase": "日常", "sort": 40,
         "prompt_file": "stage_summary.md", "required_fields": [], "is_active": True},
        {"code": "handover", "name": "交接班记录", "phase": "日常", "sort": 50,
         "prompt_file": "handover.md", "required_fields": ["交班内容", "接班注意事项"], "is_active": True},
        {"code": "consultation", "name": "会诊记录", "phase": "日常", "sort": 60,
         "prompt_file": "consultation.md", "required_fields": ["会诊科室", "会诊意见"], "is_active": True},
        {"code": "preop_discussion", "name": "术前讨论记录", "phase": "术前", "sort": 70,
         "prompt_file": "preop_discussion.md", "required_fields": ["拟手术方案", "手术指征", "风险评估"], "is_active": True},
        {"code": "preop_summary", "name": "术前小结", "phase": "术前", "sort": 80,
         "prompt_file": "preop_summary.md", "required_fields": ["术前诊断", "拟行手术", "术前准备"], "is_active": True},
        {"code": "op_record", "name": "手术记录", "phase": "术中", "sort": 90,
         "prompt_file": "op_record.md", "required_fields": ["术者", "麻醉方式", "术中经过"], "is_active": True},
        {"code": "procedure_record", "name": "操作记录", "phase": "术中", "sort": 95,
         "prompt_file": "procedure_record.md", "required_fields": ["操作名称", "操作经过"], "is_active": True},
        {"code": "postop_progress", "name": "术后病程记录", "phase": "术后", "sort": 100,
         "prompt_file": "postop_progress.md", "required_fields": ["术后情况", "处理"], "is_active": True},
        {"code": "discharge_summary", "name": "出院小结", "phase": "出院", "sort": 110,
         "prompt_file": "discharge_summary.md", "required_fields": ["出院诊断", "出院医嘱"], "is_active": True},
        {"code": "discharge_orders", "name": "出院医嘱", "phase": "出院", "sort": 120,
         "prompt_file": "discharge_orders.md", "required_fields": ["带药", "随访"], "is_active": True},
    ]


# 模块级单例（FastAPI 依赖注入使用）
storage = Storage()
