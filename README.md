# Market Analysis Agent

**AI-powered market analysis dashboard** — connects to the SellTheNews MCP (Model Context Protocol) server to fetch live financial data, news, options flow, and social sentiment, then processes it into a browsable dashboard with sector heat maps, stock recommendations, and real-time sentiment gauges.

> 一个基于 SellTheNews MCP 协议的 AI 市场分析仪表盘。实时获取金融市场数据、新闻、期权数据和社交媒体情绪，生成可交互的市场概览、板块热度评分和个股推荐。

---

## Overview

The Market Analysis Agent pulls data from multiple sources via a single MCP endpoint and presents a unified view of market conditions. It runs as a **FastAPI** server with a self-contained static frontend, so once it launches, you interact with it entirely through the browser.

| Component | Role |
|-----------|------|
| `mcp_client.py` | Streamable HTTP client to the SellTheNews MCP server; handles connection lifecycle and response caching |
| `data_processor.py` | Keyword-based sentiment analysis, ticker extraction, sector mapping, and dashboard data assembly |
| `llm_analyzer.py` | Pluggable analyzer abstraction (rule-based by default; stubs for OpenAI / Claude / Gemini / DeepSeek) |
| `api_server.py` | FastAPI application; serves the frontend and exposes REST endpoints for dashboard data |
| `models.py` | Pydantic models — `MarketOverview`, `SectorRecommendation`, `StockRecommendation`, `NewsItem`, `WSBSentiment`, `DashboardData` |
| `static/` | Vanilla HTML/CSS/JS frontend with responsive layout, sentiment gauge, and sector heat map |
| `config.py` | Environment-variable driven configuration |

### Data sources (via SellTheNews MCP)

- Live news feed
- Daily & intraday market recaps
- Weekly recap
- WallStreetBets sentiment analysis
- Stock-specific news
- Options flow data
- Trump-related posts
- Free-text news search

---

## Quick start

### Requirements

- Python 3.11+
- A valid SellTheNews MCP server endpoint (default: `https://mcp.sellthenews.org/mcp`)

### Setup

```bash
# Clone the repository
git clone <repo-url> && cd SelfTrading

# Create and activate a virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1   # Windows
# source venv/bin/activate    # Linux / macOS

# Install dependencies
pip install -r requirements.txt

# (Optional) Configure environment
# Edit .env to set API keys if using LLM-based analysis
```

### Run

```bash
python main.py
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

The server connects to the MCP endpoint on startup and begins a periodic data refresh loop (default: every 5 minutes). The dashboard loads as soon as the first data batch is ready.

---

## API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Serves the dashboard frontend |
| `GET /api/dashboard` | Complete dashboard data (all sections) |
| `GET /api/market-overview` | Market sentiment, key drivers, risks |
| `GET /api/sectors` | Sector heat scores and trending sectors |
| `GET /api/recommendations` | Stock recommendations with sentiment |
| `GET /api/news/live` | Live news feed |
| `GET /api/wsb` | WallStreetBets sentiment summary |
| `GET /api/stock/{ticker}` | Detailed analysis for a single stock (news + options + sentiment) |
| `GET /api/news/search?q=keyword` | Search news by keyword |
| `POST /api/refresh` | Force a manual data refresh |
| `GET /api/status` | Server / MCP connection status |

---

## Configuration

All configuration is in `config.py` and can be overridden via the `.env` file.

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `""` (uses rule-based) | `openai`, `claude`, `gemini`, `deepseek`, or leave empty for rule-based |
| `DEEPSEEK_API_KEY` | — | API key for DeepSeek |
| `OPENAI_API_KEY` | — | API key for OpenAI |
| `ANTHROPIC_API_KEY` | — | API key for Anthropic Claude |
| `GOOGLE_API_KEY` | — | API key for Google Gemini |

**Note:** LLM-powered analyzers are scaffolded but not yet implemented. The system currently uses the built-in keyword-based (rule-based) analyzer, which does not require any API key.

---

## Project structure

```
SelfTrading/
├── static/
│   ├── index.html      # Dashboard frontend HTML
│   ├── index.css       # Dashboard styles
│   └── app.js          # Frontend logic (fetch, render, auto-refresh)
├── .env                # Environment variables (API keys, etc.)
├── .gitignore
├── api_server.py       # FastAPI server and REST endpoints
├── config.py           # Configuration
├── data_processor.py   # Sentiment analysis, sector mapping, data assembly
├── llm_analyzer.py     # Pluggable LLM analyzer framework
├── main.py             # Entry point
├── mcp_client.py       # MCP protocol client
├── models.py           # Pydantic data models
├── requirements.txt    # Python dependencies
└── README.md
```

---

## How it works

1. **Startup** — `main.py` launches the FastAPI server. The `lifespan` handler in `api_server.py` connects to the MCP server and starts a background task that refreshes all data every 5 minutes.

2. **Data collection** — `MCPClient` calls each available tool on the SellTheNews server (live news, daily recap, WSB analysis, etc.) and caches responses with a configurable TTL.

3. **Processing** — `DataProcessor` takes the raw text responses and runs them through keyword-based sentiment detection, ticker extraction (both `$TICKER` and known-ticker matching), and sector clustering. The result is a structured `DashboardData` object.

4. **Serving** — The frontend polls `GET /api/dashboard` (or individual endpoints) and renders the data into a dark-themed responsive dashboard with animated gauges, heat maps, and recommendation cards.

5. **LLM pluggability** — The `LLMAnalyzer` abstract base class defines the interface for market analysis. Currently the default `RuleBasedAnalyzer` is active; other providers (OpenAI, Claude, Gemini, DeepSeek) have stubs ready to be implemented.

### Sentiment analysis approach

The rule-based analyzer uses a weighted keyword dictionary (bilingual — English and Chinese financial keywords) to compute a sentiment score from 0 (extreme fear) to 100 (extreme greed). Scores are mapped to five levels: `very_bullish`, `bullish`, `neutral`, `bearish`, `very_bearish`.

### Sector mapping

A static mapping of ~80 well-known tickers to 10 sector groups (Technology, AI & Semiconductors, Electric Vehicles, Finance, Energy, Healthcare, Consumer, Crypto & Fintech, Defense & Aerospace, Social Media & Entertainment) enables automatic sector heat scoring based on mention frequency.

---

## License

MIT

---

*Built with [FastAPI](https://fastapi.tiangolo.com/), [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk), and [SellTheNews MCP](https://mcp.sellthenews.org/).*
