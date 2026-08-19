"""全局配置：全部通过环境变量覆盖，便于 Mac 开发与服务器部署切换。"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/

# 数据目录（文件夹存储，无数据库）：默认仓库根下 data/
DATA_DIR = Path(os.environ.get("GI_DATA_DIR", str(BASE_DIR.parent / "data")))
# 提示词模板目录
PROMPTS_DIR = Path(os.environ.get("GI_PROMPTS_DIR", str(BASE_DIR / "prompts")))

# 推理服务（vLLM OpenAI 兼容端点）
VLLM_BASE_URL = os.environ.get("VLLM_BASE_URL", "http://127.0.0.1:8000/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "gi-assistant")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "EMPTY")
LLM_TIMEOUT = float(os.environ.get("LLM_TIMEOUT", "300"))

# 开发/测试模式：LLM_STUB=1 时返回固定文本，用于无 GPU 环境跑通全链路
LLM_STUB = os.environ.get("LLM_STUB", "0") == "1"

# 上下文组装预算
MAX_CONTEXT_TOKENS = int(os.environ.get("MAX_CONTEXT_TOKENS", "16000"))
RECENT_DOCS_FULL = int(os.environ.get("RECENT_DOCS_FULL", "3"))   # 此前文书全文篇数
RECENT_LABS = int(os.environ.get("RECENT_LABS", "20"))            # 最近检验条数
MAX_EXAMPLES = int(os.environ.get("MAX_EXAMPLES", "2"))           # few-shot 示例条数
MAX_CHAT_HISTORY = int(os.environ.get("MAX_CHAT_HISTORY", "8"))   # 对话修订保留轮数

# 采样参数
TEMP_DRAFT = float(os.environ.get("TEMP_DRAFT", "0.3"))
TEMP_PLAN = float(os.environ.get("TEMP_PLAN", "0.4"))
TEMP_SUMMARY = float(os.environ.get("TEMP_SUMMARY", "0.0"))
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "4096"))

# 服务器监听
HOST = os.environ.get("GI_HOST", "0.0.0.0")
PORT = int(os.environ.get("GI_PORT", "8100"))
