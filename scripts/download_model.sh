#!/usr/bin/env bash
# 服务器：下载 DeepSeek-R1-Distill-Qwen-32B 权重到 /models（国内网络）
# 用法：bash scripts/download_model.sh [hf|ms]
#   hf  -> huggingface + hf-mirror.com（约 70GB）
#   ms  -> ModelScope
set -euo pipefail

MODEL_DIR=${MODEL_DIR:-/models/DeepSeek-R1-Distill-Qwen-32B}
MODE=${1:-ms}

case "$MODE" in
  ms)
    echo "==> ModelScope 下载到 $MODEL_DIR"
    pip install -q modelscope
    modelscope download --model deepseek-ai/DeepSeek-R1-Distill-Qwen-32B --local_dir "$MODEL_DIR"
    ;;
  hf)
    echo "==> hf-mirror 下载到 $MODEL_DIR"
    pip install -q -U "huggingface_hub[cli]"
    HF_ENDPOINT=https://hf-mirror.com huggingface-cli download \
      deepseek-ai/DeepSeek-R1-Distill-Qwen-32B --local-dir "$MODEL_DIR"
    ;;
  *)
    echo "用法: bash scripts/download_model.sh [hf|ms]"; exit 1;;
esac

echo "==> 完成。随后：docker compose up -d --build"
