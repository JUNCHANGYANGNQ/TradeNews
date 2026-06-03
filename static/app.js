/* ============================================================
   Market Analysis Agent — Dashboard Application
   ============================================================
   Fetches data from local FastAPI backend and renders a
   premium financial dashboard with real-time updates.
   ============================================================ */

'use strict';

// ─── API Endpoints ──────────────────────────────────────────
const API = {
    dashboard:      '/api/dashboard',
    marketOverview: '/api/market-overview',
    sectors:        '/api/sectors',
    recommendations:'/api/recommendations',
    news:           '/api/news/live',
    wsb:            '/api/wsb',
    stock:          (ticker) => `/api/stock/${ticker}`,
    search:         (q) => `/api/news/search?q=${encodeURIComponent(q)}`,
    refresh:        '/api/refresh',
    status:         '/api/status'
};

// ─── Constants ──────────────────────────────────────────────
const AUTO_REFRESH_INTERVAL = 30_000; // 30 seconds
const GAUGE_ARC_LENGTH      = 251.2;  // half-circle arc for r=80
const ANIMATE_DURATION      = 800;    // ms for number counting

// ─── State ──────────────────────────────────────────────────
let refreshTimer   = null;
let currentFilter  = 'all';
let dashboardData  = null;
let isLoading      = false;


/* ============================================================
   DOM References
   ============================================================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    statusIndicator: $('#status-indicator'),
    statusText:      $('#status-text'),
    lastUpdate:      $('#last-update'),
    refreshBtn:      $('#refresh-btn'),
    sentimentBadge:  $('#sentiment-badge'),
    gaugeFill:       $('#gauge-fill'),
    gaugeValue:      $('#gauge-value'),
    driverList:      $('#driver-list'),
    riskList:        $('#risk-list'),
    sectorsGrid:     $('#sectors-grid'),
    recList:         $('#recommendations-list'),
    newsFeed:        $('#news-feed'),
    wsbContent:      $('#wsb-content'),
    modal:           $('#stock-modal'),
    modalBody:       $('#modal-body'),
    modalClose:      $('#modal-close'),
    filterBtns:      $$('.filter-btn')
};


/* ============================================================
   Utility Functions
   ============================================================ */

/**
 * Format a date to HH:MM:SS string.
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '--:--:--';
    return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Return a human-readable relative time string (Chinese).
 * @param {string|Date} dateStr
 * @returns {string}
 */
function timeAgo(dateStr) {
    if (!dateStr) return '';
    const now  = Date.now();
    const past = new Date(dateStr).getTime();
    if (isNaN(past)) return '';
    const diff = Math.max(0, now - past);
    const secs = Math.floor(diff / 1000);
    if (secs < 60)   return `${secs}秒前`;
    const mins = Math.floor(secs / 60);
    if (mins < 60)   return `${mins}分钟前`;
    const hrs  = Math.floor(mins / 60);
    if (hrs < 24)    return `${hrs}小时前`;
    const days = Math.floor(hrs / 24);
    return `${days}天前`;
}

/**
 * Animate a number counting up in an element.
 * @param {HTMLElement} el   - target element
 * @param {number}      target - target number
 * @param {number}      duration - animation ms
 */
function animateNumber(el, target, duration = ANIMATE_DURATION) {
    if (!el) return;
    const start = parseFloat(el.textContent) || 0;
    if (start === target) { el.textContent = target; return; }
    const startTime = performance.now();
    const diff = target - start;

    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + diff * eased);
        el.textContent = current;
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

/**
 * Get the theme color for a sentiment value.
 * @param {string|number} sentiment
 * @returns {string} CSS color
 */
function getSentimentColor(sentiment) {
    if (typeof sentiment === 'number') {
        if (sentiment >= 60) return 'var(--green)';
        if (sentiment <= 40) return 'var(--red)';
        return 'var(--gold)';
    }
    const s = String(sentiment).toLowerCase();
    if (['bullish', 'positive', 'buy', 'strong_buy', 'greed', 'extreme_greed'].includes(s)) return 'var(--green)';
    if (['bearish', 'negative', 'sell', 'strong_sell', 'fear', 'extreme_fear'].includes(s))  return 'var(--red)';
    return 'var(--gold)';
}

/**
 * Get the CSS class for a sentiment string.
 * @param {string} sentiment
 * @returns {'positive'|'negative'|'neutral'}
 */
function getSentimentClass(sentiment) {
    const s = String(sentiment).toLowerCase();
    if (['bullish', 'positive', 'buy', 'strong_buy', 'greed', 'extreme_greed'].includes(s)) return 'positive';
    if (['bearish', 'negative', 'sell', 'strong_sell', 'fear', 'extreme_fear'].includes(s))  return 'negative';
    return 'neutral';
}

/**
 * Return Chinese label for a recommendation level.
 * @param {string} rec
 * @returns {string}
 */
function getRecommendationLabel(rec) {
    const map = {
        'strong_buy':  '强烈推荐',
        'buy':         '推荐买入',
        'hold':        '持有观望',
        'neutral':     '中性',
        'sell':        '建议卖出',
        'strong_sell': '强烈卖出'
    };
    return map[String(rec).toLowerCase()] || rec || '--';
}

/**
 * Return CSS color variable for a recommendation level.
 * @param {string} rec
 * @returns {string}
 */
function getRecommendationColor(rec) {
    const s = String(rec).toLowerCase();
    if (s === 'strong_buy' || s === 'buy')       return 'var(--green)';
    if (s === 'hold' || s === 'neutral')         return 'var(--gold)';
    if (s === 'sell' || s === 'strong_sell')      return 'var(--red)';
    return 'var(--text-secondary)';
}

/**
 * Map recommendation to a filter group.
 * @param {string} rec
 * @returns {'buy'|'hold'|'sell'}
 */
function getRecFilterGroup(rec) {
    const s = String(rec).toLowerCase();
    if (s === 'strong_buy' || s === 'buy') return 'buy';
    if (s === 'sell' || s === 'strong_sell') return 'sell';
    return 'hold';
}

/**
 * Sanitize text to prevent XSS when injecting via innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Safe JSON fetch with error handling.
 * @param {string} url
 * @param {object} opts
 * @returns {Promise<any>}
 */
async function safeFetch(url, opts = {}) {
    const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        ...opts
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
}


/* ============================================================
   Status Management
   ============================================================ */

/**
 * Update the header status indicator.
 * @param {'connected'|'loading'|'error'} state
 * @param {string} [text]
 */
function setStatus(state, text) {
    const el = dom.statusIndicator;
    if (!el) return;
    el.classList.remove('connected', 'loading', 'error');
    el.classList.add(state);
    if (dom.statusText) {
        dom.statusText.textContent = text || {
            connected: 'Live',
            loading:   'Loading...',
            error:     'Disconnected'
        }[state] || state;
    }
}

/**
 * Update the "last update" timestamp in the header.
 */
function setLastUpdate() {
    if (dom.lastUpdate) {
        dom.lastUpdate.textContent = formatTime(new Date());
    }
}


/* ============================================================
   Sentiment Gauge
   ============================================================ */

/**
 * Animate the sentiment gauge arc and center value.
 * @param {number} score - 0 to 100
 */
function updateGauge(score) {
    const s = Math.max(0, Math.min(100, Number(score) || 0));
    const offset = GAUGE_ARC_LENGTH - (s / 100 * GAUGE_ARC_LENGTH);

    if (dom.gaugeFill) {
        dom.gaugeFill.style.strokeDashoffset = offset;
    }
    animateNumber(dom.gaugeValue, s);
}


/* ============================================================
   Market Overview
   ============================================================ */

/**
 * Render the market overview section.
 * @param {object} data - market overview data
 */
function renderMarketOverview(data) {
    if (!data) return;

    // Sentiment gauge
    const score = data.sentiment_score ?? data.sentimentScore ?? data.score ?? 50;
    updateGauge(score);

    // Sentiment badge
    const sentiment = data.sentiment ?? data.overall_sentiment ?? '';
    if (dom.sentimentBadge) {
        dom.sentimentBadge.textContent = sentiment || '--';
        dom.sentimentBadge.className = 'section-badge';
        const cls = getSentimentClass(sentiment);
        dom.sentimentBadge.classList.add(
            cls === 'positive' ? 'bullish' :
            cls === 'negative' ? 'bearish' : 'neutral'
        );
    }

    // Key Drivers
    const drivers = data.key_drivers ?? data.keyDrivers ?? data.drivers ?? [];
    if (dom.driverList) {
        if (drivers.length === 0) {
            dom.driverList.innerHTML = '<li class="empty-state"><span class="empty-state-text">暂无数据</span></li>';
        } else {
            dom.driverList.innerHTML = drivers.map((d, i) =>
                `<li style="animation-delay:${i * 0.05}s">${escapeHtml(typeof d === 'string' ? d : d.text || d.description || JSON.stringify(d))}</li>`
            ).join('');
        }
    }

    // Risks
    const risks = data.risks ?? data.risk_factors ?? data.riskFactors ?? [];
    if (dom.riskList) {
        if (risks.length === 0) {
            dom.riskList.innerHTML = '<li class="empty-state"><span class="empty-state-text">暂无数据</span></li>';
        } else {
            dom.riskList.innerHTML = risks.map((r, i) =>
                `<li style="animation-delay:${i * 0.05}s">${escapeHtml(typeof r === 'string' ? r : r.text || r.description || JSON.stringify(r))}</li>`
            ).join('');
        }
    }
}


/* ============================================================
   Sectors
   ============================================================ */

/**
 * Render hot sectors grid.
 * @param {Array} sectors
 */
function renderSectors(sectors) {
    if (!dom.sectorsGrid) return;

    if (!sectors || sectors.length === 0) {
        dom.sectorsGrid.innerHTML = `
            <div class="card empty-state">
                <span class="empty-state-icon">📭</span>
                <span class="empty-state-text">暂无板块数据</span>
            </div>`;
        return;
    }

    // Sort by heat score descending
    const sorted = [...sectors].sort((a, b) => (b.heat_score ?? b.heatScore ?? 0) - (a.heat_score ?? a.heatScore ?? 0));

    dom.sectorsGrid.innerHTML = sorted.map((sector, idx) => {
        const name      = sector.name ?? sector.sector ?? '';
        const heat      = sector.heat_score ?? sector.heatScore ?? 0;
        const trend     = String(sector.trend ?? '').toLowerCase();
        const stocks    = sector.stocks ?? sector.representative_stocks ?? sector.tickers ?? [];
        const trendCls  = trend.includes('up') || trend.includes('bullish') ? 'up' :
                          trend.includes('down') || trend.includes('bearish') ? 'down' : 'flat';
        const trendIcon = trendCls === 'up' ? '▲' : trendCls === 'down' ? '▼' : '●';

        const stockTags = (Array.isArray(stocks) ? stocks : []).slice(0, 6).map(s => {
            const sym = typeof s === 'string' ? s : s.ticker || s.symbol || '';
            return `<span class="sector-stock-tag" data-ticker="${escapeHtml(sym)}">${escapeHtml(sym)}</span>`;
        }).join('');

        return `
        <div class="card sector-card" style="animation: slideUp 0.4s ${idx * 0.06}s both">
            <div class="sector-header">
                <span class="sector-name">${escapeHtml(name)}</span>
                <span class="sector-trend ${trendCls}">
                    <span class="trend-arrow">${trendIcon}</span>
                    ${escapeHtml(trend)}
                </span>
            </div>
            <div class="heat-bar-container">
                <div class="heat-bar-label">
                    <span>Heat Score</span>
                    <span class="heat-bar-value">${heat}/100</span>
                </div>
                <div class="heat-bar-track">
                    <div class="heat-bar-fill" style="width:${Math.min(100, heat)}%; animation-delay:${idx * 0.08}s"></div>
                </div>
            </div>
            ${stockTags ? `<div class="sector-stocks">${stockTags}</div>` : ''}
        </div>`;
    }).join('');

    // Bind click on stock tags
    dom.sectorsGrid.querySelectorAll('.sector-stock-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const ticker = tag.dataset.ticker;
            if (ticker) openStockModal(ticker);
        });
    });
}


/* ============================================================
   Recommendations
   ============================================================ */

/**
 * Render stock recommendations list.
 * @param {Array} recs
 */
function renderRecommendations(recs) {
    if (!dom.recList) return;

    if (!recs || recs.length === 0) {
        dom.recList.innerHTML = `
            <div class="card empty-state">
                <span class="empty-state-icon">📋</span>
                <span class="empty-state-text">暂无推荐数据</span>
            </div>`;
        return;
    }

    dom.recList.innerHTML = recs.map((rec, idx) => {
        const ticker    = rec.ticker ?? rec.symbol ?? '';
        const level     = String(rec.recommendation ?? rec.level ?? rec.action ?? 'hold').toLowerCase();
        const score     = rec.sentiment_score ?? rec.sentimentScore ?? rec.score ?? null;
        const sector    = rec.sector ?? '';
        const reasons   = rec.reasons ?? rec.reason ?? rec.rationale ?? [];
        const reasonStr = Array.isArray(reasons) ? reasons.join('；') : String(reasons);
        const filterGrp = getRecFilterGroup(level);
        const scoreCls  = getSentimentClass(level);
        const badgeCls  = level.replace(/\s+/g, '_');
        const hidden    = (currentFilter !== 'all' && currentFilter !== filterGrp) ? 'hidden' : '';

        return `
        <div class="card rec-card ${hidden}" data-level="${escapeHtml(level)}" data-filter-group="${filterGrp}" data-ticker="${escapeHtml(ticker)}" style="animation: slideUp 0.35s ${idx * 0.04}s both">
            <div class="rec-card-left">
                <span class="rec-ticker">${escapeHtml(ticker)}</span>
                <span class="rec-badge ${badgeCls}">${getRecommendationLabel(level)}</span>
            </div>
            <div class="rec-card-center">
                ${sector ? `<span class="rec-sector-tag">${escapeHtml(sector)}</span>` : ''}
                <span class="rec-reasons">${escapeHtml(reasonStr)}</span>
            </div>
            <div class="rec-card-right">
                ${score !== null ? `<span class="rec-score ${scoreCls}">${score}</span><span class="rec-score-label">Sentiment</span>` : ''}
            </div>
        </div>`;
    }).join('');

    // Bind click to open modal
    dom.recList.querySelectorAll('.rec-card').forEach(card => {
        card.addEventListener('click', () => {
            const ticker = card.dataset.ticker;
            if (ticker) openStockModal(ticker);
        });
    });
}

/**
 * Apply filter to recommendation cards.
 * @param {string} filter - 'all', 'buy', 'hold', 'sell'
 */
function applyRecFilter(filter) {
    currentFilter = filter;

    // Update button states
    dom.filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    // Show/hide cards
    dom.recList?.querySelectorAll('.rec-card').forEach(card => {
        const group = card.dataset.filterGroup;
        if (filter === 'all' || filter === group) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
}


/* ============================================================
   News Feed
   ============================================================ */

/**
 * Render the live news feed.
 * @param {Array} news
 */
function renderNews(news) {
    if (!dom.newsFeed) return;

    if (!news || news.length === 0) {
        dom.newsFeed.innerHTML = `
            <div class="card empty-state">
                <span class="empty-state-icon">📰</span>
                <span class="empty-state-text">暂无新闻</span>
            </div>`;
        return;
    }

    dom.newsFeed.innerHTML = news.map((item, idx) => {
        const title     = item.title ?? item.headline ?? '';
        const url       = item.url ?? item.link ?? '#';
        const sentiment = String(item.sentiment ?? 'neutral').toLowerCase();
        const sentCls   = getSentimentClass(sentiment);
        const tickers   = item.tickers ?? item.related_tickers ?? item.symbols ?? [];
        const time      = item.published_at ?? item.publishedAt ?? item.time ?? item.date ?? '';

        const tickerBadges = (Array.isArray(tickers) ? tickers : []).slice(0, 4).map(t =>
            `<span class="ticker-badge" data-ticker="${escapeHtml(t)}">${escapeHtml(t)}</span>`
        ).join('');

        return `
        <div class="card news-card" style="animation: slideUp 0.3s ${idx * 0.04}s both">
            <span class="news-sentiment-dot ${sentCls}"></span>
            <div class="news-body">
                <div class="news-title">
                    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>
                </div>
                <div class="news-meta">
                    ${time ? `<span class="news-time">${timeAgo(time)}</span>` : ''}
                    ${tickerBadges ? `<div class="news-ticker-badges">${tickerBadges}</div>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    // Bind ticker badge clicks
    dom.newsFeed.querySelectorAll('.ticker-badge').forEach(badge => {
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            const ticker = badge.dataset.ticker;
            if (ticker) openStockModal(ticker);
        });
    });
}


/* ============================================================
   WSB Sentiment
   ============================================================ */

/**
 * Render WSB sentiment section.
 * @param {object} wsb
 */
function renderWSB(wsb) {
    if (!dom.wsbContent) return;

    if (!wsb) {
        dom.wsbContent.innerHTML = `
            <div class="card empty-state">
                <span class="empty-state-icon">🦍</span>
                <span class="empty-state-text">暂无 WSB 数据</span>
            </div>`;
        return;
    }

    const overallSentiment = wsb.overall_sentiment ?? wsb.sentiment ?? 'neutral';
    const sentCls          = getSentimentClass(overallSentiment);
    const topTickers       = wsb.top_tickers ?? wsb.tickers ?? wsb.trending ?? [];
    const topics           = wsb.hot_topics ?? wsb.topics ?? wsb.hotTopics ?? [];

    // Find max mentions for bar scaling
    const maxMentions = topTickers.reduce((max, t) => Math.max(max, t.mentions ?? t.count ?? 0), 1);

    const tickerRows = topTickers.slice(0, 8).map((t, i) => {
        const sym      = t.ticker ?? t.symbol ?? '';
        const mentions = t.mentions ?? t.count ?? 0;
        const pct      = Math.round((mentions / maxMentions) * 100);
        return `
        <div class="wsb-ticker-row" style="animation: slideUp 0.3s ${i * 0.05}s both">
            <span class="wsb-ticker-symbol" data-ticker="${escapeHtml(sym)}">${escapeHtml(sym)}</span>
            <div class="wsb-mention-bar-track">
                <div class="wsb-mention-bar-fill" style="width:${pct}%; animation-delay:${i * 0.08}s"></div>
            </div>
            <span class="wsb-mention-count">${mentions}</span>
        </div>`;
    }).join('');

    const topicTags = (Array.isArray(topics) ? topics : []).map(t => {
        const text = typeof t === 'string' ? t : t.topic || t.name || '';
        return `<span class="wsb-topic-tag">${escapeHtml(text)}</span>`;
    }).join('');

    dom.wsbContent.innerHTML = `
    <div class="card wsb-card">
        <div class="wsb-overall">
            <span class="wsb-overall-label">整体情绪</span>
            <span class="wsb-overall-value ${sentCls}">${escapeHtml(overallSentiment)}</span>
        </div>
        ${tickerRows ? `
            <div class="wsb-tickers-title">🔝 热门标的</div>
            <div class="wsb-tickers-list">${tickerRows}</div>
        ` : ''}
        ${topicTags ? `
            <div class="wsb-topics-title">💬 热议话题</div>
            <div class="wsb-topics">${topicTags}</div>
        ` : ''}
    </div>`;

    // Bind ticker clicks
    dom.wsbContent.querySelectorAll('.wsb-ticker-symbol').forEach(el => {
        el.addEventListener('click', () => {
            const ticker = el.dataset.ticker;
            if (ticker) openStockModal(ticker);
        });
    });
}


/* ============================================================
   Stock Detail Modal
   ============================================================ */

/**
 * Open the stock detail modal and fetch data.
 * @param {string} ticker
 */
async function openStockModal(ticker) {
    if (!ticker || !dom.modal || !dom.modalBody) return;

    // Show modal with loading
    dom.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    dom.modalBody.innerHTML = `
        <div class="modal-loading">
            <div class="spinner"></div>
            <span>正在加载 ${escapeHtml(ticker)} 分析数据...</span>
        </div>`;

    try {
        const data = await safeFetch(API.stock(ticker));
        renderStockDetail(ticker, data);
    } catch (err) {
        console.error(`[Modal] Failed to load ${ticker}:`, err);
        dom.modalBody.innerHTML = `
            <div class="modal-loading">
                <span class="empty-state-icon">❌</span>
                <span>加载失败: ${escapeHtml(err.message)}</span>
            </div>`;
    }
}

/**
 * Render stock detail content inside the modal.
 * @param {string} ticker
 * @param {object} data
 */
function renderStockDetail(ticker, data) {
    if (!dom.modalBody || !data) return;

    const rec       = data.recommendation ?? data.level ?? data.action ?? '';
    const recLabel  = getRecommendationLabel(rec);
    const recColor  = getRecommendationColor(rec);
    const badgeCls  = String(rec).toLowerCase().replace(/\s+/g, '_');
    const score     = data.sentiment_score ?? data.sentimentScore ?? data.score ?? null;
    const sector    = data.sector ?? '';
    const analysis  = data.analysis ?? data.summary ?? data.description ?? '';
    const reasons   = data.reasons ?? data.rationale ?? [];
    const risks     = data.risks ?? data.risk_factors ?? [];
    const catalysts = data.catalysts ?? data.key_catalysts ?? [];
    const price     = data.price ?? data.current_price ?? null;
    const target    = data.target_price ?? data.targetPrice ?? null;
    const volume    = data.volume ?? null;
    const marketCap = data.market_cap ?? data.marketCap ?? null;

    let html = `
        <h2>
            <span class="modal-ticker">${escapeHtml(ticker)}</span>
            <span class="modal-rec-badge ${badgeCls}" style="background:${recColor}20; color:${recColor}; border:1px solid ${recColor}40">${recLabel}</span>
        </h2>`;

    // Meta grid (price, score, sector, etc.)
    const metaItems = [];
    if (score !== null)  metaItems.push({ label: 'Sentiment', value: score });
    if (price !== null)  metaItems.push({ label: '当前价格', value: `$${price}` });
    if (target !== null) metaItems.push({ label: '目标价', value: `$${target}` });
    if (sector)          metaItems.push({ label: '板块', value: sector });
    if (volume !== null) metaItems.push({ label: '成交量', value: typeof volume === 'number' ? volume.toLocaleString() : volume });
    if (marketCap)       metaItems.push({ label: '市值', value: marketCap });

    if (metaItems.length > 0) {
        html += `<div class="modal-section"><div class="modal-meta-grid">`;
        html += metaItems.map(m => `
            <div class="modal-meta-item">
                <span class="modal-meta-label">${escapeHtml(m.label)}</span>
                <span class="modal-meta-value">${escapeHtml(String(m.value))}</span>
            </div>`).join('');
        html += `</div></div>`;
    }

    // Analysis
    if (analysis) {
        html += `
        <div class="modal-section">
            <div class="modal-section-title">分析概要</div>
            <p>${escapeHtml(analysis)}</p>
        </div>`;
    }

    // Reasons
    if (Array.isArray(reasons) && reasons.length > 0) {
        html += `
        <div class="modal-section">
            <div class="modal-section-title">推荐理由</div>
            <ul>${reasons.map(r => `<li>${escapeHtml(typeof r === 'string' ? r : r.text || JSON.stringify(r))}</li>`).join('')}</ul>
        </div>`;
    }

    // Catalysts
    if (Array.isArray(catalysts) && catalysts.length > 0) {
        html += `
        <div class="modal-section">
            <div class="modal-section-title">关键催化剂</div>
            <ul>${catalysts.map(c => `<li>${escapeHtml(typeof c === 'string' ? c : c.text || JSON.stringify(c))}</li>`).join('')}</ul>
        </div>`;
    }

    // Risks
    if (Array.isArray(risks) && risks.length > 0) {
        html += `
        <div class="modal-section">
            <div class="modal-section-title">风险因素</div>
            <ul>${risks.map(r => `<li>${escapeHtml(typeof r === 'string' ? r : r.text || JSON.stringify(r))}</li>`).join('')}</ul>
        </div>`;
    }

    dom.modalBody.innerHTML = html;
}

/**
 * Close the stock detail modal.
 */
function closeModal() {
    if (dom.modal) {
        dom.modal.hidden = true;
        document.body.style.overflow = '';
    }
}


/* ============================================================
   Dashboard Data Fetching
   ============================================================ */

/**
 * Fetch all dashboard data and update all sections.
 * Tries the unified /api/dashboard endpoint first, then
 * falls back to individual endpoints.
 */
async function fetchDashboard() {
    if (isLoading) return;
    isLoading = true;
    setStatus('loading', 'Loading...');

    // Spin the refresh button
    dom.refreshBtn?.classList.add('spinning');

    try {
        let data;

        // Try unified endpoint first
        try {
            data = await safeFetch(API.dashboard);
        } catch {
            // Fall back to individual endpoints
            const [overview, sectors, recs, news, wsb] = await Promise.allSettled([
                safeFetch(API.marketOverview),
                safeFetch(API.sectors),
                safeFetch(API.recommendations),
                safeFetch(API.news),
                safeFetch(API.wsb)
            ]);

            data = {
                market_overview:  overview.status === 'fulfilled'  ? overview.value  : null,
                sectors:          sectors.status === 'fulfilled'   ? sectors.value   : null,
                recommendations:  recs.status === 'fulfilled'      ? recs.value      : null,
                news:             news.status === 'fulfilled'       ? news.value       : null,
                wsb:              wsb.status === 'fulfilled'        ? wsb.value        : null
            };
        }

        dashboardData = data;

        // Extract data with flexible keys
        const overview = data.market_overview ?? data.marketOverview ?? data.overview ?? data;
        const sectors  = data.sectors ?? data.hot_sectors ?? data.hotSectors ?? [];
        const recs     = data.recommendations ?? data.stocks ?? data.picks ?? [];
        const news     = data.news ?? data.live_news ?? data.liveNews ?? [];
        const wsb      = data.wsb ?? data.wsb_sentiment ?? data.wsbSentiment ?? null;

        // Render all sections
        renderMarketOverview(overview);
        renderSectors(Array.isArray(sectors) ? sectors : sectors?.sectors ?? []);
        renderRecommendations(Array.isArray(recs) ? recs : recs?.recommendations ?? recs?.stocks ?? []);
        renderNews(Array.isArray(news) ? news : news?.articles ?? news?.items ?? []);
        renderWSB(typeof wsb === 'object' && wsb !== null ? wsb : null);

        setStatus('connected', 'Live');
        setLastUpdate();
        removeErrorBanner();

    } catch (err) {
        console.error('[Dashboard] Fetch error:', err);
        setStatus('error', 'Error');
        showErrorBanner(err.message);
    } finally {
        isLoading = false;
        dom.refreshBtn?.classList.remove('spinning');
    }
}

/**
 * Show an error banner at the top of the dashboard.
 * @param {string} message
 */
function showErrorBanner(message) {
    removeErrorBanner();
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.id = 'error-banner';
    banner.innerHTML = `
        <span class="error-banner-icon">🔴</span>
        <span class="error-banner-text">数据加载失败: ${escapeHtml(message)}</span>
        <button class="error-banner-retry" onclick="fetchDashboard()">重试</button>`;
    const dashboard = $('#dashboard');
    if (dashboard) {
        dashboard.insertBefore(banner, dashboard.firstChild);
    }
}

/**
 * Remove the error banner if present.
 */
function removeErrorBanner() {
    const banner = $('#error-banner');
    if (banner) banner.remove();
}


/* ============================================================
   Auto-Refresh
   ============================================================ */

/**
 * Start the auto-refresh timer.
 */
function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(fetchDashboard, AUTO_REFRESH_INTERVAL);
}

/**
 * Stop the auto-refresh timer.
 */
function stopAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

/**
 * Restart auto-refresh (e.g. after manual refresh).
 */
function restartAutoRefresh() {
    startAutoRefresh();
}


/* ============================================================
   Event Listeners
   ============================================================ */

function bindEvents() {
    // Refresh button
    dom.refreshBtn?.addEventListener('click', () => {
        fetchDashboard();
        restartAutoRefresh();
    });

    // Filter buttons
    dom.filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            applyRecFilter(btn.dataset.filter);
        });
    });

    // Modal close button
    dom.modalClose?.addEventListener('click', closeModal);

    // Modal overlay click to close
    dom.modal?.addEventListener('click', (e) => {
        if (e.target === dom.modal) closeModal();
    });

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Pause auto-refresh when tab is hidden, resume when visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoRefresh();
        } else {
            fetchDashboard();
            startAutoRefresh();
        }
    });
}


/* ============================================================
   Initialization
   ============================================================ */

/**
 * Initialize the dashboard application.
 */
function init() {
    console.log('%c🚀 Market Analysis Agent Dashboard v1.0', 'color:#f0b90b; font-weight:bold; font-size:14px');
    console.log('%cPowered by SellTheNews MCP', 'color:#848e9c; font-size:11px');

    bindEvents();
    fetchDashboard();
    startAutoRefresh();
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
