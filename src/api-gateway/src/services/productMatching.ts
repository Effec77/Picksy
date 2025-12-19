import { ProductInfo } from '../../../shared/types';
import { logger } from '../utils/logger';

interface MatchScore {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  factors: MatchFactor[];
}

interface MatchFactor {
  type: 'title' | 'brand' | 'model' | 'category' | 'price' | 'retailer';
  score: number;
  weight: number;
}

interface NormalizedProduct {
  originalProduct: ProductInfo;
  normalizedTitle: string;
  normalizedBrand?: string;
  normalizedModel?: string;
  normalizedCategory: string;
  keywords: string[];
  priceRange?: { min: number; max: number };
}

interface DuplicateGroup {
  id: string;
  products: ProductInfo[];
  canonicalProduct: ProductInfo;
  confidence: number;
  mergedAt: Date;
}

export class ProductMatchingService {
  private readonly titleSimilarityThreshold = 0.7;
  private readonly highConfidenceThreshold = 0.85;
  private readonly mediumConfidenceThreshold = 0.65;
  private readonly duplicateGroups = new Map<string, DuplicateGroup>();

  /**
   * Find matching products using fuzzy matching
   */
  async findMatches(targetProduct: ProductInfo, candidates: ProductInfo[]): Promise<Array<{ product: ProductInfo; score: MatchScore }>> {
    try {
      const normalizedTarget = this.normalizeProduct(targetProduct);
      const matches: Array<{ product: ProductInfo; score: MatchScore }> = [];

      for (const candidate of candidates) {
        if (candidate.id === targetProduct.id) {
          continue; // Skip self
        }

        const normalizedCandidate = this.normalizeProduct(candidate);
        const matchScore = this.calculateMatchScore(normalizedTarget, normalizedCandidate);

        if (matchScore.score >= this.mediumConfidenceThreshold) {
          matches.push({
            product: candidate,
            score: matchScore
          });
        }
      }

      // Sort by score descending
      matches.sort((a, b) => b.score.score - a.score.score);

      logger.info(`Found ${matches.length} potential matches for product ${targetProduct.id}`);
      return matches;
    } catch (error) {
      logger.error(`Error finding matches for product ${targetProduct.id}:`, error);
      return [];
    }
  }

  /**
   * Detect and merge duplicate products
   */
  async detectDuplicates(products: ProductInfo[]): Promise<DuplicateGroup[]> {
    try {
      const duplicateGroups: DuplicateGroup[] = [];
      const processed = new Set<string>();

      for (const product of products) {
        if (processed.has(product.id)) {
          continue;
        }

        const matches = await this.findMatches(product, products);
        const highConfidenceMatches = matches.filter(
          match => match.score.confidence === 'high'
        );

        if (highConfidenceMatches.length > 0) {
          const groupProducts = [product, ...highConfidenceMatches.map(m => m.product)];
          const canonicalProduct = this.selectCanonicalProduct(groupProducts);
          
          const duplicateGroup: DuplicateGroup = {
            id: this.generateGroupId(groupProducts),
            products: groupProducts,
            canonicalProduct,
            confidence: this.calculateGroupConfidence(highConfidenceMatches),
            mergedAt: new Date()
          };

          duplicateGroups.push(duplicateGroup);
          this.duplicateGroups.set(duplicateGroup.id, duplicateGroup);

          // Mark all products in group as processed
          groupProducts.forEach(p => processed.add(p.id));
        } else {
          processed.add(product.id);
        }
      }

      logger.info(`Detected ${duplicateGroups.length} duplicate groups from ${products.length} products`);
      return duplicateGroups;
    } catch (error) {
      logger.error('Error detecting duplicates:', error);
      return [];
    }
  }

  /**
   * Normalize product data for consistent matching
   */
  normalizeProduct(product: ProductInfo): NormalizedProduct {
    try {
      const normalizedTitle = this.normalizeText(product.title);
      const normalizedBrand = product.brand ? this.normalizeText(product.brand) : undefined;
      const normalizedModel = product.model ? this.normalizeText(product.model) : undefined;
      const normalizedCategory = this.normalizeCategory(product.category);
      const keywords = this.extractKeywords(normalizedTitle);

      return {
        originalProduct: product,
        normalizedTitle,
        normalizedBrand,
        normalizedModel,
        normalizedCategory,
        keywords
      };
    } catch (error) {
      logger.error(`Error normalizing product ${product.id}:`, error);
      throw error;
    }
  }

  /**
   * Merge duplicate products into canonical representation
   */
  mergeDuplicates(duplicateGroup: DuplicateGroup): ProductInfo {
    try {
      const { products, canonicalProduct } = duplicateGroup;
      
      // Start with canonical product as base
      const mergedProduct: ProductInfo = { ...canonicalProduct };

      // Merge additional information from other products
      for (const product of products) {
        if (product.id === canonicalProduct.id) {
          continue;
        }

        // Use more complete information when available
        if (!mergedProduct.brand && product.brand) {
          mergedProduct.brand = product.brand;
        }
        if (!mergedProduct.model && product.model) {
          mergedProduct.model = product.model;
        }
        if (!mergedProduct.imageUrl && product.imageUrl) {
          mergedProduct.imageUrl = product.imageUrl;
        }

        // Use more specific category if available
        if (product.category !== 'unknown' && mergedProduct.category === 'unknown') {
          mergedProduct.category = product.category;
        }
      }

      logger.info(`Merged ${products.length} products into canonical product ${canonicalProduct.id}`);
      return mergedProduct;
    } catch (error) {
      logger.error(`Error merging duplicate group ${duplicateGroup.id}:`, error);
      throw error;
    }
  }

  /**
   * Get duplicate groups
   */
  getDuplicateGroups(): DuplicateGroup[] {
    return Array.from(this.duplicateGroups.values());
  }

  /**
   * Calculate match score between two normalized products
   */
  private calculateMatchScore(product1: NormalizedProduct, product2: NormalizedProduct): MatchScore {
    const factors: MatchFactor[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // Title similarity (highest weight)
    const titleScore = this.calculateStringSimilarity(product1.normalizedTitle, product2.normalizedTitle);
    const titleWeight = 0.4;
    factors.push({ type: 'title', score: titleScore, weight: titleWeight });
    totalScore += titleScore * titleWeight;
    totalWeight += titleWeight;

    // Brand similarity
    if (product1.normalizedBrand && product2.normalizedBrand) {
      const brandScore = this.calculateStringSimilarity(product1.normalizedBrand, product2.normalizedBrand);
      const brandWeight = 0.2;
      factors.push({ type: 'brand', score: brandScore, weight: brandWeight });
      totalScore += brandScore * brandWeight;
      totalWeight += brandWeight;
    }

    // Model similarity
    if (product1.normalizedModel && product2.normalizedModel) {
      const modelScore = this.calculateStringSimilarity(product1.normalizedModel, product2.normalizedModel);
      const modelWeight = 0.15;
      factors.push({ type: 'model', score: modelScore, weight: modelWeight });
      totalScore += modelScore * modelWeight;
      totalWeight += modelWeight;
    }

    // Category similarity
    const categoryScore = product1.normalizedCategory === product2.normalizedCategory ? 1.0 : 0.0;
    const categoryWeight = 0.1;
    factors.push({ type: 'category', score: categoryScore, weight: categoryWeight });
    totalScore += categoryScore * categoryWeight;
    totalWeight += categoryWeight;

    // Keyword overlap
    const keywordScore = this.calculateKeywordOverlap(product1.keywords, product2.keywords);
    const keywordWeight = 0.15;
    factors.push({ type: 'title', score: keywordScore, weight: keywordWeight });
    totalScore += keywordScore * keywordWeight;
    totalWeight += keywordWeight;

    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    
    let confidence: 'high' | 'medium' | 'low';
    if (finalScore >= this.highConfidenceThreshold) {
      confidence = 'high';
    } else if (finalScore >= this.mediumConfidenceThreshold) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      score: finalScore,
      confidence,
      factors
    };
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    const matrix: number[][] = [];
    
    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
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

    const maxLength = Math.max(str1.length, str2.length);
    const distance = matrix[str2.length][str1.length];
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate keyword overlap between two keyword arrays
   */
  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Normalize text for consistent comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }

  /**
   * Normalize category names
   */
  private normalizeCategory(category: string): string {
    const categoryMap: Record<string, string> = {
      'electronics': 'electronics',
      'electronic': 'electronics',
      'tech': 'electronics',
      'technology': 'electronics',
      'clothing': 'apparel',
      'clothes': 'apparel',
      'fashion': 'apparel',
      'apparel': 'apparel',
      'books': 'books',
      'book': 'books',
      'home': 'home_garden',
      'garden': 'home_garden',
      'kitchen': 'home_garden',
      'sports': 'sports_outdoors',
      'outdoor': 'sports_outdoors',
      'fitness': 'sports_outdoors'
    };

    const normalized = this.normalizeText(category);
    return categoryMap[normalized] || normalized;
  }

  /**
   * Extract keywords from product title
   */
  private extractKeywords(title: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
    ]);

    return title
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Limit to top 10 keywords
  }

  /**
   * Select canonical product from a group of duplicates
   */
  private selectCanonicalProduct(products: ProductInfo[]): ProductInfo {
    // Prefer products with more complete information
    return products.reduce((best, current) => {
      let bestScore = this.calculateCompletenessScore(best);
      let currentScore = this.calculateCompletenessScore(current);

      // Prefer official API sources
      if (current.url.includes('amazon') || current.url.includes('ebay')) {
        currentScore += 0.1;
      }

      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Calculate completeness score for product selection
   */
  private calculateCompletenessScore(product: ProductInfo): number {
    let score = 0;
    
    if (product.title && product.title.length > 10) score += 0.3;
    if (product.brand) score += 0.2;
    if (product.model) score += 0.2;
    if (product.category && product.category !== 'unknown') score += 0.1;
    if (product.imageUrl) score += 0.1;
    if (product.url) score += 0.1;

    return score;
  }

  /**
   * Calculate confidence for duplicate group
   */
  private calculateGroupConfidence(matches: Array<{ product: ProductInfo; score: MatchScore }>): number {
    if (matches.length === 0) return 0;
    
    const avgScore = matches.reduce((sum, match) => sum + match.score.score, 0) / matches.length;
    return avgScore;
  }

  /**
   * Generate unique ID for duplicate group
   */
  private generateGroupId(products: ProductInfo[]): string {
    const sortedIds = products.map(p => p.id).sort();
    const combined = sortedIds.join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `group_${Math.abs(hash).toString(36)}`;
  }
}

export const productMatchingService = new ProductMatchingService();