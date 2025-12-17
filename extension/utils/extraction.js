/**
 * Keyword Extraction for Product Search
 * Extracts brand, model, variant, and other key features from product titles
 */

/**
 * Extract search keywords from product title
 * @param {string} title - Product title
 * @returns {Object} Extracted keywords
 */
function extractKeywords(title) {
  if (!title || typeof title !== 'string') {
    return null;
  }
  
  // Clean the title
  const cleaned = cleanTitle(title);
  
  // Extract components
  const brand = extractBrand(cleaned);
  const model = extractModel(cleaned, brand);
  const variant = extractVariant(cleaned);
  const color = extractColor(cleaned);
  const size = extractSize(cleaned);
  
  // Build search query (most important terms)
  const searchQuery = buildSearchQuery({
    brand,
    model,
    variant,
    size
  });
  
  return {
    original: title,
    cleaned: cleaned,
    brand: brand,
    model: model,
    variant: variant,
    color: color,
    size: size,
    searchQuery: searchQuery,
    tokens: tokenize(cleaned)
  };
}

/**
 * Clean product title
 * @param {string} title - Raw title
 * @returns {string} Cleaned title
 */
function cleanTitle(title) {
  return title
    .trim()
    // Remove common noise words
    .replace(/\b(with|without|for|and|or|the|a|an)\b/gi, ' ')
    // Remove special characters but keep spaces and alphanumeric
    .replace(/[^\w\s]/g, ' ')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract brand name from title
 * @param {string} title - Cleaned title
 * @returns {string|null} Brand name
 */
function extractBrand(title) {
  // Common brand patterns (add more as needed)
  const brands = [
    // Electronics
    'Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Realme', 'Oppo', 'Vivo', 'Nokia',
    'Sony', 'LG', 'Panasonic', 'Philips', 'Boat', 'JBL', 'Bose',
    // Fashion
    'Nike', 'Adidas', 'Puma', 'Reebok', 'Under Armour', 'New Balance',
    'Levi', 'Wrangler', 'Lee', 'Zara', 'H&M', 'Forever 21',
    // Supplements
    'Optimum Nutrition', 'MuscleBlaze', 'MyProtein', 'Dymatize', 'BSN',
    // Others
    'Nestle', 'Cadbury', 'Amul', 'Britannia'
  ];
  
  // Check for exact brand match (case insensitive)
  for (const brand of brands) {
    const regex = new RegExp(`\\b${brand}\\b`, 'i');
    if (regex.test(title)) {
      return brand;
    }
  }
  
  // If no known brand, take first word as potential brand
  const firstWord = title.split(' ')[0];
  if (firstWord && firstWord.length > 2) {
    return firstWord;
  }
  
  return null;
}

/**
 * Extract model name/number from title
 * @param {string} title - Cleaned title
 * @param {string} brand - Brand name
 * @returns {string|null} Model name
 */
function extractModel(title, brand) {
  // Remove brand from title to isolate model
  let modelText = title;
  if (brand) {
    modelText = title.replace(new RegExp(`\\b${brand}\\b`, 'i'), '').trim();
  }
  
  // Common model patterns
  const patterns = [
    // iPhone patterns: "15 Pro", "14 Plus", "13 Mini"
    /\b(\d{1,2}\s*(?:Pro|Plus|Mini|Max|Ultra)?)\b/i,
    // Galaxy patterns: "S24", "A54", "M34"
    /\b([A-Z]\d{2,3})\b/,
    // Generic model numbers: "XM5", "WH-1000XM5"
    /\b([A-Z]{2,4}[-\s]?\d{3,4}[A-Z]{0,3})\b/i,
    // Version numbers: "v2", "Gen 2"
    /\b(?:v|gen|version)\s*(\d+)\b/i
  ];
  
  for (const pattern of patterns) {
    const match = modelText.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  // If no pattern match, take first 2-3 words after brand
  const words = modelText.split(' ').filter(w => w.length > 0);
  if (words.length > 0) {
    return words.slice(0, 3).join(' ');
  }
  
  return null;
}

/**
 * Extract variant (storage, RAM, etc.)
 * @param {string} title - Cleaned title
 * @returns {string|null} Variant
 */
function extractVariant(title) {
  const patterns = [
    // Storage: "128GB", "256 GB", "1TB"
    /\b(\d+\s*(?:GB|TB|MB))\b/i,
    // RAM: "8GB RAM", "16 GB"
    /\b(\d+\s*GB\s*RAM)\b/i,
    // Combo: "8GB/128GB"
    /\b(\d+\s*GB\s*\/\s*\d+\s*GB)\b/i
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].replace(/\s+/g, '').toUpperCase();
    }
  }
  
  return null;
}

/**
 * Extract color from title
 * @param {string} title - Cleaned title
 * @returns {string|null} Color
 */
function extractColor(title) {
  const colors = [
    'Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple',
    'Pink', 'Gray', 'Grey', 'Silver', 'Gold', 'Rose Gold', 'Space Gray',
    'Midnight', 'Starlight', 'Titanium', 'Natural', 'Graphite'
  ];
  
  for (const color of colors) {
    const regex = new RegExp(`\\b${color}\\b`, 'i');
    if (regex.test(title)) {
      return color;
    }
  }
  
  return null;
}

/**
 * Extract size (for clothing, shoes, etc.)
 * @param {string} title - Cleaned title
 * @returns {string|null} Size
 */
function extractSize(title) {
  const patterns = [
    // Clothing sizes: "XL", "XXL", "M", "L"
    /\b(XXS|XS|S|M|L|XL|XXL|XXXL)\b/,
    // Numeric sizes: "Size 42", "42"
    /\bSize\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:UK|US|EU|IN)\b/i
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Build search query from extracted components
 * @param {Object} components - Extracted components
 * @returns {string} Search query
 */
function buildSearchQuery(components) {
  const parts = [];
  
  // Add brand (most important)
  if (components.brand) {
    parts.push(components.brand);
  }
  
  // Add model (very important)
  if (components.model) {
    parts.push(components.model);
  }
  
  // Add variant (important for exact match)
  if (components.variant) {
    parts.push(components.variant);
  }
  
  // Add size if present
  if (components.size) {
    parts.push(components.size);
  }
  
  // Join with spaces
  return parts.join(' ').trim();
}

/**
 * Tokenize title into words
 * @param {string} title - Title text
 * @returns {Array<string>} Array of tokens
 */
function tokenize(title) {
  return title
    .toLowerCase()
    .split(/\s+/)
    .filter(token => token.length > 2) // Remove very short tokens
    .filter(token => !isStopWord(token)); // Remove stop words
}

/**
 * Check if word is a stop word
 * @param {string} word - Word to check
 * @returns {boolean} True if stop word
 */
function isStopWord(word) {
  const stopWords = [
    'the', 'and', 'for', 'with', 'without', 'from', 'this', 'that',
    'are', 'was', 'were', 'been', 'have', 'has', 'had', 'can', 'will'
  ];
  return stopWords.includes(word.toLowerCase());
}

/**
 * Extract keywords from multiple product titles and find common terms
 * @param {Array<string>} titles - Array of product titles
 * @returns {Object} Common keywords
 */
function extractCommonKeywords(titles) {
  if (!titles || titles.length === 0) {
    return null;
  }
  
  const allKeywords = titles.map(title => extractKeywords(title));
  
  // Find most common brand
  const brands = allKeywords.map(k => k.brand).filter(Boolean);
  const commonBrand = findMostCommon(brands);
  
  // Find most common model
  const models = allKeywords.map(k => k.model).filter(Boolean);
  const commonModel = findMostCommon(models);
  
  return {
    brand: commonBrand,
    model: commonModel,
    searchQuery: buildSearchQuery({ brand: commonBrand, model: commonModel })
  };
}

/**
 * Find most common element in array
 * @param {Array} arr - Array of elements
 * @returns {*} Most common element
 */
function findMostCommon(arr) {
  if (arr.length === 0) return null;
  
  const counts = {};
  let maxCount = 0;
  let mostCommon = null;
  
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      mostCommon = item;
    }
  }
  
  return mostCommon;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractKeywords,
    extractCommonKeywords,
    tokenize
  };
}
