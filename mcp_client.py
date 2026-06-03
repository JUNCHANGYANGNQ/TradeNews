import asyncio
import logging
import time
from typing import Any, Optional
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamablehttp_client
import config

logger = logging.getLogger(__name__)


class MCPClient:
    def __init__(self):
        self._session: Optional[ClientSession] = None
        self._cache: dict[str, tuple[float, Any]] = {}  # key -> (timestamp, data)
        self._connected = False
        self._read = None
        self._write = None
        self._cm = None
        self._session_cm = None
        self._lock = asyncio.Lock()  # Serialize MCP calls (single session)

    def _get_cached(self, key: str) -> Optional[Any]:
        if key in self._cache:
            ts, data = self._cache[key]
            if time.time() - ts < config.CACHE_TTL:
                return data
        return None

    def _set_cache(self, key: str, data: Any):
        self._cache[key] = (time.time(), data)

    async def connect(self):
        """Establish Streamable HTTP connection to MCP server."""
        try:
            logger.info(f"Connecting to MCP server: {config.MCP_SERVER_URL}")
            self._cm = streamablehttp_client(url=config.MCP_SERVER_URL)
            streams = await self._cm.__aenter__()
            self._read, self._write, _ = streams
            self._session = ClientSession(self._read, self._write)
            self._session_cm = self._session
            await self._session_cm.__aenter__()
            await self._session.initialize()
            self._connected = True

            # List available tools
            tools = await self._session.list_tools()
            tool_names = [t.name for t in tools.tools]
            logger.info(f"Connected! Available tools ({len(tool_names)}): {tool_names}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to MCP server: {e}")
            self._connected = False
            return False

    async def disconnect(self):
        """Close MCP connection."""
        try:
            if self._session_cm:
                await self._session_cm.__aexit__(None, None, None)
            if self._cm:
                await self._cm.__aexit__(None, None, None)
        except Exception as e:
            logger.error(f"Error disconnecting: {e}")
        finally:
            self._connected = False
            self._session = None
            self._session_cm = None

    async def _call_tool(self, tool_name: str, arguments: dict = None) -> Any:
        """Call an MCP tool with error handling and caching."""
        cache_key = f"{tool_name}:{str(arguments or {})}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            logger.debug(f"Cache hit for {tool_name}")
            return cached

        async with self._lock:
            # Double-check cache after acquiring lock
            cached = self._get_cached(cache_key)
            if cached is not None:
                return cached

            if not self._connected or not self._session:
                logger.warning("Not connected to MCP server, attempting reconnect...")
                success = await self.connect()
                if not success:
                    return None

            try:
                logger.info(f"Calling MCP tool: {tool_name}")
                result = await self._session.call_tool(tool_name, arguments=arguments or {})
                # Extract text content from the result
                data = None
                if result and result.content:
                    text_parts = []
                    for block in result.content:
                        if hasattr(block, 'text'):
                            text_parts.append(block.text)
                    data = "\n".join(text_parts) if text_parts else None

                self._set_cache(cache_key, data)
                logger.info(f"Tool {tool_name} returned {len(data) if data else 0} chars")
                return data
            except Exception as e:
                logger.error(f"Error calling tool {tool_name}: {e}")
                # Mark as disconnected so next call retries
                self._connected = False
                return None

    async def get_live_news(self) -> Optional[str]:
        return await self._call_tool("get_live_news")

    async def get_daily_recap(self) -> Optional[str]:
        return await self._call_tool("get_daily_news_recap")

    async def get_intraday_recaps(self) -> Optional[str]:
        return await self._call_tool("get_intraday_news_recaps")

    async def get_options_data(self, ticker: str) -> Optional[str]:
        return await self._call_tool("get_options_data", {"ticker": ticker})

    async def get_stock_news(self, ticker: str) -> Optional[str]:
        return await self._call_tool("get_stock_news", {"ticker": ticker})

    async def get_weekly_recap(self) -> Optional[str]:
        return await self._call_tool("get_weekly_news_recap")

    async def get_wsb_analysis(self) -> Optional[str]:
        return await self._call_tool("get_wsb_analysis")

    async def get_trump_posts(self) -> Optional[str]:
        return await self._call_tool("get_trump_posts")

    async def search_news(self, query: str) -> Optional[str]:
        return await self._call_tool("search_news", {"query": query})

    async def fetch_all_market_data(self) -> dict[str, Any]:
        """Fetch all main market data sources sequentially (MCP sessions are single-threaded)."""
        data = {}
        calls = [
            ("live_news", self.get_live_news),
            ("daily_recap", self.get_daily_recap),
            ("intraday_recaps", self.get_intraday_recaps),
            ("weekly_recap", self.get_weekly_recap),
            ("wsb_analysis", self.get_wsb_analysis),
            ("trump_posts", self.get_trump_posts),
        ]

        for key, func in calls:
            try:
                result = await func()
                data[key] = result
            except Exception as e:
                logger.error(f"Error fetching {key}: {e}")
                data[key] = None

        return data
