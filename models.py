from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class SentimentLevel(str, Enum):
    VERY_BULLISH = "very_bullish"
    BULLISH = "bullish"
    NEUTRAL = "neutral"
    BEARISH = "bearish"
    VERY_BEARISH = "very_bearish"

class RecommendationLevel(str, Enum):
    STRONG_BUY = "strong_buy"
    BUY = "buy"
    HOLD = "hold"
    SELL = "sell"
    STRONG_SELL = "strong_sell"

class MarketOverview(BaseModel):
    sentiment: SentimentLevel = SentimentLevel.NEUTRAL
    sentiment_score: float = Field(default=50.0, ge=0, le=100)  # 0=extreme fear, 100=extreme greed
    key_drivers: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    summary: str = ""
    updated_at: datetime = Field(default_factory=datetime.now)

class SectorRecommendation(BaseModel):
    name: str
    heat_score: float = Field(default=0.0, ge=0, le=100)  # 0-100 hotness
    trend: str = ""  # short-term, medium-term, long-term
    representative_stocks: list[str] = Field(default_factory=list)
    catalyst: str = ""
    risk: str = ""
    news_count: int = 0

class StockRecommendation(BaseModel):
    ticker: str
    company_name: str = ""
    recommendation: RecommendationLevel = RecommendationLevel.HOLD
    current_price: Optional[float] = None
    target_price: Optional[float] = None
    upside_pct: Optional[float] = None
    stop_loss: Optional[float] = None
    reasons: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    catalysts: list[str] = Field(default_factory=list)
    sentiment_score: float = 50.0
    news_sentiment: str = ""
    options_signal: str = ""
    wsb_mention_count: int = 0
    sector: str = ""
    time_horizon: str = ""  # e.g., "1-2 weeks", "1 month"

class NewsItem(BaseModel):
    title: str
    source: str = ""
    published_at: Optional[datetime] = None
    summary: str = ""
    tickers: list[str] = Field(default_factory=list)
    sentiment: str = ""  # positive, negative, neutral
    url: str = ""

class WSBSentiment(BaseModel):
    overall_sentiment: str = ""
    top_tickers: list[dict] = Field(default_factory=list)  # [{ticker, mentions, sentiment}]
    hot_topics: list[str] = Field(default_factory=list)
    summary: str = ""
    updated_at: datetime = Field(default_factory=datetime.now)

class DashboardData(BaseModel):
    market_overview: MarketOverview = Field(default_factory=MarketOverview)
    sectors: list[SectorRecommendation] = Field(default_factory=list)
    recommendations: list[StockRecommendation] = Field(default_factory=list)
    news: list[NewsItem] = Field(default_factory=list)
    wsb: WSBSentiment = Field(default_factory=WSBSentiment)
    last_refresh: datetime = Field(default_factory=datetime.now)
    data_status: str = "initializing"  # initializing, loading, ready, error
    error_message: str = ""
