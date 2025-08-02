#!/usr/bin/env python3
"""
Real News Fetcher for PulseIntel
Fetches cryptocurrency news from multiple free RSS sources
"""

import asyncio
import aiohttp
import feedparser
import time
from datetime import datetime
from typing import List, Dict, Any
import re

class RealNewsFetcher:
    def __init__(self):
        self.sources = {
            "CoinDesk": "https://www.coindesk.com/arc/outboundfeeds/rss/",
            "CoinTelegraph": "https://cointelegraph.com/rss",
            "Decrypt": "https://decrypt.co/feed",
            "The Block": "https://www.theblockcrypto.com/rss.xml",
            "CryptoSlate": "https://cryptoslate.com/feed/",
            "Bitcoin Magazine": "https://bitcoinmagazine.com/.rss/full/",
            "NewsBTC": "https://www.newsbtc.com/feed/",
            "CryptoPotato": "https://cryptopotato.com/feed/"
        }
    
    async def fetch_rss_feed(self, session: aiohttp.ClientSession, source_name: str, url: str) -> List[Dict]:
        """Fetch and parse RSS feed from a source"""
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    content = await response.text()
                    feed = feedparser.parse(content)
                    
                    articles = []
                    for entry in feed.entries[:5]:  # Limit to 5 articles per source
                        # Extract publish date
                        published_at = int(time.time() * 1000)  # Default to now
                        if hasattr(entry, 'published_parsed') and entry.published_parsed:
                            published_at = int(time.mktime(entry.published_parsed) * 1000)
                        elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                            published_at = int(time.mktime(entry.updated_parsed) * 1000)
                        
                        # Clean description
                        description = ""
                        if hasattr(entry, 'summary'):
                            description = re.sub(r'<[^>]+>', '', entry.summary)[:200]
                        elif hasattr(entry, 'description'):
                            description = re.sub(r'<[^>]+>', '', entry.description)[:200]
                        
                        article = {
                            "title": entry.title if hasattr(entry, 'title') else "No Title",
                            "description": description,
                            "url": entry.link if hasattr(entry, 'link') else "#",
                            "published_at": published_at,
                            "source": source_name,
                            "sentiment": self.analyze_sentiment(entry.title if hasattr(entry, 'title') else "")
                        }
                        articles.append(article)
                    
                    return articles
                    
        except Exception as e:
            print(f"Error fetching {source_name}: {e}")
            return []
        
        return []
    
    def analyze_sentiment(self, title: str) -> str:
        """Simple sentiment analysis based on keywords"""
        title_lower = title.lower()
        
        positive_keywords = [
            'surge', 'rally', 'bull', 'gain', 'rise', 'breakthrough', 'adoption', 
            'institutional', 'etf', 'approval', 'launch', 'partnership', 'growth',
            'record', 'high', 'milestone', 'success', 'breakthrough', 'innovation'
        ]
        
        negative_keywords = [
            'crash', 'fall', 'bear', 'drop', 'decline', 'hack', 'fraud', 'regulation',
            'ban', 'crackdown', 'warning', 'risk', 'concern', 'investigation', 'lawsuit',
            'scam', 'exploit', 'vulnerability', 'loss', 'plunge', 'collapse'
        ]
        
        positive_score = sum(1 for keyword in positive_keywords if keyword in title_lower)
        negative_score = sum(1 for keyword in negative_keywords if keyword in title_lower)
        
        if positive_score > negative_score:
            return "bullish"
        elif negative_score > positive_score:
            return "bearish"
        else:
            return "neutral"
    
    async def get_all_news(self, limit: int = 20) -> Dict[str, Any]:
        """Fetch news from all sources"""
        try:
            async with aiohttp.ClientSession() as session:
                tasks = []
                for source_name, url in self.sources.items():
                    task = self.fetch_rss_feed(session, source_name, url)
                    tasks.append(task)
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                all_articles = []
                working_sources = []
                
                for i, result in enumerate(results):
                    source_name = list(self.sources.keys())[i]
                    if isinstance(result, list) and result:
                        all_articles.extend(result)
                        working_sources.append(source_name)
                
                # Sort by publish date (newest first)
                all_articles.sort(key=lambda x: x['published_at'], reverse=True)
                
                return {
                    "articles": all_articles[:limit],
                    "total": len(all_articles),
                    "sources": working_sources,
                    "timestamp": int(time.time() * 1000),
                    "real_data": True
                }
                
        except Exception as e:
            print(f"Error in get_all_news: {e}")
            return {
                "error": str(e),
                "articles": [],
                "total": 0,
                "sources": [],
                "real_data": False
            }

# Global instance
news_fetcher = RealNewsFetcher()

async def get_100_percent_real_news(limit: int = 20) -> Dict[str, Any]:
    """Main function to get real news"""
    return await news_fetcher.get_all_news(limit)

# Test function
async def test_news_fetcher():
    """Test the news fetcher"""
    print("Testing Real News Fetcher...")
    news_data = await get_100_percent_real_news(10)
    
    if news_data.get('error'):
        print(f"Error: {news_data['error']}")
    else:
        print(f"✅ Fetched {news_data['total']} articles from {len(news_data['sources'])} sources")
        print(f"Working sources: {', '.join(news_data['sources'])}")
        
        for i, article in enumerate(news_data['articles'][:3]):
            print(f"\n{i+1}. {article['title']}")
            print(f"   Source: {article['source']}")
            print(f"   Sentiment: {article['sentiment']}")

if __name__ == "__main__":
    asyncio.run(test_news_fetcher())