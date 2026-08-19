FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY prompts ./prompts

ENV GI_DATA_DIR=/data
ENV VLLM_BASE_URL=http://inference:8000/v1
ENV LLM_MODEL=gi-assistant
ENV GI_HOST=0.0.0.0
ENV GI_PORT=8100

EXPOSE 8100
CMD ["sh", "-c", "uvicorn app.main:app --host $GI_HOST --port $GI_PORT"]
