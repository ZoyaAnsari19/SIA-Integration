# mlm-chat-engine

FastAPI + LangGraph chatbot service for SIA MLM.

## What this service does
- Exposes **SSE (fetch streaming)** chat endpoint: `POST /chat/stream`
- Verifies JWT using shared `JWT_SECRET`
- Uses **Gemini** via `GEMINI_API_KEY`
- Reads from the **same Postgres** as `MLM-API` via `DATABASE_URL`
- Stores session memory in **Redis** via `REDIS_URL`

## Local development

1) Create `.env` from `.env.example`

2) Install deps (choose one)

### Option A: pip
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3) Run
```bash
uvicorn mlm_chat.main:app --reload --port 8088
```

## Endpoints
- `GET /health`
- `POST /chat/stream` (SSE)

