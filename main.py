import uvicorn
import logging
import config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

logger = logging.getLogger(__name__)

def main():
    logger.info("="*60)
    logger.info("  Market Analysis Agent")
    logger.info("  Powered by SellTheNews MCP")
    logger.info(f"  Server: http://{config.HOST}:{config.PORT}")
    logger.info(f"  MCP: {config.MCP_SERVER_URL}")
    logger.info(f"  LLM: {config.LLM_PROVIDER}")
    logger.info("="*60)
    
    uvicorn.run(
        "api_server:app",
        host=config.HOST,
        port=config.PORT,
        reload=False,
        log_level="info"
    )

if __name__ == "__main__":
    main()