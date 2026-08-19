"""端到端冒烟测试（LLM_STUB=1）：患者→住院→资料→文书生成→对话修订→诊疗计划→导出。"""
import os
import tempfile

os.environ["LLM_STUB"] = "1"
os.environ["GI_DATA_DIR"] = tempfile.mkdtemp(prefix="gi_test_")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["llm_stub"] is True


def test_full_flow():
    # 1. 患者
    r = client.post("/api/patients", json={"脱敏编号": "P001", "性别": "男", "年龄": 56, "体重": 70,
                                           "过敏史": "青霉素过敏", "既往史": "高血压"})
    assert r.status_code == 200, r.text
    pid = r.json()["patient_id"]

    # 2. 住院
    r = client.post(f"/api/patients/{pid}/visits", json={
        "住院号": "GI20250101", "入院日期": "2025-01-01", "主诉": "上腹痛3天",
        "现病史": "患者3天前无明显诱因出现上腹部隐痛，餐后加重，伴反酸嗳气。",
        "体格检查": "上腹部轻压痛，无反跳痛。", "入院诊断": "腹痛待查：消化性溃疡？"})
    assert r.status_code == 200, r.text
    vid = r.json()["visit_id"]

    # 3. 检验
    r = client.post(f"/api/patients/{pid}/visits/{vid}/items/labs", json={
        "项目": "丙氨酸氨基转移酶(ALT)", "结果": "156", "单位": "U/L",
        "参考范围": "9-50", "异常标志": "↑", "日期": "2025-01-01"})
    assert r.status_code == 200, r.text
    r = client.post(f"/api/patients/{pid}/visits/{vid}/items/labs", json={
        "项目": "白细胞计数(WBC)", "结果": "12.5", "单位": "10^9/L",
        "参考范围": "3.5-9.5", "异常标志": "↑", "日期": "2025-01-01"})
    assert r.status_code == 200
    r = client.post(f"/api/patients/{pid}/visits/{vid}/items/meds", json={
        "药品": "奥美拉唑", "剂型": "胶囊", "剂量": "20mg", "频次": "qd", "途径": "口服",
        "开始日期": "2025-01-01", "状态": "在用"})
    assert r.status_code == 200

    # 4. 注册表与模板
    r = client.get("/api/templates")
    assert r.status_code == 200
    codes = [t["code"] for t in r.json()]
    assert "admission" in codes

    # 5. 文书生成
    r = client.post(f"/api/patients/{pid}/visits/{vid}/documents/generate",
                    json={"doc_type": "admission", "doc_date": "2025-01-01"})
    assert r.status_code == 200, r.text
    doc = r.json()["document"]
    assert doc["status"] == "草稿"
    assert doc["content"]
    assert r.json()["prompt_version"]
    doc_id = doc["doc_id"]

    # 6. 对话修订（SSE）
    with client.stream("POST", f"/api/patients/{pid}/visits/{vid}/documents/{doc_id}/chat",
                       json={"message": "把主诉改为一句话"} ) as resp:
        assert resp.status_code == 200
        body = "".join(resp.iter_text())
        assert "event" in body

    # 7. 修订历史
    r = client.get(f"/api/patients/{pid}/visits/{vid}/documents/{doc_id}/revisions")
    assert r.status_code == 200
    assert len(r.json()) >= 2

    # 8. 确认
    r = client.post(f"/api/patients/{pid}/visits/{vid}/documents/{doc_id}/confirm")
    assert r.status_code == 200
    assert r.json()["status"] == "已确认"

    # 9. 诊疗计划
    r = client.post(f"/api/patients/{pid}/visits/{vid}/suggestions/plan")
    assert r.status_code == 200, r.text
    plan = r.json()
    assert plan["type"] == "诊疗计划"
    assert "检查建议" in plan["content"]

    # 10. 导出
    r = client.get(f"/api/patients/{pid}/visits/{vid}/documents/{doc_id}/export")
    assert r.status_code == 200
    assert r.content[:2] == b"PK"  # docx zip 魔数

    # 11. 时间线
    r = client.get(f"/api/patients/{pid}/visits/{vid}/timeline")
    assert r.status_code == 200
    kinds = {x["kind"] for x in r.json()}
    assert "labs" in kinds and "document" in kinds


def test_anon_and_template():
    r = client.post("/api/anon/detect", json={"text": "患者身份证号 110101199001011234，手机号 13812345678"})
    assert r.status_code == 200
    assert r.json()["found"] is True

    r = client.post("/api/anon/replace", json={"text": "身份证 110101199001011234 已脱敏"})
    assert r.status_code == 200
    assert "已脱敏" in r.json()["text"]

    # 模板示例：未脱敏不可启用
    r = client.post("/api/templates/admission/examples",
                    json={"content": "患者张三，男，56岁……", "anonymized": False})
    assert r.status_code == 200
    ex_id = r.json()["example_id"]
    r = client.post(f"/api/templates/admission/examples/{ex_id}/active", json={"active": True})
    assert r.status_code == 400  # 未脱敏禁止启用

    r = client.put("/api/templates/admission/template", json={"text": "一、一般情况\n二、主诉\n"})
    assert r.status_code == 200
