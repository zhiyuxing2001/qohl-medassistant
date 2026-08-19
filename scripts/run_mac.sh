#!/usr/bin/env bash
# Mac：启动三个本地服务（解析服务 / 后端 / Web）
# 用法：bash scripts/run_mac.sh   （Ctrl+C 停止）
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 启动 Mac 解析服务 (8001)"
./.venv/bin/uvicorn mac_parse.server:app --host 0.0.0.0 --port 8001 --app-dir . &
PID_PARSE=$!

echo "==> 启动后端 (8100, stub 模式；生产去掉 LLM_STUB=1)"
LLM_STUB=${LLM_STUB:-1} ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8100 --app-dir backend &
PID_BACKEND=$!

echo "==> 启动 Web (3000)"
(cd web && npm run dev) &
PID_WEB=$!

trap "kill $PID_PARSE $PID_BACKEND $PID_WEB 2>/dev/null" EXIT
wait
