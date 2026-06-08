FROM python:3.12-slim

WORKDIR /app

# Build context = mlm-chat-engine/ (repo root). Ensure stage-build-and-push.sh
# copies Ai-plan.md into mlm-chat-engine/ before building, OR build from
# repo-root with `-f mlm-chat-engine/Dockerfile`.

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY src /app/src
COPY Ai-plan.md /app/Ai-plan.md

ENV PYTHONPATH=/app/src
ENV PORT=8088

EXPOSE 8088

CMD ["uvicorn", "mlm_chat.main:app", "--host", "0.0.0.0", "--port", "8088"]
