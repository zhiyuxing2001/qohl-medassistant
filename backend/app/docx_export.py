"""Word 导出（python-docx）：Markdown 风格的文书内容 → .docx（中文宋体）。"""
from io import BytesIO

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Pt


def _set_east_asia(style_or_run, font_name: str = "宋体") -> None:
    try:
        style_or_run.font.name = font_name
        rpr = style_or_run._element.get_or_add_rPr()
        rfonts = rpr.find(qn("w:rFonts"))
        if rfonts is None:
            rfonts = rpr.makeelement(qn("w:rFonts"), {})
            rpr.append(rfonts)
        rfonts.set(qn("w:eastAsia"), font_name)
    except Exception:
        pass


def export_docx(title: str, content: str) -> BytesIO:
    doc = Document()
    _set_east_asia(doc.styles["Normal"], "宋体")
    doc.styles["Normal"].font.size = Pt(12)

    h = doc.add_heading(title, level=0)
    h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _set_east_asia(h.runs[0], "黑体") if h.runs else None

    for line in (content or "").splitlines():
        line = line.rstrip()
        if not line.strip():
            continue
        stripped = line.strip()
        if stripped.startswith("# "):
            p = doc.add_heading(stripped[2:], level=1)
            _set_east_asia(p.runs[0], "黑体") if p.runs else None
        elif stripped.startswith("## "):
            p = doc.add_heading(stripped[3:], level=2)
            _set_east_asia(p.runs[0], "黑体") if p.runs else None
        elif stripped.startswith("### "):
            p = doc.add_heading(stripped[4:], level=3)
            _set_east_asia(p.runs[0], "黑体") if p.runs else None
        else:
            para = doc.add_paragraph(stripped)
            for run in para.runs:
                _set_east_asia(run, "宋体")

    buf = BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf
