# wegoviral.ai

AI-powered Instagram viral intelligence platform. Paste any Instagram Reel URL and get brutally honest AI feedback on why it didn't go viral — with a complete brief on how to fix it.

## What's inside

```
wegoviral/
├── apps/
│   ├── api/          Node.js + Express + Prisma backend
│   └── web/          Next.js 14 App Router frontend
└── packages/
    └── shared/       Shared TypeScript types
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| npm | 7+ (comes with Node) |
| PostgreSQL | 14+ |
| Redis | 7+ |

---

## Quick Start

### 1. Install dependencies

```bash
npm run init
```

This installs all dependencies, copies env files, and generates the Prisma client.

### 2. Configure environment variables

**API (`apps/api/.env`)**
```env
DATABASE_URL="postgresql://localhost:5432/wegoviral"
ANTHROPIC_API_KEY="sk-ant-..."
REDIS_URL="redis://localhost:6379"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
```

**Web (`apps/web/.env.local`)**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Set up the database

```bash
# Create the database
createdb wegoviral

# Generate Prisma client + run migrations
pnpm db:migrate
```

### 4. Start services

```bash
# Start both API + Web in parallel
npm run dev
```

- **Web**: http://localhost:3000
- **API**: http://localhost:3001
- **API Health**: http://localhost:3001/health

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/analyze` | Paste an Instagram Reel URL for AI analysis |
| `/trending` | Browse trending Reels with viral breakdowns |

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/trending` | Paginated trending reels (`?category=&sort=&page=`) |
| `GET` | `/api/trending/:id` | Single reel + triggers AI analysis |
| `GET` | `/api/trending/:id/analysis` | Poll for analysis (`{ pending: true }` or analysis) |
| `POST` | `/api/analyze-url` | Body: `{ url }` — analyze user's Instagram post |
| `GET` | `/api/admin/stats` | Stats (totals, last scrape, top category) |
| `POST` | `/api/admin/scrape` | Manually trigger the trending scraper |
| `GET` | `/api/admin/queue` | Bull queue status |

---

## Architecture

### How "Analyze My Post" works

1. User pastes Instagram URL  
2. Backend extracts the shortcode and launches Puppeteer (stealth mode)  
3. Puppeteer intercepts Instagram's internal API responses to get real metrics  
4. Metrics are sent to Claude with a structured prompt  
5. Claude returns scored feedback, rewritten caption, and a reshoot brief  
6. Results are cached for 24 hours by Instagram post ID  

### How "Trending Feed" works

1. A `node-cron` job runs every 6 hours  
2. Puppeteer scrapes Instagram's hashtag explore pages (6 categories × 3 hashtags)  
3. Reels with > 50,000 views are upserted to PostgreSQL  
4. A Bull queue dispatches Claude analysis jobs for new reels  
5. Frontend polls `/api/trending/:id/analysis` every 2 seconds until ready  

### Viral Score formula

```
score = (likeRate × 2.5) + (commentRate × 4)
      + viewBonus (0–30 based on volume)
      + audioBonus (12 if trending audio)
      + recencyBonus (0–15 based on hours since posted)
```

---

## Development

```bash
# Run only the API
npm run dev -w apps/api

# Run only the web
npm run dev -w apps/web

# Prisma Studio (DB GUI)
npm run db:studio

# Manually trigger scraper via API
curl -X POST http://localhost:3001/api/admin/scrape
```

---

## Tech Stack

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **AI**: Anthropic Claude (claude-sonnet-4-5)
- **Scraping**: Puppeteer + puppeteer-extra-plugin-stealth
- **Queue**: Bull + Redis
- **Scheduler**: node-cron
- **Monorepo**: npm workspaces

---

## Notes

- Instagram scraping requires a real browser environment. Headless Chromium (Puppeteer) is used with stealth plugins to avoid bot detection.
- The scraper respects rate limits: 8-second delays between hashtags, random sleep jitter.
- All analysis results are cached. Trending reel analyses are generated once and stored; user post analyses are cached for 24 hours.
- The `ANTHROPIC_API_KEY` is required for the analysis features to work.
