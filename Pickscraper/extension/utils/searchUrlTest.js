/**
 * Search URL Test Suite
 * Tests the corrected search URL generation for all e-commerce sites
 */

/**
 * Test search URL generation for all sites
 */
async function testSearchUrlGeneration() {
  console.log('🧪 TESTING SEARCH URL GENERATION');
  console.log('='.repeat(50));
  
  // Test keywords for different product types
  const testKeywords = [
    "iphone 15 pro 128gb",
    "samsung galaxy s24",
    "nike air max 270",
    "macbook pro m3",
    "boat rockerz 450"
  ];
  
  // Get all available sites
  const sites = await PriceComparison.getAllAvailableSites();
  
  console.log(`Found ${sites.length} sites to test`);
  
  for (const keyword of testKeywords) {
    console.log(`\n🔍 Testing keyword: "${keyword}"`);
    console.log('-'.repeat(40));
    
    for (const site of sites) {
      try {
        const searchUrl = PriceComparison.buildSearchUrl(site, keyword);
        
        // Validate URL structure
        const isValidUrl = searchUrl.startsWith('https://') && searchUrl.includes(site.domain);
        const hasKeywords = searchUrl.toLowerCase().includes(encodeURIComponent(keyword.toLowerCase()));
        
        console.log(`${site.name}:`);
        console.log(`  URL: ${searchUrl}`);
        console.log(`  Valid: ${isValidUrl ? '✅' : '❌'}`);
        console.log(`  Contains Keywords: ${hasKeywords ? '✅' : '❌'}`);
        
        if (!isValidUrl || !hasKeywords) {
          console.log(`  ⚠️ ISSUE DETECTED`);
        }
        
      } catch (error) {
        console.log(`${site.name}: ❌ ERROR - ${error.message}`);
      }
    }
  }
}

/**
 * Test specific site URL patterns
 */
function testSiteSpecificUrls() {
  console.log('\n🔗 TESTING SITE-SPECIFIC URL PATTERNS');
  console.log('='.repeat(50));
  
  const testCases = [
    {
      site: { name: 'Amazon India', domain: 'amazon.in' },
      keyword: 'iphone 15 pro',
      expectedPattern: 'amazon.in/s?k=iphone+15+pro'
    },
    {
      site: { name: 'Flipkart', domain: 'flipkart.com' },
      keyword: 'samsung galaxy s24',
      expectedPattern: 'flipkart.com/search?q=samsung+galaxy+s24'
    },
    {
      site: { name: 'Croma', domain: 'croma.com' },
      keyword: 'macbook pro',
      expectedPattern: 'croma.com/search/-/N-0?Ntt='
    },
    {
      site: { name: 'Tata CLiQ', domain: 'tatacliq.com' },
      keyword: 'nike shoes',
      expectedPattern: 'tatacliq.com/search/?searchCategory=all&text=nike+shoes'
    },
    {
      site: { name: 'Snapdeal', domain: 'snapdeal.com' },
      keyword: 'iphone 15',
      expectedPattern: 'snapdeal.com/search?keyword=iphone+15'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 Testing ${testCase.site.name}:`);
    
    const generatedUrl = PriceComparison.buildSearchUrl(testCase.site, testCase.keyword);
    const containsPattern = generatedUrl.includes(testCase.expectedPattern.split('?')[0]);
    
    console.log(`  Generated: ${generatedUrl}`);
    console.log(`  Expected Pattern: ${testCase.expectedPattern}`);
    console.log(`  Match: ${containsPattern ? '✅' : '❌'}`);
    
    if (!containsPattern) {
      console.log(`  ⚠️ URL pattern doesn't match expected structure`);
    }
  }
}

/**
 * Test URL accessibility (check if URLs are reachable)
 */
async function testUrlAccessibility() {
  console.log('\n🌐 TESTING URL ACCESSIBILITY');
  console.log('='.repeat(50));
  
  const testKeyword = "test product";
  const sites = await PriceComparison.getAllAvailableSites();
  
  console.log('Note: This test generates URLs but does not actually visit them.');
  console.log('Copy and paste these URLs in your browser to verify they work:\n');
  
  for (const site of sites.slice(0, 5)) { // Test first 5 sites
    const searchUrl = PriceComparison.buildSearchUrl(site, testKeyword);
    console.log(`${site.name}:`);
    console.log(`  ${searchUrl}`);
    console.log(`  👆 Copy this URL and test in browser\n`);
  }
}

/**
 * Validate URL encoding
 */
function testUrlEncoding() {
  console.log('\n🔤 TESTING URL ENCODING');
  console.log('='.repeat(50));
  
  const specialKeywords = [
    "iphone 15 pro max",           // Spaces
    "samsung galaxy s24+",         // Special characters
    "nike air max 270 (black)",   // Parentheses
    "macbook pro 14\" m3",         // Quotes
    "boat rockerz 450 - black"    // Hyphens
  ];
  
  const testSite = { name: 'Amazon India', domain: 'amazon.in' };
  
  for (const keyword of specialKeywords) {
    console.log(`\nKeyword: "${keyword}"`);
    
    const searchUrl = PriceComparison.buildSearchUrl(testSite, keyword);
    const encodedPortion = searchUrl.split('k=')[1]?.split('&')[0];
    
    console.log(`  Encoded: ${encodedPortion}`);
    console.log(`  Decoded: ${decodeURIComponent(encodedPortion || '')}`);
    
    // Check if encoding is proper
    const isProperlyEncoded = encodedPortion && !encodedPortion.includes(' ');
    console.log(`  Properly Encoded: ${isProperlyEncoded ? '✅' : '❌'}`);
  }
}

/**
 * Run all search URL tests
 */
async function runAllSearchUrlTests() {
  console.log('🚀 STARTING SEARCH URL TEST SUITE');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Basic URL generation
    await testSearchUrlGeneration();
    
    // Test 2: Site-specific patterns
    testSiteSpecificUrls();
    
    // Test 3: URL encoding
    testUrlEncoding();
    
    // Test 4: Accessibility check
    await testUrlAccessibility();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 SEARCH URL TESTING COMPLETE');
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Copy and test the generated URLs in your browser');
    console.log('2. Verify that search results appear for each site');
    console.log('3. Check if the search terms are properly filled in search boxes');
    console.log('4. Report any sites that don\'t work for further fixing');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

/**
 * Quick test for a specific site
 */
function quickTestSite(siteName, keyword) {
  console.log(`🔍 Quick test for ${siteName} with "${keyword}"`);
  
  const sites = PriceComparison.getAllAvailableSites();
  const site = sites.find(s => s.name.toLowerCase().includes(siteName.toLowerCase()));
  
  if (!site) {
    console.log(`❌ Site "${siteName}" not found`);
    return;
  }
  
  const searchUrl = PriceComparison.buildSearchUrl(site, keyword);
  console.log(`Generated URL: ${searchUrl}`);
  console.log(`👆 Copy this URL and test in browser`);
  
  return searchUrl;
}

// Export functions for browser console use
if (typeof window !== 'undefined') {
  window.testSearchUrlGeneration = testSearchUrlGeneration;
  window.testSiteSpecificUrls = testSiteSpecificUrls;
  window.testUrlAccessibility = testUrlAccessibility;
  window.testUrlEncoding = testUrlEncoding;
  window.runAllSearchUrlTests = runAllSearchUrlTests;
  window.quickTestSite = quickTestSite;
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testSearchUrlGeneration,
    testSiteSpecificUrls,
    testUrlAccessibility,
    testUrlEncoding,
    runAllSearchUrlTests,
    quickTestSite
  };
}