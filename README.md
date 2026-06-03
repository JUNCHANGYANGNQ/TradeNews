<p align="center">
  <a href="#english">English</a> &nbsp;|&nbsp; <a href="#chinese">中文</a>
</p>

---

<h1 align="center">Market Analysis Agent</h1>

---

<h2 id="english">English</h2>

AI-powered market analysis dashboard — connects to the **SellTheNews MCP** (Model Context Protocol) server to fetch live financial data, news, options flow, and social sentiment, then processes it into a browsable dashboard with sector heat maps, stock recommendations, and real-time sentiment gauges.

---

### Overview

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

#### Data sources (via SellTheNews MCP)

- Live news feed
- Daily & intraday market recaps
- Weekly recap
- WallStreetBets sentiment analysis
- Stock-specific news
- Options flow data
- Trump-related posts
- Free-text news search

---

### Quick start

#### Requirements

- Python 3.11+
- A valid SellTheNews MCP server endpoint (default: `https://mcp.sellthenews.org/mcp`)

#### Setup

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

#### Run

```bash
python main.py
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

The server connects to the MCP endpoint on startup and begins a periodic data refresh loop (default: every 5 minutes). The dashboard loads as soon as the first data batch is ready.

---

### API endpoints

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

### Configuration

All configuration is in `config.py` and can be overridden via the `.env` file.

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `""` (rule-based) | `openai`, `claude`, `gemini`, `deepseek`, or empty for rule-based |
| `DEEPSEEK_API_KEY` | — | API key for DeepSeek |
| `OPENAI_API_KEY` | — | API key for OpenAI |
| `ANTHROPIC_API_KEY` | — | API key for Anthropic Claude |
| `GOOGLE_API_KEY` | — | API key for Google Gemini |

> **Note:** LLM-powered analyzers are scaffolded but not yet implemented. The system currently uses the built-in rule-based analyzer, which does not require any API key.

---

### Project structure

```
SelfTrading/
├── static/
│   ├── index.html     # Dashboard frontend HTML
│   ├── index.css      # Dashboard styles
│   └── app.js         # Frontend logic (fetch, render, auto-refresh)
├── .env               # Environment variables (API keys, etc.)
├── .gitignore
├── api_server.py      # FastAPI server and REST endpoints
├── config.py          # Configuration
├── data_processor.py  # Sentiment analysis, sector mapping, data assembly
├── llm_analyzer.py    # Pluggable LLM analyzer framework
├── main.py            # Entry point
├── mcp_client.py      # MCP protocol client
├── models.py          # Pydantic data models
├── requirements.txt   # Python dependencies
└── README.md
```

---

### How it works

1. **Startup** — `main.py` launches the FastAPI server. The `lifespan` handler in `api_server.py` connects to the MCP server and starts a background task that refreshes all data every 5 minutes.

2. **Data collection** — `MCPClient` calls each available tool on the SellTheNews server (live news, daily recap, WSB analysis, etc.) and caches responses with a configurable TTL.

3. **Processing** — `DataProcessor` takes the raw text responses and runs them through keyword-based sentiment detection, ticker extraction (both `$TICKER` and known-ticker matching), and sector clustering. The result is a structured `DashboardData` object.

4. **Serving** — The frontend polls `GET /api/dashboard` (or individual endpoints) and renders the data into a dark-themed responsive dashboard with animated gauges, heat maps, and recommendation cards.

5. **LLM pluggability** — The `LLMAnalyzer` abstract base class defines the interface for market analysis. Currently the default `RuleBasedAnalyzer` is active; other providers (OpenAI, Claude, Gemini, DeepSeek) have stubs ready to be implemented.

#### Sentiment analysis approach

The rule-based analyzer uses a weighted keyword dictionary (bilingual — English and Chinese financial keywords) to compute a sentiment score from 0 (extreme fear) to 100 (extreme greed). Scores map to five levels: `very_bullish`, `bullish`, `neutral`, `bearish`, `very_bearish`.

#### Sector mapping

A static mapping of ~80 well-known tickers to 10 sector groups (Technology, AI & Semiconductors, Electric Vehicles, Finance, Energy, Healthcare, Consumer, Crypto & Fintech, Defense & Aerospace, Social Media & Entertainment) enables automatic sector heat scoring based on mention frequency.

---

### License

MIT

---

---

<h2 id="chinese">中文</h2>

<p align="center">
  <b>Market Analysis Agent</b> — 基于 SellTheNews MCP 协议的 AI 市场分析仪表盘
</p>

实时获取金融市场数据、新闻、期权数据和社交媒体情绪，生成可交互的市场概览、板块热度评分和个股推荐。

---

### 概述

系统通过一个 MCP 端点聚合多源数据，在浏览器中呈现统一的市场视图。后端为 **FastAPI** 服务，前端为纯静态 HTML/CSS/JS，启动后完全通过浏览器交互。

| 模块 | 职责 |
|------|------|
| `mcp_client.py` | 基于 Streamable HTTP 的 MCP 客户端，负责连接管理和响应缓存 |
| `data_processor.py` | 基于关键词的情感分析、股票代码提取、板块映射、仪表盘数据组装 |
| `llm_analyzer.py` | 可插拔的分析器抽象层（默认基于规则；已预留 OpenAI / Claude / Gemini / DeepSeek 接口） |
| `api_server.py` | FastAPI 应用，提供前端静态文件服务和 REST 数据接口 |
| `models.py` | Pydantic 数据模型 — 市场概览、板块推荐、个股推荐、新闻、WSB 情绪、仪表盘数据 |
| `static/` | 纯前端页面，自适应暗色主题，含情感仪表盘和板块热力图 |
| `config.py` | 基于环境变量的配置管理 |

#### 数据来源（通过 SellTheNews MCP）

- 实时新闻流
- 日间/盘中市场总结
- 每周总结
- WallStreetBets 情绪分析
- 个股新闻
- 期权数据
- Trump 相关帖子
- 关键词新闻搜索

---

### 快速开始

#### 环境要求

- Python 3.11+
- 可用的 SellTheNews MCP 服务器地址（默认 `https://mcp.sellthenews.org/mcp`）

#### 安装

```bash
# 克隆仓库
git clone <repo-url> && cd SelfTrading

# 创建并激活虚拟环境
python -m venv venv
.\venv\Scripts\Activate.ps1   # Windows
# source venv/bin/activate    # Linux / macOS

# 安装依赖
pip install -r requirements.txt

# （可选）编辑 .env 配置 API Key
```

#### 启动

```bash
python main.py
```

在浏览器中打开 [http://localhost:8000](http://localhost:8000)。

服务启动后会自动连接 MCP 端点，并开始定时刷新数据（默认每 5 分钟一次）。首批数据到达后仪表盘即刻可用。

---

### API 接口

| 接口 | 说明 |
|------|------|
| `GET /` | 前端仪表盘页面 |
| `GET /api/dashboard` | 完整仪表盘数据 |
| `GET /api/market-overview` | 市场情绪、关键驱动因素、风险 |
| `GET /api/sectors` | 板块热力评分与趋势 |
| `GET /api/recommendations` | 个股推荐与情绪分析 |
| `GET /api/news/live` | 实时新闻 |
| `GET /api/wsb` | WallStreetBets 情绪摘要 |
| `GET /api/stock/{ticker}` | 单只股票详细分析（新闻 + 期权 + 情绪） |
| `GET /api/news/search?q=keyword` | 按关键词搜索新闻 |
| `POST /api/refresh` | 手动触发数据刷新 |
| `GET /api/status` | 服务器 / MCP 连接状态 |

---

### 配置项

配置集中在 `config.py`，可通过 `.env` 文件覆盖。

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_PROVIDER` | `""`（使用规则引擎） | `openai`、`claude`、`gemini`、`deepseek`，留空则使用规则引擎 |
| `DEEPSEEK_API_KEY` | — | DeepSeek API 密钥 |
| `OPENAI_API_KEY` | — | OpenAI API 密钥 |
| `ANTHROPIC_API_KEY` | — | Anthropic Claude API 密钥 |
| `GOOGLE_API_KEY` | — | Google Gemini API 密钥 |

> **注意：** LLM 分析器目前仅完成框架搭建，尚未实现具体逻辑。当前默认使用基于关键词的规则引擎，无需任何 API Key。

---

### 项目结构

```
SelfTrading/
├── static/
│   ├── index.html     # 仪表盘前端 HTML
│   ├── index.css      # 样式文件
│   └── app.js         # 前端逻辑（数据拉取、渲染、自动刷新）
├── .env               # 环境变量（API Key 等）
├── .gitignore
├── api_server.py      # FastAPI 服务与 REST 接口
├── config.py          # 配置
├── data_processor.py  # 情感分析、板块映射、数据组装
├── llm_analyzer.py    # 可插拔 LLM 分析器框架
├── main.py            # 入口文件
├── mcp_client.py      # MCP 协议客户端
├── models.py          # Pydantic 数据模型
├── requirements.txt   # Python 依赖
└── README.md
```

---

### 工作原理

1. **启动** — `main.py` 启动 FastAPI 服务，`lifespan` 回调连接 MCP 服务器，并在后台启动定时数据刷新任务（每 5 分钟）。

2. **数据采集** — `MCPClient` 依次调用 SellTheNews 服务器上的每个工具接口（实时新闻、日间总结、WSB 分析等），并对响应进行缓存（可配置 TTL）。

3. **数据处理** — `DataProcessor` 接收原始文本响应，依次进行基于关键词的情感检测、股票代码提取（支持 `$TICKER` 格式和已知代码匹配）、板块聚类，最终生成结构化的 `DashboardData` 对象。

4. **前端展示** — 前端定时轮询 `GET /api/dashboard`（或各独立接口），将数据渲染为暗色主题的自适应仪表盘，包含动画仪表盘、热力图和推荐卡片。

5. **LLM 可插拔架构** — `LLMAnalyzer` 抽象基类定义了市场分析的标准接口。当前默认使用 `RuleBasedAnalyzer`；其他分析器（OpenAI、Claude、Gemini、DeepSeek）已预留接口等待实现。

#### 情感分析方法

规则引擎使用中英文双关键词词典，将情感得分映射到 0（极度恐惧）到 100（极度贪婪）之间。分数对应五个等级：`very_bullish`（极度看多）、`bullish`（看多）、`neutral`（中性）、`bearish`（看空）、`very_bearish`（极度看空）。

#### 板块映射

内置约 80 只知名股票的静态板块映射，涵盖 10 个板块（科技、AI与半导体、电动汽车、金融、能源、医疗、消费、加密与金融科技、军工与航天、社交媒体与娱乐），根据提及频率自动计算板块热度评分。

---

### 许可证

MIT

---

*Built with [FastAPI](https://fastapi.tiangolo.com/), [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk), and [SellTheNews MCP](https://mcp.sellthenews.org/).*
