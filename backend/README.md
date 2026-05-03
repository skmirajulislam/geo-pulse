# World Monitor — Backend

Node.js / Express backend for the World Monitor geopolitical news dashboard.
Runs a scheduled ingestion pipeline that fetches, filters, classifies, deduplicates, and stores geopolitical events in MongoDB + Redis, then serves them via REST API.

---

## Quick Start

```bash
cp .env.example .env   # fill in your keys
npm install
npm run dev            # nodemon dev server
npm start              # production
```

### Docker

```bash
npm run docker:build
npm run docker:run
```

### Full-stack activation scripts (repo root)

From `World-Monitor/`:

```bash
# macOS / Linux
./activation.sh
```

```powershell
# Windows PowerShell
.\activation.ps1
```

---

## Environment Variables

Copy `.env.example` and fill in your values.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | ✅ | 5000 | API server port |
| `CORS_ORIGIN` | — | (all) | Comma-separated allowed frontend origins |
| `NEWS_API_KEY` | ✅ | — | NewsAPI.org API key |
| `GUARDIAN_API_KEY` | ✅ | — | The Guardian API key |
| `GROQ_API_KEY` | ✅ | — | Groq / OpenAI-compatible LLM API key |
| `LLM_MODEL` | ✅ | — | Model name (e.g. `llama-3.3-70b-versatile`) |
| `LLM_BATCH_SIZE` | — | 5 | Articles per LLM batch call |
| `MAX_ARTICLES_PER_RUN` | — | 120 | Hard cap on articles entering the pipeline per run |
| `MAX_LLM_CALLS_PER_RUN` | — | 30 | Max LLM API calls per pipeline run |
| `LLM_CONFIDENCE_THRESHOLD` | — | 0.4 | Minimum LLM confidence to accept an event |
| `RSS_PER_FEED_LIMIT` | — | 25 | Max items fetched per RSS feed |
| `PIPELINE_INTERVAL_MINUTES` | — | 15 | Cron run interval |
| `MONGODB_URI` | — | (disabled) | MongoDB connection string (skip = cache-only mode) |
| `MONGODB_DB_NAME` | — | world_monitor | Database name |
| `RETENTION_DAYS` | — | 15 | Data retention window (auto-delete after N days) |
| `REDIS_URL` | — | — | Cloud Redis URL (`rediss://...`). Overrides HOST/PORT |
| `REDIS_HOST` | — | 127.0.0.1 | Local Redis host |
| `REDIS_PORT` | — | 6379 | Local Redis port |
| `REDIS_USERNAME` | — | — | Cloud Redis username |
| `REDIS_PASSWORD` | — | — | Cloud Redis password |
| `REDIS_TLS` | — | false | Enable TLS (`true` for cloud) |
| `REDIS_TLS_REJECT_UNAUTHORIZED` | — | true | Reject invalid TLS certs |
| `REDIS_CONNECT_TIMEOUT_MS` | — | 10000 | Redis connect timeout |
| `REDIS_CACHE_TTL_SECONDS` | — | 1296000 (15d) | Per-key TTL in Redis |
| `REDIS_MAX_ARCHIVE_DATES` | — | 45 | Max daily snapshot keys kept in Redis |

---

## Pipeline Flow

```
Sources (RSS + NewsAPI + GDELT + Guardian)
  ↓
news.aggregator   → fetch all, URL-dedupe, cap at MAX_ARTICLES_PER_RUN
  ↓
news.preFilter    → whitelist keyword gate (only geopolitical articles proceed)
  ↓
news.llmFilter    → LLM batch classification (budget-capped)
  ↓
news.transformer  → canonical event shape + deterministic hash IDs
  ↓
news.deduplicator → event-level similarity dedupe within this run
  ↓
news.selector     → FIFO: check Redis → check MongoDB → accept/reject
  ↓
news.scorer       → severity / confidence / recency scoring
  ↓
events.repository → MongoDB upsert (15-day auto-TTL)
  ↓
cache.service     → Redis merge/set (bounded keys, per-key TTL)
  ↓
REST API          → GET /api/geopolitics, GET /api/geopolitics/dates
```

---

## REST API

| Endpoint | Description |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/geopolitics` | Today's events grouped by category |
| `GET /api/geopolitics?date=YYYY-MM-DD` | Events for a specific archived date |
| `GET /api/geopolitics/dates` | All available archive dates |
| `GET /api/chat/rooms` | List active communication rooms and online users |
| `POST /api/chat/rooms` | Create room (`roomName`, `topic`, `ownerName`) |

**Response shape** (`/api/geopolitics`):

```json
{
  "success": true,
  "count": 42,
  "data": {
    "Armed Conflict": [ { "id": "...", "title": "...", ... } ],
    "Politics": [ ... ]
  }
}
```

---

## Real-time Room Chat (Socket.IO)

- Socket endpoint: same host as backend (`ws://<host>:<port>` via Socket.IO)
- Room inactivity cleanup runs every `CHAT_ROOM_INACTIVE_MINUTES` (default: `10`)
- Usernames are unique per room (case-insensitive) while connected
- Room names are unique globally (case-insensitive)
- Owner can remove users and delete the room

Core Socket.IO events:

- `chat:join`, `chat:leave`, `chat:send`
- `chat:kick`, `chat:delete-room`
- `chat:rooms-updated`, `chat:message`, `chat:presence`, `chat:room-deleted`

---

## Storage

- **MongoDB** — source of truth. Events auto-deleted after `RETENTION_DAYS` by TTL index.
- **Redis** — cache layer. Read path: Redis first → cache miss → MongoDB → repopulate Redis.
  - Bounded key count (`REDIS_MAX_ARCHIVE_DATES`)
  - Per-key TTL (`REDIS_CACHE_TTL_SECONDS`)
  - Old keys pruned automatically to protect cloud Redis memory

---

## News Sources

| Source | Type | Provider |
|---|---|---|
| BBC World | RSS | `feeds.bbci.co.uk` |
| Al Jazeera | RSS | `aljazeera.com` |
| NY Times World | RSS | `nytimes.com` |
| CNN World | RSS | `rss.cnn.com` |
| Reuters World | RSS | `feeds.reuters.com` |
| The Guardian World | RSS | `theguardian.com` |
| NewsAPI | REST API | `newsapi.org` |
| GDELT | REST API | `gdeltproject.org` |
| The Guardian | REST API | `content.guardianapis.com` |
