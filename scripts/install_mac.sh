#!/usr/bin/env bash
# Mac 端一键安装：Python 虚拟环境（后端 + 解析服务）+ Web（chatbot-ui fork）
# 用法：bash scripts/install_mac.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> [1/3] Python 虚拟环境"
python3 -m venv .venv
./.venv/bin/pip install -q --upgrade pip
./.venv/bin/pip install -q -r backend/requirements.txt
./.venv/bin/pip install -q -r mac_parse/requirements.txt

echo "==> [2/3] Web 依赖（chatbot-ui fork）"
(cd web && npm install)

echo "==> [3/3] 完成"
echo "启动后端(stub 模式):  LLM_STUB=1 ./.venv/bin/uvicorn app.main:app --port 8100 --app-dir backend"
echo "启动 Mac 解析服务:   ./.venv/bin/uvicorn server:app --port 8001 --app-dir mac_parse"
echo "启动 Web:            (cd web && npm run dev)  → http://localhost:3000"
