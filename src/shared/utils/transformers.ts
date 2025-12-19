import {
  User,
  ProductInfo,
  TrackedProduct,
  PricePoint,
  PriceHistory,
  PriceAlert,
  PriceUpdate,
  AvailabilityStatus,
  DataSource,
  PriceTrend
} from '../types/index.js';

/**
 * Transforms raw database user data to User interface
 */
export function transformDbUserToUser(dbUser: any): User {
  return {
    id: dbUser.id,
    email: dbUser.email,
    createdAt: new Date(dbUser.created_at),
    preferences: {
      notificationChannels: dbUser.notification_channels || [],
      checkFrequency: dbUser.check_frequency || 60,
      priceThreshold: dbUser.price_threshold || 10
    },
    subscription: dbUser.subscription_tier || 'free'
  };
}

/**
 * Transforms User interface to database format
 */
export function transformUserToDb(user: User): any {
  return {
    id: user.id,
    email: user.email,
    created_at: user.createdAt,
    notification_channels: user.preferences.notificationChannels,
    check_frequency: user.preferences.checkFrequency,
    price_threshold: user.preferences.priceThreshold,
    subscription_tier: user.subscription
  };
}

/**
 * Transforms raw scraped product data to ProductInfo
 */
export function transformScrapedDataToProduct(scrapedData: any, url: string): ProductInfo {
  return {
    id: generateUUID(),
    title: sanitizeString(scrapedData.title || scrapedData.name || 'Unknown Product'),
    url: url,
    retailer: extractRetailerFromUrl(url),
    category: sanitizeString(scrapedData.category || 'General'),
    brand: scrapedData.brand ? sanitizeString(scrapedData.brand) : undefined,
    model: scrapedData.model ? sanitizeString(scrapedData.model) : undefined,
    imageUrl: scrapedData.imageUrl || scrapedData.image || undefined,
    extractedAt: new Date()
  };
}

/**
 * Transforms API response to ProductInfo
 */
export function transformApiResponseToProduct(apiData: any, url: string): ProductInfo {
  return {
    id: apiData.id || generateUUID(),
    title: sanitizeString(apiData.title || apiData.name),
    url: url,
    retailer: apiData.retailer || extractRetailerFromUrl(url),
    category: sanitizeString(apiData.category || 'General'),
    brand: apiData.brand ? sanitizeString(apiData.brand) : undefined,
    model: apiData.model ? sanitizeString(apiData.model) : undefined,
    imageUrl: apiData.imageUrl || apiData.images?.[0]?.url,
    extractedAt: new Date()
  };
}

/**
 * Transforms raw price data to PricePoint
 */
export function transformRawPriceToPoint(
  rawPrice: any,
  productId: string,
  source: DataSource
): PricePoint {
  return {
    id: generateUUID(),
    productId: productId,
    price: parseFloat(rawPrice.price || rawPrice.amount || '0'),
    currency: rawPrice.currency || 'USD',
    availability: mapAvailabilityStatus(rawPrice.availability || rawPrice.inStock),
    checkedAt: new Date(),
    source: source
  };
}

/**
 * Calculates price statistics from price points
 */
export function calculatePriceStatistics(points: PricePoint[]) {
  if (points.length === 0) {
    throw new Error('Cannot calculate statistics for empty price points');
  }

  const prices = points.map(p => p.price);
  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  
  // Calculate volatility (coefficient of variation)
  const variance = prices.reduce((sum, price) => sum + Math.pow(price - average, 2), 0) / prices.length;
  const standardDeviation = Math.sqrt(variance);
  const volatility = average > 0 ? standardDeviation / average : 0;

  // Determine trend
  const trend = calculatePriceTrend(points);

  return {
    average,
    minimum,
    maximum,
    trend,
    volatility: Math.min(volatility, 1) // Cap at 1.0
  };
}

/**
 * Calculates price trend from historical points
 */
export function calculatePriceTrend(points: PricePoint[]): PriceTrend {
  if (points.length < 2) return PriceTrend.STABLE;

  // Sort by date
  const sortedPoints = [...points].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime());
  
  // Calculate trend using linear regression slope
  const n = sortedPoints.length;
  const sumX = sortedPoints.reduce((sum, _, i) => sum + i, 0);
  const sumY = sortedPoints.reduce((sum, point) => sum + point.price, 0);
  const sumXY = sortedPoints.reduce((sum, point, i) => sum + (i * point.price), 0);
  const sumXX = sortedPoints.reduce((sum, _, i) => sum + (i * i), 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  
  // Determine trend based on slope and volatility
  const prices = sortedPoints.map(p => p.price);
  const average = sumY / n;
  const variance = prices.reduce((sum, price) => sum + Math.pow(price - average, 2), 0) / n;
  const volatility = Math.sqrt(variance) / average;

  if (volatility > 0.2) return PriceTrend.VOLATILE;
  if (Math.abs(slope) < 0.01) return PriceTrend.STABLE;
  return slope > 0 ? PriceTrend.INCREASING : PriceTrend.DECREASING;
}

/**
 * Creates a PriceUpdate from old and new price points
 */
export function createPriceUpdate(
  productId: string,
  oldPrice: number | undefined,
  newPrice: number
): PriceUpdate {
  const priceChange = oldPrice ? newPrice - oldPrice : 0;
  const percentageChange = oldPrice && oldPrice > 0 ? (priceChange / oldPrice) * 100 : 0;

  return {
    productId,
    oldPrice,
    newPrice,
    priceChange,
    percentageChange,
    updatedAt: new Date()
  };
}

// Helper functions
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function sanitizeString(input: string): string {
  return input.trim().replace(/\s+/g, ' ').substring(0, 500);
}

function extractRetailerFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '').split('.')[0];
  } catch {
    return 'unknown';
  }
}

function mapAvailabilityStatus(availability: any): AvailabilityStatus {
  if (typeof availability === 'boolean') {
    return availability ? AvailabilityStatus.IN_STOCK : AvailabilityStatus.OUT_OF_STOCK;
  }
  
  const availStr = String(availability).toLowerCase();
  if (availStr.includes('in stock') || availStr.includes('available')) {
    return AvailabilityStatus.IN_STOCK;
  }
  if (availStr.includes('out of stock') || availStr.includes('unavailable')) {
    return AvailabilityStatus.OUT_OF_STOCK;
  }
  if (availStr.includes('limited')) {
    return AvailabilityStatus.LIMITED_STOCK;
  }
  
  return AvailabilityStatus.UNKNOWN;
}