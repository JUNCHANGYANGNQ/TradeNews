import asyncio
import logging
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

import config
from models import DashboardData
from mcp_client import MCPClient
from data_processor import DataProcessor
from llm_analyzer import create_analyzer

logger = logging.getLogger(__name__)

# Global instances
mcp_client = MCPClient()
data_processor = DataProcessor()
analyzer = create_analyzer(config.LLM_PROVIDER)

_refresh_task = None

async def refresh_data():
    """Fetch fresh data from MCP and process it."""
    logger.info("Refreshing market data...")
    try:
        raw_data = await mcp_client.fetch_all_market_data()
        await data_processor.process_all(raw_data)
        logger.info(f"Data refreshed successfully at {datetime.now()}")
    except Exception as e:
        logger.error(f"Error refreshing data: {e}")

async def periodic_refresh():
    """Periodically refresh data."""
    while True:
        await refresh_data()
        await asyncio.sleep(config.DATA_REFRESH_INTERVAL)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _refresh_task
    # Startup
    logger.info("Starting Market Analysis Agent...")
    connected = await mcp_client.connect()
    if connected:
        _refresh_task = asyncio.create_task(periodic_refresh())
        logger.info("Periodic data refresh started")
    else:
        logger.warning("MCP connection failed - will retry on first API call")
        # Still start the refresh task, it will retry connection
        _refresh_task = asyncio.create_task(periodic_refresh())
    
    yield
    
    # Shutdown
    if _refresh_task:
        _refresh_task.cancel()
    await mcp_client.disconnect()
    logger.info("Market Analysis Agent stopped")

app = FastAPI(
    title="Market Analysis Agent",
    description="AI-powered market analysis dashboard",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.get("/api/dashboard")
async def get_dashboard():
    """Get complete dashboard data."""
    return data_processor.dashboard_data.model_dump()

@app.get("/api/market-overview")
async def get_market_overview():
    return data_processor.dashboard_data.market_overview.model_dump()

@app.get("/api/sectors")
async def get_sectors():
    return [s.model_dump() for s in data_processor.dashboard_data.sectors]

@app.get("/api/recommendations")
async def get_recommendations():
    return [r.model_dump() for r in data_processor.dashboard_data.recommendations]

@app.get("/api/news/live")
async def get_live_news():
    return [n.model_dump() for n in data_processor.dashboard_data.news]

@app.get("/api/wsb")
async def get_wsb():
    return data_processor.dashboard_data.wsb.model_dump()

@app.get("/api/stock/{ticker}")
async def get_stock(ticker: str):
    ticker = ticker.upper()
    try:
        news = await mcp_client.get_stock_news(ticker)
        options = await mcp_client.get_options_data(ticker)
        from data_processor import analyze_sentiment, extract_key_points
        sent_label, sent_score = analyze_sentiment(f"{news or ''}\n{options or ''}")
        return {
            "ticker": ticker,
            "news": news,
            "options": options,
            "sentiment": sent_label,
            "sentiment_score": sent_score,
            "key_points": extract_key_points(news or "", 5)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/news/search")
async def search_news(q: str = ""):
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
    result = await mcp_client.search_news(q)
    return {"query": q, "results": result}

@app.post("/api/refresh")
async def manual_refresh():
    await refresh_data()
    return {"status": "ok", "refreshed_at": datetime.now().isoformat()}

@app.get("/api/status")
async def get_status():
    return {
        "status": data_processor.dashboard_data.data_status,
        "last_refresh": data_processor.dashboard_data.last_refresh.isoformat(),
        "mcp_connected": mcp_client._connected,
        "llm_provider": config.LLM_PROVIDER,
        "error": data_processor.dashboard_data.error_message
    }
