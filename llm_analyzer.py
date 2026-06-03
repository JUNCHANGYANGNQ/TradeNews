from abc import ABC, abstractmethod
from typing import Any, Optional
import logging
from models import MarketOverview, StockRecommendation, SectorRecommendation

logger = logging.getLogger(__name__)

class LLMAnalyzer(ABC):
    """Abstract base class for LLM-powered market analysis."""
    
    @abstractmethod
    async def analyze_market(self, raw_data: dict) -> dict:
        """Analyze market data and return insights."""
        ...
    
    @abstractmethod
    async def generate_recommendation(self, ticker: str, data: dict) -> Optional[StockRecommendation]:
        """Generate a stock recommendation."""
        ...
    
    @abstractmethod
    async def identify_sectors(self, data: dict) -> list[SectorRecommendation]:
        """Identify hot sectors."""
        ...

class RuleBasedAnalyzer(LLMAnalyzer):
    """Default rule-based analyzer. No LLM required."""
    
    async def analyze_market(self, raw_data: dict) -> dict:
        # Rule-based analysis is handled in DataProcessor
        return {"status": "rule_based", "message": "Using rule-based analysis"}
    
    async def generate_recommendation(self, ticker: str, data: dict) -> Optional[StockRecommendation]:
        return None  # Handled by DataProcessor
    
    async def identify_sectors(self, data: dict) -> list[SectorRecommendation]:
        return []  # Handled by DataProcessor

class OpenAIAnalyzer(LLMAnalyzer):
    """OpenAI GPT-powered analyzer. Requires OPENAI_API_KEY."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        logger.info("OpenAI Analyzer initialized (not yet implemented)")
    
    async def analyze_market(self, raw_data: dict) -> dict:
        # TODO: Implement OpenAI-based analysis
        raise NotImplementedError("OpenAI analyzer not yet implemented")
    
    async def generate_recommendation(self, ticker: str, data: dict) -> Optional[StockRecommendation]:
        raise NotImplementedError("OpenAI analyzer not yet implemented")
    
    async def identify_sectors(self, data: dict) -> list[SectorRecommendation]:
        raise NotImplementedError("OpenAI analyzer not yet implemented")

class ClaudeAnalyzer(LLMAnalyzer):
    """Anthropic Claude-powered analyzer. Requires ANTHROPIC_API_KEY."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        logger.info("Claude Analyzer initialized (not yet implemented)")
    
    async def analyze_market(self, raw_data: dict) -> dict:
        raise NotImplementedError("Claude analyzer not yet implemented")
    
    async def generate_recommendation(self, ticker: str, data: dict) -> Optional[StockRecommendation]:
        raise NotImplementedError("Claude analyzer not yet implemented")
    
    async def identify_sectors(self, data: dict) -> list[SectorRecommendation]:
        raise NotImplementedError("Claude analyzer not yet implemented")

class GeminiAnalyzer(LLMAnalyzer):
    """Google Gemini-powered analyzer. Requires GOOGLE_API_KEY."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        logger.info("Gemini Analyzer initialized (not yet implemented)")
    
    async def analyze_market(self, raw_data: dict) -> dict:
        raise NotImplementedError("Gemini analyzer not yet implemented")
    
    async def generate_recommendation(self, ticker: str, data: dict) -> Optional[StockRecommendation]:
        raise NotImplementedError("Gemini analyzer not yet implemented")
    
    async def identify_sectors(self, data: dict) -> list[SectorRecommendation]:
        raise NotImplementedError("Gemini analyzer not yet implemented")
    
class DeepSeekAnalyzer(LLMAnalyzer):
    """DeepSeek-powered analyzer. Requires DEEPSEEK_API_KEY."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        logger.info("DeepSeek Analyzer initialized (not yet implemented)")
    
    async def analyze_market(self, raw_data: dict) -> dict:
        raise NotImplementedError("DeepSeek analyzer not yet implemented")
    
    async def generate_recommendation(self, ticker: str, data: dict) -> Optional[StockRecommendation]:
        raise NotImplementedError("DeepSeek analyzer not yet implemented")
    
    async def identify_sectors(self, data: dict) -> list[SectorRecommendation]:
        raise NotImplementedError("DeepSeek analyzer not yet implemented")

def create_analyzer(provider: str = "rule_based", **kwargs) -> LLMAnalyzer:
    """Factory function to create the appropriate analyzer."""
    analyzers = {
        "rule_based": lambda: RuleBasedAnalyzer(),
        "openai": lambda: OpenAIAnalyzer(api_key=kwargs.get("api_key", "")),
        "claude": lambda: ClaudeAnalyzer(api_key=kwargs.get("api_key", "")),
        "gemini": lambda: GeminiAnalyzer(api_key=kwargs.get("api_key", "")),
        "deepseek": lambda: DeepSeekAnalyzer(api_key=kwargs.get("api_key", "")),
    }
    
    if provider not in analyzers:
        logger.warning(f"Unknown provider '{provider}', falling back to rule_based")
        provider = "rule_based"
    
    return analyzers[provider]()
