/**
 * Advanced Keyword Extraction Test Suite
 * Tests the new AI-powered keyword extraction system
 */

// Test cases covering various product types and complexities
const testCases = [
  // ELECTRONICS - Phones
  {
    title: "Apple iPhone 15 Pro Max 256GB Natural Titanium with 48MP Camera",
    category: "electronics",
    expected: {
      brand: "apple",
      model: "15 pro max",
      storage: "256gb",
      color: "natural",
      query: "apple 15 pro max 256gb natural"
    }
  },
  {
    title: "Samsung Galaxy S24 Ultra 512GB Phantom Black 5G Smartphone",
    category: "electronics", 
    expected: {
      brand: "samsung",
      model: "s24 ultra",
      storage: "512gb",
      color: "phantom",
      query: "samsung s24 ultra 512gb phantom"
    }
  },
  {
    title: "OnePlus 11R 5G (Sonic Black, 128GB) (8GB RAM)",
    category: "electronics",
    expected: {
      brand: "oneplus",
      model: "11r",
      storage: "128gb",
      memory: "8gb",
      query: "oneplus 11r 128gb 8gb sonic"
    }
  },
  
  // ELECTRONICS - Laptops
  {
    title: "Apple MacBook Air M2 Chip 13.6 inch 256GB SSD 8GB RAM Space Grey",
    category: "electronics",
    expected: {
      brand: "apple",
      model: "macbook air",
      storage: "256gb",
      memory: "8gb",
      query: "apple macbook air 256gb 8gb"
    }
  },
  {
    title: "HP Pavilion Gaming Laptop 15.6-inch FHD Intel Core i5 16GB RAM 512GB SSD",
    category: "electronics",
    expected: {
      brand: "hp",
      model: "pavilion gaming",
      storage: "512gb",
      memory: "16gb",
      query: "hp pavilion gaming 512gb 16gb"
    }
  },
  
  // ELECTRONICS - Audio
  {
    title: "boAt Rockerz 450 Wireless Bluetooth Headphones with Mic (Luscious Black)",
    category: "electronics",
    expected: {
      brand: "boat",
      model: "rockerz 450",
      color: "black",
      type: "headphones",
      query: "boat rockerz 450 headphones wireless"
    }
  },
  {
    title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones - Black",
    category: "electronics",
    expected: {
      brand: "sony",
      model: "wh-1000xm5",
      color: "black",
      type: "headphones",
      query: "sony wh-1000xm5 headphones wireless noise"
    }
  },
  
  // FASHION - Shoes
  {
    title: "Nike Air Max 270 Men's Running Shoes Black White Size 9 US",
    category: "fashion",
    expected: {
      brand: "nike",
      model: "air max 270",
      type: "shoes",
      size: "9",
      color: "black",
      query: "nike air max 270 shoes 9"
    }
  },
  {
    title: "Adidas Ultraboost 22 Women's Running Shoes Core Black Size 7.5",
    category: "fashion",
    expected: {
      brand: "adidas",
      model: "ultraboost 22",
      type: "shoes",
      size: "7.5",
      color: "black",
      query: "adidas ultraboost 22 shoes 7.5"
    }
  },
  
  // FASHION - Clothing
  {
    title: "Levi's 511 Slim Fit Jeans for Men Dark Blue Wash Size 32W x 34L",
    category: "fashion",
    expected: {
      brand: "levi",
      model: "511",
      type: "jeans",
      size: "32",
      color: "blue",
      query: "levi 511 jeans 32 blue"
    }
  },
  {
    title: "Nike Dri-FIT Men's Training T-Shirt Black Size Large",
    category: "fashion",
    expected: {
      brand: "nike",
      type: "tshirt",
      size: "large",
      color: "black",
      query: "nike tshirt large black training"
    }
  },
  
  // BEAUTY
  {
    title: "Maybelline Fit Me Matte + Poreless Foundation 30ml Shade 128 Warm Nude",
    category: "beauty",
    expected: {
      brand: "maybelline",
      type: "foundation",
      variant: "128",
      color: "nude",
      query: "maybelline foundation 128 nude matte"
    }
  },
  {
    title: "Lakme 9to5 Primer + Matte Lip Color Red Velvet ML01",
    category: "beauty",
    expected: {
      brand: "lakme",
      type: "lipstick",
      color: "red",
      variant: "ml01",
      query: "lakme lipstick red ml01 matte"
    }
  },
  
  // COMPLEX CASES
  {
    title: "Apple iPhone 15 Pro 128GB Blue Titanium (Unlocked) with AppleCare+ Protection Plan",
    category: "electronics",
    expected: {
      brand: "apple",
      model: "15 pro",
      storage: "128gb",
      color: "blue",
      query: "apple 15 pro 128gb blue titanium"
    }
  },
  {
    title: "Samsung 65-inch 4K Ultra HD Smart QLED TV QN65Q80C with Alexa Built-in (2023 Model)",
    category: "electronics",
    expected: {
      brand: "samsung",
      model: "qn65q80c",
      type: "tv",
      query: "samsung qn65q80c tv 4k smart"
    }
  }
];

/**
 * Test the advanced keyword extraction system
 */
async function testAdvancedKeywordExtraction() {
  console.log('🧪 TESTING ADVANCED KEYWORD EXTRACTION SYSTEM');
  console.log('='.repeat(60));
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📝 Test ${i + 1}/${totalTests}: ${testCase.title.substring(0, 50)}...`);
    
    try {
      // Test category detection
      const detectedCategory = PriceComparison.detectProductCategory({ title: testCase.title });
      console.log(`   Category: Expected "${testCase.category}", Got "${detectedCategory}"`);
      
      // Test advanced product identification
      const productInfo = PriceComparison.extractAdvancedProductIdentifiers(testCase.title, detectedCategory);
      console.log(`   Product Info:`, productInfo);
      
      // Test final keyword extraction
      const extractedQuery = PriceComparison.extractSearchKeywords(testCase.title);
      console.log(`   Query: Expected "${testCase.expected.query}", Got "${extractedQuery}"`);
      
      // Validate results
      let testPassed = true;
      const issues = [];
      
      // Check category
      if (detectedCategory !== testCase.category) {
        issues.push(`Category mismatch: expected ${testCase.category}, got ${detectedCategory}`);
        testPassed = false;
      }
      
      // Check brand
      if (testCase.expected.brand && productInfo.brand !== testCase.expected.brand) {
        issues.push(`Brand mismatch: expected ${testCase.expected.brand}, got ${productInfo.brand}`);
        testPassed = false;
      }
      
      // Check model (if expected)
      if (testCase.expected.model && !productInfo.model?.toLowerCase().includes(testCase.expected.model.toLowerCase())) {
        issues.push(`Model mismatch: expected ${testCase.expected.model}, got ${productInfo.model}`);
        testPassed = false;
      }
      
      // Check storage (if expected)
      if (testCase.expected.storage && productInfo.storage !== testCase.expected.storage) {
        issues.push(`Storage mismatch: expected ${testCase.expected.storage}, got ${productInfo.storage}`);
        testPassed = false;
      }
      
      // Check if query contains key terms
      const queryLower = extractedQuery.toLowerCase();
      const expectedTerms = testCase.expected.query.toLowerCase().split(' ');
      const missingTerms = expectedTerms.filter(term => !queryLower.includes(term));
      
      if (missingTerms.length > 1) { // Allow 1 missing term for flexibility
        issues.push(`Query missing key terms: ${missingTerms.join(', ')}`);
        testPassed = false;
      }
      
      if (testPassed) {
        console.log(`   ✅ PASSED`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED`);
        issues.forEach(issue => console.log(`      - ${issue}`));
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`🎯 RESULTS: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Keyword extraction is working perfectly.');
  } else if (passedTests >= totalTests * 0.8) {
    console.log('✅ Most tests passed! System is working well with minor issues.');
  } else {
    console.log('⚠️ Several tests failed. Review the extraction logic.');
  }
  
  return passedTests / totalTests;
}

/**
 * Test specific product types
 */
async function testProductTypeExtraction() {
  console.log('\n🔍 TESTING PRODUCT TYPE SPECIFIC EXTRACTION');
  console.log('='.repeat(50));
  
  const typeTests = [
    {
      type: "iPhone",
      title: "Apple iPhone 15 Pro Max 1TB Natural Titanium",
      expectedFeatures: ["brand: apple", "model: 15 pro max", "storage: 1tb", "color: natural"]
    },
    {
      type: "Android Phone", 
      title: "Samsung Galaxy S24 Ultra 256GB Phantom Black 5G",
      expectedFeatures: ["brand: samsung", "model: s24 ultra", "storage: 256gb", "color: phantom"]
    },
    {
      type: "Laptop",
      title: "MacBook Pro 14-inch M3 Pro 512GB Space Black",
      expectedFeatures: ["brand: apple", "model: macbook pro", "storage: 512gb", "color: black"]
    },
    {
      type: "Sneakers",
      title: "Nike Air Jordan 1 Retro High OG Chicago Size 10",
      expectedFeatures: ["brand: nike", "model: air jordan 1", "size: 10", "color: chicago"]
    },
    {
      type: "Headphones",
      title: "Sony WH-1000XM5 Wireless Noise Cancelling Over-Ear Headphones Silver",
      expectedFeatures: ["brand: sony", "model: wh-1000xm5", "type: headphones", "color: silver"]
    }
  ];
  
  for (const test of typeTests) {
    console.log(`\n🎧 Testing ${test.type}: ${test.title}`);
    
    const productInfo = PriceComparison.extractAdvancedProductIdentifiers(
      test.title, 
      PriceComparison.detectProductCategory({ title: test.title })
    );
    
    const query = PriceComparison.extractSearchKeywords(test.title);
    
    console.log(`   Extracted Info:`, productInfo);
    console.log(`   Search Query: "${query}"`);
    console.log(`   Expected Features: ${test.expectedFeatures.join(', ')}`);
    
    // Check if key features are extracted
    let featuresFound = 0;
    for (const feature of test.expectedFeatures) {
      const [key, value] = feature.split(': ');
      if (productInfo[key] && productInfo[key].toLowerCase().includes(value.toLowerCase())) {
        featuresFound++;
      }
    }
    
    const accuracy = (featuresFound / test.expectedFeatures.length) * 100;
    console.log(`   Accuracy: ${accuracy.toFixed(1)}% (${featuresFound}/${test.expectedFeatures.length} features)`);
    
    if (accuracy >= 75) {
      console.log(`   ✅ GOOD extraction`);
    } else {
      console.log(`   ⚠️ NEEDS improvement`);
    }
  }
}

/**
 * Compare old vs new keyword extraction
 */
async function compareExtractionMethods() {
  console.log('\n⚖️ COMPARING OLD vs NEW EXTRACTION METHODS');
  console.log('='.repeat(50));
  
  const comparisonTests = [
    "Apple iPhone 15 Pro 128GB Blue",
    "Samsung Galaxy S24 Ultra 512GB Phantom Black",
    "Nike Air Max 270 Men's Running Shoes Size 9",
    "MacBook Pro 14-inch M3 Pro 512GB Space Black",
    "boAt Rockerz 450 Wireless Bluetooth Headphones"
  ];
  
  for (const title of comparisonTests) {
    console.log(`\n📱 Product: ${title}`);
    
    // New advanced method
    const newQuery = PriceComparison.extractSearchKeywords(title);
    console.log(`   New Method: "${newQuery}"`);
    
    // Simulate old method (basic word extraction)
    const oldQuery = PriceComparison.getCleanedTitleWords(title).slice(0, 4).join(' ');
    console.log(`   Old Method: "${oldQuery}"`);
    
    // Analysis
    const newTerms = newQuery.toLowerCase().split(' ');
    const oldTerms = oldQuery.toLowerCase().split(' ');
    
    console.log(`   New: ${newTerms.length} terms, Old: ${oldTerms.length} terms`);
    
    // Check for important identifiers
    const hasModel = newTerms.some(term => /\d+/.test(term) || ['pro', 'max', 'ultra', 'air'].includes(term));
    const hasStorage = newTerms.some(term => term.includes('gb') || term.includes('tb'));
    
    console.log(`   New method captures: ${hasModel ? '✅' : '❌'} model, ${hasStorage ? '✅' : '❌'} storage`);
  }
}

/**
 * Run all keyword extraction tests
 */
async function runAllKeywordTests() {
  console.log('🚀 STARTING COMPREHENSIVE KEYWORD EXTRACTION TESTS');
  console.log('='.repeat(70));
  
  try {
    // Test 1: Advanced extraction system
    const accuracy = await testAdvancedKeywordExtraction();
    
    // Test 2: Product type specific tests
    await testProductTypeExtraction();
    
    // Test 3: Compare old vs new methods
    await compareExtractionMethods();
    
    console.log('\n' + '='.repeat(70));
    console.log('🎯 OVERALL ASSESSMENT:');
    
    if (accuracy >= 0.9) {
      console.log('🎉 EXCELLENT: Keyword extraction is highly accurate and ready for production!');
    } else if (accuracy >= 0.8) {
      console.log('✅ GOOD: Keyword extraction is working well with minor room for improvement.');
    } else if (accuracy >= 0.7) {
      console.log('⚠️ FAIR: Keyword extraction needs some refinement.');
    } else {
      console.log('❌ POOR: Keyword extraction needs significant improvement.');
    }
    
    console.log('\n🔧 RECOMMENDATIONS:');
    console.log('1. Test with real products from your target sites');
    console.log('2. Monitor search result quality and adjust patterns');
    console.log('3. Add more brand/model patterns based on actual data');
    console.log('4. Consider user feedback to improve extraction rules');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Export functions for browser console use
if (typeof window !== 'undefined') {
  window.testAdvancedKeywordExtraction = testAdvancedKeywordExtraction;
  window.testProductTypeExtraction = testProductTypeExtraction;
  window.compareExtractionMethods = compareExtractionMethods;
  window.runAllKeywordTests = runAllKeywordTests;
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testAdvancedKeywordExtraction,
    testProductTypeExtraction,
    compareExtractionMethods,
    runAllKeywordTests,
    testCases
  };
}