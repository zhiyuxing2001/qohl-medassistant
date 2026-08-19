# qohl-medassistant — AI 消化科医生临床助手

辅助临床医生完成 **从入院到出院的全部医疗文书**（入院记录、查房病程、术前讨论/小结、操作/手术记录、术后病程、出院小结/医嘱）书写与 **下一步诊疗计划建议**。全流程本地化：模型推理在自建服务器（H20），界面运行在 Mac。

- 前端：基于 [chatbot-ui](https://github.com/mckaywrigley/chatbot-ui)（MIT）fork 的 Next.js 工作台，运行于 Mac
- 后端：Python FastAPI + **文件夹 + JSON 存储（无数据库）**，备份 = 复制 `data/` 目录
- 推理：vLLM + DeepSeek-R1-Distill-Qwen-32B（H20 单卡，FP16）；备选 14B
- OCR/PDF 解析：Mac 本地（pdfplumber + macOS Vision），扫描件原件不出 Mac
- 提示词：`backend/prompts/*.md` 文本文件，改提示词即改文本

## 架构

```
Mac（界面 + 解析）
  Web (chatbot-ui fork, :3000)  +  Mac 解析服务 (:8001)
        │ HTTP
Server（数据 + 推理）
  FastAPI (:8100) + data/ 文件夹存储  +  vLLM (:8000)
```

## 目录

```
backend/       FastAPI 后端（app/ 路由与业务、prompts/ 提示词模板、tests/）
mac_parse/     Mac 本地解析服务（pdfplumber + Vision OCR + 项目归一化）
web/           chatbot-ui fork（界面）
scripts/       安装/启动/权重下载脚本
data/          文件夹存储（JSON，自动生成，勿提交）
docs/          实现方案文档
```

## 快速开始（Mac）

```bash
# 1. 安装
bash scripts/install_mac.sh

# 2. 启动（默认 stub 模式：不连真实模型，跑通全链路）
bash scripts/run_mac.sh
# 浏览器打开 http://localhost:3000

# 3. 接入真实模型：服务器部署好后
VLLM_BASE_URL=http://<服务器IP>:8000/v1 LLM_STUB=0 启动后端
```

## 服务器部署（H20）

```bash
# 1. 装驱动 (≥550)、NVIDIA Container Toolkit、Docker
# 2. 下载权重（约 70GB，国内网络）
bash scripts/download_model.sh ms      # ModelScope 或 hf
# 3. 启动推理 + 后端
docker compose up -d --build
# 推理服务 :8000（vLLM OpenAI 兼容），后端 :8100
```

## 主要 API

| 端点 | 功能 |
|------|------|
| `/api/patients` `/api/visits` | 患者与住院 CRUD |
| `/api/patients/{pid}/visits/{vid}/timeline` | 统一时间线 |
| `/api/.../items/{labs\|imaging\|endoscopy\|meds}` | 检验/检查/用药条目 |
| `/api/.../documents/generate` | 文书生成（参考此前全部资料 + 模板 + 示例） |
| `/api/.../documents/{id}/chat` | 文书对话修订（SSE 流式，修订历史可回退） |
| `/api/.../documents/{id}/confirm` | 确认并生成摘要 |
| `/api/.../documents/{id}/export` | 导出 .docx（中文宋体） |
| `/api/.../suggestions/plan` | 诊疗计划（guided_json 结构化） |
| `/api/templates` | 文书注册表 + 空白模板 + 脱敏示例管理 |
| `/api/anon/detect` `/api/anon/replace` | 自动脱敏辅助 |

## 使用流程

1. 建患者（脱敏编号）与住院记录，填主诉/现病史/体查；
2. 资料库上传检验 PDF 或粘贴文本 → Mac 本地解析 → 结构化入库（低置信度项人工确认）；
3. 文书时间线选择文书类型 → 生成草稿 → 聊天修订 → 确认 → 导出 Word；
4. 诊疗建议一键生成结构化计划卡片，逐条采纳/忽略；
5. 模板与示例管理：上传本院空白模板与已脱敏示例病历，AI 遵循本院格式与文风。

## 安全

- 数据不出自有设备：扫描件原件仅存 Mac，结构化数据存服务器，均不出内网；
- 患者建议以脱敏编号记录；示例病历必须脱敏后方可启用；
- 所有 AI 输出为「草稿」，医生是最终审核人；系统仅辅助。

详见 [docs/实现方案.md](docs/实现方案.md)。
