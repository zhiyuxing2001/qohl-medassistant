#!/usr/bin/env bash
# 全链路验证：解析服务 + 后端(stub) + Web 三端健康检查与关键接口抽查
# 用法：bash scripts/verify_all.sh [--with-web]
set -euo pipefail
cd "$(dirname "$0")/.."
WITH_WEB="${1:-}"

echo "==> [1/3] Mac 解析服务 (8001)"
GI_UPLOADS_DIR=$(mktemp -d) ./.venv/bin/uvicorn mac_parse.server:app --host 127.0.0.1 --port 8001 --app-dir . > /tmp/gi_verify_parse.log 2>&1 &
PID_PARSE=$!
sleep 2
curl -sf http://127.0.0.1:8001/health > /dev/null && echo "  ✓ /health" || echo "  ✗ 解析服务未就绪"
curl -sf -X POST http://127.0.0.1:8001/parse/labs -H "Content-Type: application/json" \
  -d '{"text":"丙氨酸氨基转移酶(ALT) 156 U/L 9-50 ↑"}' | grep -q "丙氨酸氨基转移酶" && echo "  ✓ /parse/labs" || echo "  ✗ /parse/labs"

echo "==> [2/3] 后端 (8100, stub)"
LLM_STUB=1 ./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8100 --app-dir backend > /tmp/gi_verify_backend.log 2>&1 &
PID_BACKEND=$!
sleep 2
curl -sf http://127.0.0.1:8100/api/health | grep -q '"ok"' && echo "  ✓ /api/health" || echo "  ✗ 后端未就绪"
curl -sf http://127.0.0.1:8100/api/templates | grep -q "admission" && echo "  ✓ /api/templates（注册表已种子）" || echo "  ✗ 注册表缺失"
NP=$(curl -sf http://127.0.0.1:8100/api/patients | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
echo "  ✓ /api/patients（当前 $NP 位患者）"

if [ -n "$WITH_WEB" ]; then
  echo "==> [3/3] Web (3000)"
  (cd web && npm run dev > /tmp/gi_verify_web.log 2>&1) &
  PID_WEB=$!
  sleep 20
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
  echo "  Web 首页 HTTP $code"
  kill $PID_WEB 2>/dev/null || true
fi

kill $PID_PARSE $PID_BACKEND 2>/dev/null || true
echo "==> 验证完成"
