/**
 * Visual Analytics for Price History
 * Generates price charts and trend graphs
 */

/**
 * Generate SVG price chart
 * @param {Array<Object>} history - Price history data
 * @param {Object} options - Chart options
 * @returns {string} SVG chart HTML
 */
function generatePriceChart(history, options = {}) {
  const {
    width = 600,
    height = 300,
    padding = 40,
    showGrid = true,
    showPoints = true,
    lineColor = '#667eea',
    pointColor = '#28a745',
    gridColor = '#e0e0e0'
  } = options;
  
  if (!history || history.length === 0) {
    return '<p style="text-align: center; color: #666;">No price history available</p>';
  }
  
  // Single data point
  if (history.length === 1) {
    const entry = history[0];
    const date = new Date(entry.timestamp).toLocaleDateString();
    return `
      <div style="text-align: center; padding: 40px; background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); border-radius: 10px;">
        <div style="font-size: 48px; margin-bottom: 10px;">📍</div>
        <h3 style="margin: 0 0 8px 0; color: #333;">First Data Point Recorded</h3>
        <p style="margin: 0; font-size: 13px; color: #666;">
          Price: ₹${entry.price.toLocaleString()} on ${date}<br/>
          Scan this product again to see price trends!
        </p>
      </div>
    `;
  }
  
  // Extract price data
  const prices = history.map(h => h.price);
  const timestamps = history.map(h => h.timestamp);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;
  
  // Calculate chart dimensions
  const chartWidth = width - (padding * 2);
  const chartHeight = height - (padding * 2);
  
  // Generate SVG
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Background
  svg += `<rect width="${width}" height="${height}" fill="#ffffff" rx="10"/>`;
  
  // Grid lines (horizontal)
  if (showGrid) {
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding + (chartHeight / gridLines) * i;
      svg += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="${gridColor}" stroke-width="1" stroke-dasharray="5,5"/>`;
      
      // Price labels
      const priceValue = maxPrice - (priceRange / gridLines) * i;
      svg += `<text x="${padding - 10}" y="${y + 5}" text-anchor="end" font-size="12" fill="#666">₹${Math.round(priceValue).toLocaleString()}</text>`;
    }
  }
  
  // Generate path for line chart
  const points = history.map((entry, index) => {
    const x = padding + (index / (history.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((entry.price - minPrice) / priceRange) * chartHeight;
    return { x, y, price: entry.price, timestamp: entry.timestamp, stock: entry.stock };
  });
  
  // Draw line
  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  svg += `<path d="${pathData}" fill="none" stroke="${lineColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  
  // Draw gradient fill under line
  const gradientId = 'priceGradient';
  svg += `
    <defs>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:${lineColor};stop-opacity:0.3" />
        <stop offset="100%" style="stop-color:${lineColor};stop-opacity:0.05" />
      </linearGradient>
    </defs>
  `;
  
  const fillPath = pathData + ` L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
  svg += `<path d="${fillPath}" fill="url(#${gradientId})"/>`;
  
  // Draw points
  if (showPoints) {
    points.forEach(point => {
      const color = point.stock ? pointColor : '#dc3545';
      svg += `<circle cx="${point.x}" cy="${point.y}" r="5" fill="${color}" stroke="#ffffff" stroke-width="2"/>`;
      
      // Tooltip on hover (using title element)
      const date = new Date(point.timestamp).toLocaleDateString();
      svg += `<title>₹${point.price.toLocaleString()} on ${date}</title>`;
    });
  }
  
  // X-axis labels (dates)
  const labelCount = Math.min(5, history.length);
  for (let i = 0; i < labelCount; i++) {
    const index = Math.floor((history.length - 1) * (i / (labelCount - 1)));
    const point = points[index];
    const date = new Date(history[index].timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    svg += `<text x="${point.x}" y="${height - padding + 20}" text-anchor="middle" font-size="11" fill="#666">${date}</text>`;
  }
  
  svg += '</svg>';
  
  return svg;
}

/**
 * Calculate price statistics
 * @param {Array<Object>} history - Price history data
 * @returns {Object} Statistics
 */
function calculatePriceStats(history) {
  if (!history || history.length === 0) {
    return {
      current: 0,
      lowest: 0,
      highest: 0,
      average: 0,
      trend: 'unknown',
      change: 0,
      changePercent: 0
    };
  }
  
  const prices = history.map(h => h.price);
  const current = prices[prices.length - 1];
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const average = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  
  // Calculate trend
  const first = prices[0];
  const last = prices[prices.length - 1];
  const change = last - first;
  const changePercent = ((change / first) * 100).toFixed(1);
  
  let trend = 'stable';
  if (changePercent < -5) trend = 'decreasing';
  else if (changePercent > 5) trend = 'increasing';
  
  return {
    current,
    lowest,
    highest,
    average,
    trend,
    change: Math.round(change),
    changePercent: parseFloat(changePercent),
    dataPoints: history.length,
    firstDate: history[0].timestamp,
    lastDate: history[history.length - 1].timestamp
  };
}

/**
 * Generate trend indicator HTML
 * @param {string} trend - Trend direction
 * @param {number} changePercent - Change percentage
 * @returns {string} HTML
 */
function generateTrendIndicator(trend, changePercent) {
  const icons = {
    decreasing: '📉',
    increasing: '📈',
    stable: '➡️'
  };
  
  const colors = {
    decreasing: '#28a745',
    increasing: '#dc3545',
    stable: '#6c757d'
  };
  
  const icon = icons[trend] || '➡️';
  const color = colors[trend] || '#6c757d';
  
  return `
    <span style="color: ${color}; font-weight: bold;">
      ${icon} ${Math.abs(changePercent)}%
    </span>
  `;
}

/**
 * Generate complete price history card with chart and stats
 * @param {Array<Object>} history - Price history data
 * @param {Object} options - Display options
 * @returns {string} Complete HTML
 */
function generatePriceHistoryCard(history, options = {}) {
  if (!history || history.length === 0) {
    return `
      <div style="text-align: center; padding: 40px; background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%); border-radius: 10px;">
        <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
        <h3 style="margin: 0 0 8px 0; color: #333;">No Price History Yet</h3>
        <p style="margin: 0; font-size: 13px; color: #666;">
          Scan this product a few times to build price history!
        </p>
      </div>
    `;
  }
  
  const stats = calculatePriceStats(history);
  const chart = generatePriceChart(history, options);
  const trendIndicator = generateTrendIndicator(stats.trend, stats.changePercent);
  
  return `
    <div class="price-history-card" style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
      <!-- Chart -->
      <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        ${chart}
      </div>
      
      <!-- Statistics -->
      <div style="background: white; padding: 20px; border-radius: 8px;">
        <h4 style="margin: 0 0 15px 0; color: #333;">📊 Price Statistics</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div style="background: #f8f9fa; padding: 12px; border-radius: 6px;">
            <small style="color: #666; font-size: 11px;">CURRENT</small><br>
            <strong style="font-size: 18px; color: #007cba;">₹${stats.current.toLocaleString()}</strong>
          </div>
          <div style="background: #f8f9fa; padding: 12px; border-radius: 6px;">
            <small style="color: #666; font-size: 11px;">TREND</small><br>
            ${trendIndicator}
          </div>
          <div style="background: #f8f9fa; padding: 12px; border-radius: 6px;">
            <small style="color: #666; font-size: 11px;">LOWEST</small><br>
            <strong style="font-size: 18px; color: #28a745;">₹${stats.lowest.toLocaleString()}</strong>
          </div>
          <div style="background: #f8f9fa; padding: 12px; border-radius: 6px;">
            <small style="color: #666; font-size: 11px;">HIGHEST</small><br>
            <strong style="font-size: 18px; color: #dc3545;">₹${stats.highest.toLocaleString()}</strong>
          </div>
        </div>
        <p style="margin: 15px 0 0 0; font-size: 12px; color: #666; text-align: center;">
          📅 Tracked since ${new Date(stats.firstDate).toLocaleDateString()} (${stats.dataPoints} data points)
        </p>
      </div>
    </div>
  `;
}

/**
 * Generate compact price sparkline (mini chart)
 * @param {Array<Object>} history - Price history data
 * @param {Object} options - Chart options
 * @returns {string} SVG sparkline
 */
function generateSparkline(history, options = {}) {
  const {
    width = 100,
    height = 30,
    lineColor = '#667eea',
    fillColor = 'rgba(102, 126, 234, 0.1)'
  } = options;
  
  if (!history || history.length < 2) {
    return '<span style="color: #999;">—</span>';
  }
  
  const prices = history.map(h => h.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;
  
  const points = history.map((entry, index) => {
    const x = (index / (history.length - 1)) * width;
    const y = height - ((entry.price - minPrice) / priceRange) * height;
    return { x, y };
  });
  
  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillPath = pathData + ` L ${width} ${height} L 0 ${height} Z`;
  
  return `
    <svg width="${width}" height="${height}" style="vertical-align: middle;">
      <path d="${fillPath}" fill="${fillColor}"/>
      <path d="${pathData}" fill="none" stroke="${lineColor}" stroke-width="2"/>
    </svg>
  `;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generatePriceChart,
    calculatePriceStats,
    generateTrendIndicator,
    generatePriceHistoryCard,
    generateSparkline
  };
}
