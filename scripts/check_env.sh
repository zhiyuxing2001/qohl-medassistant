#!/usr/bin/env bash
# 环境自检：确认 Mac 端各组件可运行
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Python 虚拟环境"
[ -x ./.venv/bin/python ] && echo "  ✓ .venv 存在 ($(./.venv/bin/python --version 2>&1))" || { echo "  ✗ 请先运行 bash scripts/install_mac.sh"; exit 1; }

echo "==> 后端导入"
PYTHONPATH=backend LLM_STUB=1 ./.venv/bin/python -c "import app.main; print('  ✓ backend 可导入')" 2>/dev/null || { echo "  ✗ backend 导入失败"; exit 1; }

echo "==> 解析服务导入"
GI_UPLOADS_DIR=$(mktemp -d) ./.venv/bin/python -c "import mac_parse.server; print('  ✓ mac_parse 可导入')" || echo "  ✗ mac_parse 导入失败"

echo "==> Vision OCR"
./.venv/bin/python -c "import Vision; print('  ✓ macOS Vision 可用')" 2>/dev/null || echo "  ✗ Vision 不可用（仅 macOS 支持）"

echo "==> Web"
[ -d web/node_modules ] && echo "  ✓ web/node_modules 存在 ($(ls web/node_modules | wc -l | tr -d ' ') 个包)" || echo "  ✗ 请运行 (cd web && npm install)"
node --version 2>/dev/null | sed 's/^/  ✓ node /' || echo "  ✗ node 未安装"

echo "==> 数据目录"
[ -d data ] && echo "  ✓ data/ 存在" || echo "  ✗ data/ 缺失"

echo "==> 完成"
