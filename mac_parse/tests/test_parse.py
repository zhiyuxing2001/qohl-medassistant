"""Mac 解析服务冒烟测试：合成 PDF → 数字型判别 → 检验项结构化。

运行：LLM_STUB=1 PYTHONPATH=. ../.venv/bin/python -m pytest mac_parse/tests -q
"""
import os
import tempfile

os.environ["GI_UPLOADS_DIR"] = tempfile.mkdtemp(prefix="gi_uploads_")

from fastapi.testclient import TestClient  # noqa: E402

from mac_parse.server import app  # noqa: E402

client = TestClient(app)

SAMPLE_TEXT = (
    "肝功能\n"
    "丙氨酸氨基转移酶(ALT) 156 U/L 9-50 ↑\n"
    "天门冬氨酸氨基转移酶(AST) 88 U/L 15-40 ↑\n"
    "总胆红素(TBIL) 25.3 umol/L 5-21 ↑\n"
    "血常规\n"
    "白细胞计数(WBC) 12.5 10^9/L 3.5-9.5 ↑\n"
)


def _make_pdf(text: str) -> bytes:
    import fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), text, fontsize=11)
    data = doc.tobytes()
    doc.close()
    return data


def test_parse_labs_text():
    r = client.post("/parse/labs", json={"text": SAMPLE_TEXT})
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) >= 4
    alt = next(i for i in items if "ALT" in i["项目"])
    assert alt["结果"] == "156"
    assert alt["异常标志"] == "↑"
    # 粘贴文本模式 base_conf=0.7：<0.9 表示需人工确认（符合设计）
    assert 0.5 <= alt["置信度"] <= 0.7


def test_parse_pdf_digital():
    pdf = _make_pdf(SAMPLE_TEXT)
    r = client.post("/parse/pdf", files={"file": ("labs.pdf", pdf, "application/pdf")})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["is_digital"] is True
    assert len(data["items"]) >= 4
    # 原件保存在 Mac 本地 uploads
    assert data["saved_path"].startswith(os.environ["GI_UPLOADS_DIR"])


def test_health():
    assert client.get("/health").status_code == 200
