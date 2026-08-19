#!/usr/bin/env python3
"""演示数据种子：创建一位示例患者 + 住院 + 检验/检查/用药（写入 data/ 文件夹存储）。

用法：
    python3 scripts/seed_demo.py            # 在默认 data/ 建演示数据
    GI_DATA_DIR=/path/to/data python3 scripts/seed_demo.py
"""
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
os.environ.setdefault("GI_DATA_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data"))

from app.storage import storage  # noqa: E402

D = date.today().isoformat()
D1 = (date.today() - timedelta(days=3)).isoformat()
D2 = (date.today() - timedelta(days=2)).isoformat()


def main():
    pid = storage.create_patient({
        "脱敏编号": "DEMO-001",
        "性别": "男",
        "年龄": 56,
        "体重": 72.5,
        "过敏史": "青霉素过敏",
        "既往史": "高血压病史5年，规律服药；无手术史",
        "家族史": "父亲因胃癌去世",
    })["patient_id"]

    vid = storage.create_visit(pid, {
        "住院号": "GI-DEMO-2025-001",
        "入院日期": D1,
        "状态": "住院中",
        "主诉": "上腹痛3天，加重1天",
        "现病史": "患者3天前无明显诱因出现上腹部隐痛，呈持续性，餐后加重，伴反酸、嗳气，"
                 "1天前疼痛加重，向背部放射，伴恶心。门诊查血淀粉酶升高，拟「急性胰腺炎」收入院。",
        "体格检查": "T 37.2℃，P 92次/分，R 20次/分，BP 138/86mmHg。上腹部压痛，无反跳痛，"
                    "Murphy征阴性，肠鸣音减弱。",
        "入院诊断": "急性胰腺炎（中度）？",
        "出院诊断": "",
    })["visit_id"]

    labs = [
        {"项目": "血淀粉酶(AMY)", "结果": "486", "单位": "U/L", "参考范围": "25-125", "异常标志": "↑", "日期": D1},
        {"项目": "脂肪酶(LIP)", "结果": "612", "单位": "U/L", "参考范围": "13-60", "异常标志": "↑", "日期": D1},
        {"项目": "白细胞计数(WBC)", "结果": "13.8", "单位": "10^9/L", "参考范围": "3.5-9.5", "异常标志": "↑", "日期": D1},
        {"项目": "丙氨酸氨基转移酶(ALT)", "结果": "88", "单位": "U/L", "参考范围": "9-50", "异常标志": "↑", "日期": D2},
        {"项目": "天门冬氨酸氨基转移酶(AST)", "结果": "76", "单位": "U/L", "参考范围": "15-40", "异常标志": "↑", "日期": D2},
        {"项目": "总胆红素(TBIL)", "结果": "18.6", "单位": "umol/L", "参考范围": "5-21", "异常标志": "", "日期": D2},
        {"项目": "肌酐(CREA)", "结果": "82", "单位": "umol/L", "参考范围": "57-97", "异常标志": "", "日期": D2},
        {"项目": "C反应蛋白(CRP)", "结果": "96", "单位": "mg/L", "参考范围": "<8", "异常标志": "↑", "日期": D2},
    ]
    for lab in labs:
        storage.add_item(pid, vid, "labs", lab)

    storage.add_item(pid, vid, "imaging", {
        "类型": "上腹部CT平扫+增强", "日期": D2, "置信度": 1.0,
        "检查所见": "胰腺体尾部肿胀，周围脂肪间隙模糊，见少量渗出；胰周少量积液；胆囊未见明显异常；",
        "诊断意见": "急性胰腺炎（Balthazar C级）可能，请结合临床。",
    })
    storage.add_item(pid, vid, "meds", {
        "药品": "生长抑素", "剂型": "注射液", "剂量": "3mg", "频次": "静脉泵入 q12h",
        "途径": "静脉", "开始日期": D1, "状态": "在用",
    })
    storage.add_item(pid, vid, "meds", {
        "药品": "奥美拉唑", "剂型": "注射液", "剂量": "40mg", "频次": "qd",
        "途径": "静脉", "开始日期": D1, "状态": "在用",
    })
    storage.add_item(pid, vid, "meds", {
        "药品": "复方氨基酸", "剂型": "注射液", "剂量": "250ml", "频次": "qd",
        "途径": "静脉", "开始日期": D1, "状态": "在用",
    })

    print(f"演示数据已写入 data/：patient_id={pid}  visit_id={vid}")
    print(f"后续可在界面中：选择该患者 → 生成入院记录/病程记录 → 对话修订 → 诊疗计划")


if __name__ == "__main__":
    main()
