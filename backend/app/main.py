"""GI 临床助手后端入口。

启动（开发）：
    cd backend && pip install -r requirements.txt
    LLM_STUB=1 uvicorn app.main:app --host 0.0.0.0 --port 8100
生产（服务器）：
    VLLM_BASE_URL=http://127.0.0.1:8000/v1 LLM_MODEL=gi-assistant uvicorn app.main:app ...
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .routes import documents, materials, patients, suggestions, templates
from .storage import storage


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage.load_registry()  # 确保注册表种子写入
    print(f"[startup] data_dir={storage.root}")
    print(f"[startup] llm_stub={config.LLM_STUB} vllm={config.VLLM_BASE_URL} model={config.LLM_MODEL}")
    yield


app = FastAPI(title="GI Clinical Assistant", version="0.5", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 单机内网使用
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router)
app.include_router(materials.router)
app.include_router(documents.router)
app.include_router(suggestions.router)
app.include_router(templates.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "llm_stub": config.LLM_STUB,
            "model": config.LLM_MODEL, "vllm": config.VLLM_BASE_URL}
