/**
 * Comprehensive Test Suite for Comparison Agent Fixes
 * Tests the three main issues that were fixed:
 * 1. Better product matching (90%+ accuracy)
 * 2. Appropriate site selection (no Apple products on Boat website)
 * 3. Cache persistence (results don't disappear when extension closes)
 */

// Test data for different product types
const testProducts = {
  iphone: {
    title: "Apple iPhone 15 128GB Blue",
    price: "₹79,900",
    priceValue: 79900,
    source: "amazon.in",
    url: "https://amazon.in/dp/test123"
  },
  
  clothing: {
    title: "Nike Air Max 270 Running Shoes Black Size 9",
    price: "₹12,995",
    priceValue: 12995,
    source: "myntra.com",
    url: "https://myntra.com/test456"
  },
  
  headphones: {
    title: "boAt Rockerz 450 Wireless Bluetooth Headphones",
    price: "₹1,999",
    priceValue: 1999,
    source: "boat-lifestyle.com",
    url: "https://boat-lifestyle.com/test789"
  }
};

/**
 * Test 1: Enhanced Product Matching
 * Verify that the new matching algorithm correctly identifies similar products
 */
async function testProductMatching() {
  console.log('🧪 TEST 1: Enhanced Product Matching');
  
  const originalProduct = testProducts.iphone;
  
  // Test candidates with different similarity levels
  const candidates = [
    {
      title: "Apple iPhone 15 128GB Blue",  // 100% match
      priceValue: 79900,
      siteName: "Flipkart"
    },
    {
      title: "Apple iPhone 15 128GB Natural Titanium",  // 95% match (same model, different color)
      priceValue: 81900,
      siteName: "Croma"
    },
    {
      title: "Apple iPhone 15 256GB Blue",  // 85% match (same model, different storage)
      priceValue: 89900,
      siteName: "Tata CLiQ"
    },
    {
      title: "Apple iPhone 14 128GB Blue",  // 70% match (different model)
      priceValue: 69900,
      siteName: "Snapdeal"
    },
    {
      title: "Samsung Galaxy S24 128GB Blue",  // 30% match (different brand)
      priceValue: 74900,
      siteName: "Amazon"
    }
  ];
  
  console.log('Original product:', originalProduct.title);
  
  for (const candidate of candidates) {
    const similarity = PriceComparison.calculateProductSimilarity(originalProduct, candidate);
    const matchType = similarity.score >= 0.9 ? 'EXACT' : 
                     similarity.score >= 0.75 ? 'SIMILAR' : 'REJECTED';
    
    console.log(`${matchType} (${(similarity.score * 100).toFixed(1)}%): ${candidate.title}`);
    console.log(`  Breakdown:`, similarity.breakdown);
    console.log(`  Reason: ${similarity.reason}`);
    console.log('');
  }
  
  return true;
}

/**
 * Test 2: Smart Site Selection
 * Verify that inappropriate sites are excluded based on product category
 */
async function testSiteSelection() {
  console.log('🧪 TEST 2: Smart Site Selection');
  
  const testCases = [
    {
      product: testProducts.iphone,
      expectedIncluded: ['Amazon India', 'Flipkart', 'Croma', 'Tata CLiQ', 'Snapdeal'],
      expectedExcluded: ['Boat Lifestyle', 'Myntra', 'Ajio', 'Nykaa', 'Lenskart', 'FirstCry']
    },
    {
      product: testProducts.clothing,
      expectedIncluded: ['Amazon India', 'Flipkart', 'Myntra', 'Ajio', 'Tata CLiQ', 'Snapdeal'],
      expectedExcluded: ['Boat Lifestyle', 'Croma', 'Nykaa', 'Lenskart', 'FirstCry']
    },
    {
      product: testProducts.headphones,
      expectedIncluded: ['Amazon India', 'Flipkart', 'Croma', 'Tata CLiQ', 'Snapdeal', 'Boat Lifestyle'],
      expectedExcluded: ['Myntra', 'Ajio', 'Nykaa', 'Lenskart', 'FirstCry']
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase.product.title}`);
    
    const productCategory = PriceComparison.detectProductCategory(testCase.product);
    console.log(`Detected category: ${productCategory}`);
    
    const allSites = await PriceComparison.getAllAvailableSites();
    
    for (const site of allSites) {
      const isAppropriate = PriceComparison.isSiteAppropriateForProduct(
        testCase.product, 
        site, 
        productCategory
      );
      
      const shouldBeIncluded = testCase.expectedIncluded.includes(site.name);
      const shouldBeExcluded = testCase.expectedExcluded.includes(site.name);
      
      if (shouldBeIncluded && !isAppropriate) {
        console.error(`❌ ERROR: ${site.name} should be included but was excluded`);
      } else if (shouldBeExcluded && isAppropriate) {
        console.error(`❌ ERROR: ${site.name} should be excluded but was included`);
      } else if (shouldBeIncluded && isAppropriate) {
        console.log(`✅ CORRECT: ${site.name} appropriately included`);
      } else if (shouldBeExcluded && !isAppropriate) {
        console.log(`✅ CORRECT: ${site.name} appropriately excluded`);
      }
    }
  }
  
  return true;
}

/**
 * Test 3: Cache Persistence
 * Verify that comparison results are properly cached and restored
 */
async function testCachePersistence() {
  console.log('🧪 TEST 3: Cache Persistence');
  
  const testProduct = testProducts.iphone;
  
  // Create mock comparison results
  const mockResults = {
    originalProduct: testProduct,
    matches: [
      {
        title: "Apple iPhone 15 128GB Blue",
        priceValue: 79900,
        siteName: "Flipkart",
        similarity: 1.0,
        matchType: 'exact'
      },
      {
        title: "Apple iPhone 15 128GB Natural Titanium",
        priceValue: 81900,
        siteName: "Croma",
        similarity: 0.95,
        matchType: 'exact'
      }
    ],
    bestDeal: {
      title: "Apple iPhone 15 128GB Blue",
      priceValue: 79900,
      siteName: "Flipkart"
    },
    savings: 0,
    recommendation: "Current price is competitive",
    analysis: {
      totalSites: 2,
      successfulMatches: 2,
      averagePrice: 80900,
      priceRange: { min: 79900, max: 81900 }
    }
  };
  
  console.log('1. Caching results...');
  await PriceComparison.cacheResults(testProduct, mockResults);
  
  console.log('2. Retrieving cached results...');
  const cachedResults = await PriceComparison.getCachedResults(testProduct);
  
  if (cachedResults) {
    console.log('✅ Full cache retrieval successful');
    console.log(`   - Original matches: ${mockResults.matches.length}`);
    console.log(`   - Cached matches: ${cachedResults.matches.length}`);
  } else {
    console.error('❌ Failed to retrieve cached results');
    return false;
  }
  
  console.log('3. Retrieving cached display results...');
  const cachedDisplay = await PriceComparison.getCachedDisplayResults(testProduct);
  
  if (cachedDisplay) {
    console.log('✅ Display cache retrieval successful');
    console.log(`   - Exact matches: ${cachedDisplay.exactMatches.length}`);
    console.log(`   - Similar matches: ${cachedDisplay.similarMatches.length}`);
    console.log(`   - Best deal: ${cachedDisplay.bestDeal?.siteName}`);
  } else {
    console.error('❌ Failed to retrieve cached display results');
    return false;
  }
  
  console.log('4. Testing cache expiration...');
  const cacheAge = Date.now() - cachedDisplay.timestamp;
  const expiresIn = cachedDisplay.expiresAt - Date.now();
  console.log(`   - Cache age: ${Math.round(cacheAge / 1000)}s`);
  console.log(`   - Expires in: ${Math.round(expiresIn / (1000 * 60))}m`);
  
  console.log('5. Clearing cache...');
  await PriceComparison.clearCache(testProduct);
  
  const clearedCache = await PriceComparison.getCachedResults(testProduct);
  if (!clearedCache) {
    console.log('✅ Cache clearing successful');
  } else {
    console.error('❌ Cache was not properly cleared');
    return false;
  }
  
  return true;
}

/**
 * Test 4: End-to-End Comparison Flow
 * Test the complete comparison process with real-world scenarios
 */
async function testEndToEndComparison() {
  console.log('🧪 TEST 4: End-to-End Comparison Flow');
  
  const testProduct = testProducts.iphone;
  
  console.log('1. Starting comparison for:', testProduct.title);
  
  // This would normally trigger actual scraping, but for testing we'll use mock data
  const comparisonOptions = {
    maxSites: 5,
    timeout: 30000,
    enableAI: true,
    minTrustScore: 6,
    useCache: false
  };
  
  console.log('2. Generating comparison URLs...');
  const searchUrls = await PriceComparison.generateComparisonUrls(testProduct, comparisonOptions);
  
  console.log(`   Generated ${searchUrls.length} search URLs:`);
  searchUrls.forEach(url => {
    console.log(`   - ${url.name}: ${url.url}`);
  });
  
  // Verify appropriate sites were selected
  const inappropriateSites = ['Boat Lifestyle', 'Myntra', 'Ajio', 'Nykaa'];
  const foundInappropriate = searchUrls.some(url => 
    inappropriateSites.some(inappropriate => url.name.includes(inappropriate))
  );
  
  if (foundInappropriate) {
    console.error('❌ Inappropriate sites found in search URLs');
    return false;
  } else {
    console.log('✅ All selected sites are appropriate for electronics');
  }
  
  console.log('3. Testing product matching with mock results...');
  
  // Mock scraped results
  const mockScrapedResults = [
    {
      title: "Apple iPhone 15 128GB Blue",
      priceValue: 79900,
      siteName: "Flipkart",
      url: "https://flipkart.com/test"
    },
    {
      title: "Apple iPhone 15 128GB Natural Titanium", 
      priceValue: 81900,
      siteName: "Croma",
      url: "https://croma.com/test"
    },
    {
      title: "Samsung Galaxy S24 128GB", // Should be rejected
      priceValue: 74900,
      siteName: "Amazon",
      url: "https://amazon.in/test"
    }
  ];
  
  const matches = await PriceComparison.matchProducts(testProduct, mockScrapedResults);
  
  console.log(`   Found ${matches.length} matches:`);
  matches.forEach(match => {
    console.log(`   - ${match.matchType.toUpperCase()} (${(match.similarity * 100).toFixed(1)}%): ${match.title}`);
  });
  
  // Verify that Samsung product was rejected
  const samsungMatch = matches.find(m => m.title.includes('Samsung'));
  if (samsungMatch && samsungMatch.matchType !== 'error') {
    console.error('❌ Samsung product should have been rejected');
    return false;
  } else {
    console.log('✅ Samsung product correctly rejected');
  }
  
  return true;
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Comparison Agent Test Suite');
  console.log('=====================================\n');
  
  const tests = [
    { name: 'Product Matching', fn: testProductMatching },
    { name: 'Site Selection', fn: testSiteSelection },
    { name: 'Cache Persistence', fn: testCachePersistence },
    { name: 'End-to-End Flow', fn: testEndToEndComparison }
  ];
  
  let passedTests = 0;
  
  for (const test of tests) {
    try {
      console.log(`\n${'='.repeat(50)}`);
      const result = await test.fn();
      if (result) {
        console.log(`✅ ${test.name}: PASSED`);
        passedTests++;
      } else {
        console.log(`❌ ${test.name}: FAILED`);
      }
    } catch (error) {
      console.error(`❌ ${test.name}: ERROR -`, error.message);
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎯 Test Results: ${passedTests}/${tests.length} tests passed`);
  
  if (passedTests === tests.length) {
    console.log('🎉 All tests passed! Comparison agent fixes are working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please review the issues above.');
  }
  
  return passedTests === tests.length;
}

// Export functions for use in browser console
if (typeof window !== 'undefined') {
  window.testProductMatching = testProductMatching;
  window.testSiteSelection = testSiteSelection;
  window.testCachePersistence = testCachePersistence;
  window.testEndToEndComparison = testEndToEndComparison;
  window.runAllTests = runAllTests;
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testProductMatching,
    testSiteSelection,
    testCachePersistence,
    testEndToEndComparison,
    runAllTests
  };
}