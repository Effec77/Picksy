/**
 * Product Matching Algorithm
 * Matches products across different sites using fuzzy matching
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
function levenshtein(a, b) {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
  
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Tokenize a string into words
 * @param {string} text - Text to tokenize
 * @returns {Array<string>} Array of tokens
 */
function tokenize(text) {
  if (!text) return [];
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove special chars
    .split(/\s+/)
    .filter(token => token.length > 2); // Remove very short tokens
}

/**
 * Calculate token overlap score
 * @param {Array<string>} tokensA - First token array
 * @param {Array<string>} tokensB - Second token array
 * @returns {number} Overlap score (0-1)
 */
function calculateTokenOverlap(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  return intersection.size / union.size; // Jaccard similarity
}

/**
 * Calculate text similarity using Levenshtein distance
 * @param {string} textA - First text
 * @param {string} textB - Second text
 * @returns {number} Similarity score (0-1)
 */
function calculateTextSimilarity(textA, textB) {
  if (!textA || !textB) return 0;
  
  const distance = levenshtein(textA.toLowerCase(), textB.toLowerCase());
  const maxLength = Math.max(textA.length, textB.length);
  
  if (maxLength === 0) return 1;
  
  return 1 - (distance / maxLength);
}

/**
 * Calculate price similarity
 * @param {number} priceA - First price
 * @param {number} priceB - Second price
 * @returns {number} Similarity score (0-1)
 */
function calculatePriceSimilarity(priceA, priceB) {
  if (!priceA || !priceB) return 0;
  
  const diff = Math.abs(priceA - priceB);
  const avg = (priceA + priceB) / 2;
  
  if (avg === 0) return 1;
  
  // Allow up to 20% price difference
  const maxDiff = avg * 0.20;
  const similarity = Math.max(0, 1 - (diff / maxDiff));
  
  return similarity;
}

/**
 * Extract brand from title (simple version for matching)
 * @param {string} title - Product title
 * @returns {string|null} Brand name
 */
function extractBrand(title) {
  if (!title) return null;
  
  // Simple brand extraction - just take first word
  const words = title.trim().split(/\s+/);
  return words[0] || null;
}

/**
 * Calculate match score between two products
 * @param {Object} original - Original product
 * @param {Object} candidate - Candidate product to match
 * @returns {number} Match score (0-100)
 */
function calculateMatchScore(original, candidate) {
  if (!original || !candidate) return 0;
  
  // Extract tokens from titles
  const originalTokens = tokenize(original.title);
  const candidateTokens = tokenize(candidate.title);
  
  // 1. Token Overlap Score (40% weight)
  const tokenScore = calculateTokenOverlap(originalTokens, candidateTokens);
  
  // 2. Text Similarity Score (30% weight)
  const similarityScore = calculateTextSimilarity(original.title, candidate.title);
  
  // 3. Price Similarity Score (20% weight)
  let priceScore = 0;
  if (original.price && candidate.price) {
    priceScore = calculatePriceSimilarity(original.price, candidate.price);
  } else {
    // If no price available, don't penalize
    priceScore = 0.5;
  }
  
  // 4. Brand Match (10% weight)
  let brandScore = 0;
  const originalBrand = extractBrand(original.title);
  const candidateBrand = extractBrand(candidate.title);
  
  if (originalBrand && candidateBrand) {
    brandScore = originalBrand.toLowerCase() === candidateBrand.toLowerCase() ? 1 : 0;
  } else {
    // If no brand detected, give neutral score
    brandScore = 0.5;
  }
  
  // Calculate weighted final score
  const finalScore = (
    tokenScore * 0.40 +
    similarityScore * 0.30 +
    priceScore * 0.20 +
    brandScore * 0.10
  );
  
  return Math.round(finalScore * 100); // Convert to percentage
}

/**
 * Match products and categorize by confidence
 * @param {Object} original - Original product
 * @param {Array<Object>} candidates - Array of candidate products
 * @returns {Object} Categorized matches
 */
function matchProducts(original, candidates) {
  if (!original || !candidates || !candidates.length) {
    return {
      exactMatches: [],
      similarProducts: [],
      discarded: []
    };
  }
  
  console.log(`🔍 Matching against ${candidates.length} candidates`);
  
  const exactMatches = [];
  const similarProducts = [];
  const discarded = [];
  
  candidates.forEach(candidate => {
    const score = calculateMatchScore(original, candidate);
    
    const match = {
      ...candidate,
      matchScore: score,
      matchConfidence: score >= Config.EXACT_MATCH_THRESHOLD ? 'exact' :
                       score >= Config.SIMILAR_MATCH_THRESHOLD ? 'similar' : 'low'
    };
    
    if (score >= Config.EXACT_MATCH_THRESHOLD) {
      exactMatches.push(match);
      console.log(`✅ Exact match (${score}%): ${candidate.siteName}`);
    } else if (score >= Config.SIMILAR_MATCH_THRESHOLD) {
      similarProducts.push(match);
      console.log(`⚠️ Similar (${score}%): ${candidate.siteName}`);
    } else {
      discarded.push(match);
      console.log(`❌ Discarded (${score}%): ${candidate.siteName}`);
    }
  });
  
  // Sort by match score (highest first)
  exactMatches.sort((a, b) => b.matchScore - a.matchScore);
  similarProducts.sort((a, b) => b.matchScore - a.matchScore);
  
  return {
    exactMatches: exactMatches,
    similarProducts: similarProducts,
    discarded: discarded,
    stats: {
      total: candidates.length,
      exact: exactMatches.length,
      similar: similarProducts.length,
      discarded: discarded.length
    }
  };
}

/**
 * Find best deal from matched products
 * @param {Array<Object>} products - Array of matched products
 * @returns {Object|null} Best deal product
 */
function findBestDeal(products) {
  if (!products || !products.length) return null;
  
  // Filter products with valid prices
  const withPrices = products.filter(p => p.price && p.price > 0);
  
  if (!withPrices.length) return null;
  
  // Sort by price (lowest first)
  withPrices.sort((a, b) => a.price - b.price);
  
  return withPrices[0];
}

/**
 * Calculate savings compared to original
 * @param {Object} original - Original product
 * @param {Object} bestDeal - Best deal product
 * @returns {Object} Savings information
 */
function calculateSavings(original, bestDeal) {
  if (!original?.price || !bestDeal?.price) {
    return {
      amount: 0,
      percentage: 0,
      hasSavings: false
    };
  }
  
  const savings = original.price - bestDeal.price;
  const percentage = (savings / original.price) * 100;
  
  return {
    amount: Math.round(savings),
    percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
    hasSavings: savings > 0,
    originalPrice: original.price,
    bestPrice: bestDeal.price
  };
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateMatchScore,
    matchProducts,
    findBestDeal,
    calculateSavings,
    levenshtein,
    tokenize
  };
}
