import re
import logging
from datetime import datetime
from typing import Optional
from models import *

logger = logging.getLogger(__name__)

# Sector mapping
SECTOR_TICKERS = {
    "Technology": ["AAPL", "MSFT", "GOOGL", "META", "NVDA", "AMD", "AVGO", "TSM", "INTC", "ASML", "CRM", "ORCL", "ADBE", "QCOM"],
    "AI & Semiconductors": ["NVDA", "AMD", "AVGO", "TSM", "INTC", "ASML", "MRVL", "MU", "QCOM", "ARM", "SMCI"],
    "Electric Vehicles": ["TSLA", "RIVN", "LCID", "NIO", "XPEV", "LI"],
    "Finance": ["JPM", "BAC", "GS", "MS", "WFC", "C", "BRK.B", "V", "MA"],
    "Energy": ["XOM", "CVX", "COP", "SLB", "EOG", "OXY"],
    "Healthcare": ["JNJ", "UNH", "PFE", "ABBV", "MRK", "LLY", "TMO"],
    "Consumer": ["AMZN", "WMT", "COST", "TGT", "HD", "NKE", "SBUX", "MCD"],
    "Crypto & Fintech": ["COIN", "MSTR", "SQ", "PYPL", "HOOD", "MARA", "RIOT"],
    "Defense & Aerospace": ["LMT", "RTX", "NOC", "BA", "GD", "GE"],
    "Social Media & Entertainment": ["META", "SNAP", "PINS", "RBLX", "NFLX", "DIS", "SPOT"]
}

# Reverse mapping: ticker -> sector
TICKER_TO_SECTOR = {}
for sector, tickers in SECTOR_TICKERS.items():
    for ticker in tickers:
        if ticker not in TICKER_TO_SECTOR:
            TICKER_TO_SECTOR[ticker] = sector

BULLISH_KEYWORDS = ["bullish", "surge", "rally", "soar", "jump", "gain", "rise", "up", "buy", "upgrade", "beat", "exceed", "outperform", "strong", "growth", "boom", "breakout", "moon", "calls", "long", "上涨", "看涨", "突破", "利好"]
BEARISH_KEYWORDS = ["bearish", "crash", "plunge", "drop", "fall", "down", "sell", "downgrade", "miss", "decline", "weak", "recession", "fear", "risk", "puts", "short", "dump", "下跌", "看跌", "利空", "风险"]

def extract_tickers(text: str) -> list[str]:
    """Extract stock tickers from text."""
    if not text:
        return []
    # Match $TICKER or standalone uppercase 1-5 letter words that look like tickers
    dollar_tickers = re.findall(r'\$([A-Z]{1,5})', text)
    # Also match common tickers mentioned without $
    all_known_tickers = set(TICKER_TO_SECTOR.keys())
    words = re.findall(r'\b([A-Z]{1,5}(?:\.[A-Z])?)\b', text)
    word_tickers = [w for w in words if w in all_known_tickers]
    
    combined = list(dict.fromkeys(dollar_tickers + word_tickers))  # deduplicate, preserve order
    return combined

def analyze_sentiment(text: str) -> tuple[str, float]:
    """Simple keyword-based sentiment analysis. Returns (sentiment_label, score 0-100)."""
    if not text:
        return "neutral", 50.0
    
    text_lower = text.lower()
    bullish_count = sum(1 for kw in BULLISH_KEYWORDS if kw in text_lower)
    bearish_count = sum(1 for kw in BEARISH_KEYWORDS if kw in text_lower)
    total = bullish_count + bearish_count
    
    if total == 0:
        return "neutral", 50.0
    
    ratio = bullish_count / total
    score = ratio * 100
    
    if score >= 70:
        label = "very_bullish" if score >= 85 else "bullish"
    elif score <= 30:
        label = "very_bearish" if score <= 15 else "bearish"
    else:
        label = "neutral"
    
    return label, round(score, 1)

def extract_key_points(text: str, max_points: int = 5) -> list[str]:
    """Extract key bullet points from text."""
    if not text:
        return []
    
    lines = text.strip().split('\n')
    points = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Look for bullet points or numbered items
        cleaned = re.sub(r'^[-*•\d.]+\s*', '', line).strip()
        if cleaned and len(cleaned) > 15 and len(cleaned) < 300:
            points.append(cleaned)
        if len(points) >= max_points:
            break
    
    # If no bullet points found, take the first few sentences
    if not points:
        sentences = re.split(r'[.!?]+', text)
        for s in sentences:
            s = s.strip()
            if s and len(s) > 15:
                points.append(s)
            if len(points) >= max_points:
                break
    
    return points[:max_points]

class DataProcessor:
    def __init__(self):
        self._dashboard_data = DashboardData()
    
    @property
    def dashboard_data(self) -> DashboardData:
        return self._dashboard_data
    
    async def process_all(self, raw_data: dict) -> DashboardData:
        """Process all raw MCP data into dashboard data."""
        try:
            self._dashboard_data.data_status = "loading"
            
            # Process market overview
            self._process_market_overview(raw_data)
            
            # Process news
            self._process_news(raw_data)
            
            # Process WSB sentiment
            self._process_wsb(raw_data)
            
            # Process sectors
            self._process_sectors(raw_data)
            
            # Process stock recommendations
            self._process_recommendations(raw_data)
            
            self._dashboard_data.last_refresh = datetime.now()
            self._dashboard_data.data_status = "ready"
            self._dashboard_data.error_message = ""
            
        except Exception as e:
            logger.error(f"Error processing data: {e}")
            self._dashboard_data.data_status = "error"
            self._dashboard_data.error_message = str(e)
        
        return self._dashboard_data
    
    def _process_market_overview(self, raw_data: dict):
        daily = raw_data.get("daily_recap", "") or ""
        intraday = raw_data.get("intraday_recaps", "") or ""
        combined = f"{daily}\n{intraday}"
        
        sentiment_label, score = analyze_sentiment(combined)
        drivers = extract_key_points(daily, 3)
        
        # Extract risks from bearish context
        risk_text = ""
        for line in combined.split('\n'):
            line_lower = line.lower()
            if any(kw in line_lower for kw in ["risk", "warning", "concern", "fear", "threat", "风险", "警告"]):
                risk_text += line + "\n"
        risks = extract_key_points(risk_text, 3) if risk_text else ["Market volatility remains elevated"]
        
        self._dashboard_data.market_overview = MarketOverview(
            sentiment=SentimentLevel(sentiment_label),
            sentiment_score=score,
            key_drivers=drivers if drivers else ["Awaiting market data..."],
            risks=risks,
            summary=daily[:500] if daily else "Market data loading...",
            updated_at=datetime.now()
        )
    
    def _process_news(self, raw_data: dict):
        live = raw_data.get("live_news", "") or ""
        news_items = []
        
        if live:
            # Parse news entries from the text
            # Split by common delimiters like double newlines or horizontal rules
            entries = re.split(r'\n{2,}|---+|\*{3,}', live)
            for entry in entries[:20]:  # Limit to 20 items
                entry = entry.strip()
                if not entry or len(entry) < 20:
                    continue
                
                lines = entry.split('\n')
                title = lines[0].strip()
                # Clean markdown formatting
                title = re.sub(r'^[#*\-]+\s*', '', title).strip()
                if not title:
                    continue
                
                summary = ' '.join(lines[1:]).strip() if len(lines) > 1 else ""
                tickers = extract_tickers(entry)
                sent_label, _ = analyze_sentiment(entry)
                
                news_items.append(NewsItem(
                    title=title[:200],
                    summary=summary[:500],
                    tickers=tickers,
                    sentiment=sent_label,
                ))
        
        self._dashboard_data.news = news_items
    
    def _process_wsb(self, raw_data: dict):
        wsb = raw_data.get("wsb_analysis", "") or ""
        
        if wsb:
            tickers = extract_tickers(wsb)
            sentiment_label, _ = analyze_sentiment(wsb)
            
            top_tickers = []
            for ticker in tickers[:10]:
                count = wsb.upper().count(ticker)
                t_sentiment, _ = analyze_sentiment(
                    '\n'.join(line for line in wsb.split('\n') if ticker in line.upper())
                )
                top_tickers.append({
                    "ticker": ticker,
                    "mentions": count,
                    "sentiment": t_sentiment
                })
            top_tickers.sort(key=lambda x: x["mentions"], reverse=True)
            
            hot_topics = extract_key_points(wsb, 5)
            
            self._dashboard_data.wsb = WSBSentiment(
                overall_sentiment=sentiment_label,
                top_tickers=top_tickers,
                hot_topics=hot_topics,
                summary=wsb[:800],
                updated_at=datetime.now()
            )
    
    def _process_sectors(self, raw_data: dict):
        """Identify hot sectors from all data."""
        all_text = ' '.join(str(v) for v in raw_data.values() if v)
        mentioned_tickers = extract_tickers(all_text)
        
        sector_scores = {}
        for ticker in mentioned_tickers:
            sector = TICKER_TO_SECTOR.get(ticker)
            if sector:
                if sector not in sector_scores:
                    sector_scores[sector] = {"tickers": [], "count": 0}
                if ticker not in sector_scores[sector]["tickers"]:
                    sector_scores[sector]["tickers"].append(ticker)
                sector_scores[sector]["count"] += all_text.upper().count(ticker)
        
        sectors = []
        if sector_scores:
            max_count = max(s["count"] for s in sector_scores.values()) or 1
            for name, info in sector_scores.items():
                heat = min(100, (info["count"] / max_count) * 100)
                # Get sector-specific text for sentiment
                sector_text = '\n'.join(
                    line for line in all_text.split('\n')
                    if any(t in line.upper() for t in info["tickers"])
                )
                sent_label, _ = analyze_sentiment(sector_text)
                trend = "bullish" if sent_label in ["very_bullish", "bullish"] else "bearish" if sent_label in ["very_bearish", "bearish"] else "neutral"
                
                sectors.append(SectorRecommendation(
                    name=name,
                    heat_score=round(heat, 1),
                    trend=trend,
                    representative_stocks=info["tickers"][:5],
                    news_count=info["count"]
                ))
        
        sectors.sort(key=lambda x: x.heat_score, reverse=True)
        self._dashboard_data.sectors = sectors[:8]
    
    def _process_recommendations(self, raw_data: dict):
        """Generate stock recommendations based on mention frequency and sentiment."""
        all_text = ' '.join(str(v) for v in raw_data.values() if v)
        tickers = extract_tickers(all_text)
        
        ticker_counts = {}
        for ticker in tickers:
            ticker_counts[ticker] = ticker_counts.get(ticker, 0) + 1
        
        # Sort by mention count
        sorted_tickers = sorted(ticker_counts.items(), key=lambda x: x[1], reverse=True)
        
        recommendations = []
        for ticker, count in sorted_tickers[:15]:
            # Get ticker-specific text
            ticker_lines = [line for line in all_text.split('\n') if ticker in line.upper()]
            ticker_text = '\n'.join(ticker_lines)
            sent_label, sent_score = analyze_sentiment(ticker_text)
            
            # Map sentiment to recommendation
            if sent_score >= 75:
                rec = RecommendationLevel.STRONG_BUY
            elif sent_score >= 60:
                rec = RecommendationLevel.BUY
            elif sent_score <= 25:
                rec = RecommendationLevel.STRONG_SELL
            elif sent_score <= 40:
                rec = RecommendationLevel.SELL
            else:
                rec = RecommendationLevel.HOLD
            
            sector = TICKER_TO_SECTOR.get(ticker, "Other")
            reasons = [line.strip() for line in ticker_lines[:3] if len(line.strip()) > 20]
            
            recommendations.append(StockRecommendation(
                ticker=ticker,
                recommendation=rec,
                sentiment_score=sent_score,
                news_sentiment=sent_label,
                wsb_mention_count=count,
                sector=sector,
                reasons=reasons[:3],
                risks=["Market volatility", "Sector rotation risk", "Earnings uncertainty"],
            ))
        
        self._dashboard_data.recommendations = recommendations
