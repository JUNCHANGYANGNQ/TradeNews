import os
from dotenv import load_dotenv

load_dotenv()

# MCP Server
MCP_SERVER_URL = "https://mcp.sellthenews.org/mcp"

# Data refresh interval (seconds)
DATA_REFRESH_INTERVAL = 300  # 5 minutes

# Cache TTL (seconds)
CACHE_TTL = 300

# Server
HOST = "localhost"
PORT = 8000

# LLM Configuration (pluggable - set later)
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "")  # rule_based, openai, claude, gemini
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
