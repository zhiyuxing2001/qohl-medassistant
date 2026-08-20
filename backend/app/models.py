"""Pydantic 数据模型（请求/响应 schema）。"""
from typing import Any, Optional
from pydantic import BaseModel, Field


class PatientIn(BaseModel):
    脱敏编号: str = Field(default="", description="脱敏编号，不存真实姓名")
    性别: Optional[str] = None
    年龄: Optional[int] = None
    体重: Optional[float] = None
    过敏史: str = ""
    既往史: str = ""
    家族史: str = ""
    备注: str = ""


class VisitIn(BaseModel):
    住院号: str = ""
    入院日期: Optional[str] = None   # YYYY-MM-DD
    出院日期: Optional[str] = None
    状态: str = "住院中"              # 住院中 / 已出院
    主诉: str = ""
    现病史: str = ""
    体格检查: str = ""
    入院诊断: str = ""
    出院诊断: str = ""
    备注: str = ""


class LabItem(BaseModel):
    项目: str
    结果: str
    单位: str = ""
    参考范围: str = ""
    异常标志: str = ""               # ↑ / ↓ / 空
    日期: str = ""                   # YYYY-MM-DD
    置信度: float = 1.0              # 解析置信度，<0.9 需人工确认


class ResultItem(BaseModel):
    类型: str = ""                   # 如 腹部CT / 胃镜
    检查所见: str = ""
    诊断意见: str = ""
    日期: str = ""
    置信度: float = 1.0


class MedItem(BaseModel):
    药品: str
    剂型: str = ""
    剂量: str = ""
    频次: str = ""
    途径: str = ""
    开始日期: str = ""
    结束日期: str = ""
    状态: str = "在用"               # 在用 / 已停
    备注: str = ""


class MaterialIn(BaseModel):
    文件名: str = ""
    类型: str = "lab_pdf"            # lab_pdf / scanned / image / text / other
    日期: str = ""                   # 临床日期，默认上传当天
    解析结果: dict[str, Any] = {}
    置信度: float = 1.0


class GenerateRequest(BaseModel):
    doc_type: str                    # 注册表 code，如 admission
    doc_date: str = ""               # YYYY-MM-DD，默认今天
    extra_fields: dict[str, str] = {}  # 医生补充要素，如 拟手术方案
    vitals: dict[str, str] = {}      # 生命体征：体温/脉搏/呼吸/血压/SpO2/体重
    material_ids: list[str] = []     # 挂载材料（生成参考）


class ChatRequest(BaseModel):
    message: str
    material_ids: list[str] = []     # 对话补充材料


class ExampleIn(BaseModel):
    content: str
    source: str = ""
    anonymized: bool = False


class TemplateIn(BaseModel):
    text: str
