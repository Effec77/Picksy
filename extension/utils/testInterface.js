/**
 * Testing Interface for Hybrid Extraction System
 * Allows easy testing of both Universal and AI extraction methods
 */

const TestInterface = {
  
  /**
   * Initialize testing interface
   */
  init() {
    this.createTestPanel();
    this.setupTestControls();
    console.log('🧪 Test interface initialized');
  },
  
  /**
   * Create test panel in popup
   */
  createTestPanel() {
    const testPanel = document.createElement('div');
    testPanel.id = 'testPanel';
    testPanel.innerHTML = `
      <div class="test-panel">
        <h3>🧪 Hybrid System Testing</h3>
        
        <div class="test-buttons">
          <button id="testUniversal" class="test-btn">Test Universal Only</button>
          <button id="testAI" class="test-btn">Test AI Only</button>
          <button id="testBoth" class="test-btn">Compare Both</button>
          <button id="testFallback" class="test-btn">Test Fallback</button>
        </div>
        
        <div class="test-status">
          <div id="testStatus">Ready to test...</div>
          <div id="testProgress" class="progress-bar" style="display: none;">
            <div class="progress"></div>
          </div>
        </div>
        
        <div id="testResults" class="test-results"></div>
        
        <div class="test-controls">
          <label>
            <input type="checkbox" id="verboseLogging" checked> Verbose Logging
          </label>
          <label>
            <input type="checkbox" id="forceAI"> Force AI Fallback
          </label>
        </div>
      </div>
      
      <style>
        .test-panel {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 15px;
          margin: 10px 0;
        }
        
        .test-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin: 10px 0;
        }
        
        .test-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        
        .test-btn:hover {
          background: #0056b3;
        }
        
        .test-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }
        
        .test-status {
          margin: 10px 0;
          font-size: 12px;
        }
        
        .progress-bar {
          background: #e9ecef;
          border-radius: 4px;
          height: 4px;
          overflow: hidden;
        }
        
        .progress {
          background: #007bff;
          height: 100%;
          width: 0%;
          transition: width 0.3s;
        }
        
        .test-results {
          background: #ffffff;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 10px;
          margin: 10px 0;
          max-height: 200px;
          overflow-y: auto;
          font-family: monospace;
          font-size: 11px;
        }
        
        .test-controls {
          display: flex;
          gap: 15px;
          font-size: 12px;
        }
        
        .result-success { color: #28a745; }
        .result-warning { color: #ffc107; }
        .result-error { color: #dc3545; }
      </style>
    `;
    
    // Add to popup (or create standalone test page)
    const container = document.body;
    container.appendChild(testPanel);
  },
  
  /**
   * Setup test control event listeners
   */
  setupTestControls() {
    document.getElementById('testUniversal').addEventListener('click', () => this.testUniversalOnly());
    document.getElementById('testAI').addEventListener('click', () => this.testAIOnly());
    document.getElementById('testBoth').addEventListener('click', () => this.testBothMethods());
    document.getElementById('testFallback').addEventListener('click', () => this.testFallback());
  },
  
  /**
   * Test universal extraction only
   */
  async testUniversalOnly() {
    this.log('🔍 Testing Universal Extraction Only...');
    this.setStatus('Testing universal extraction...');
    this.showProgress(true);
    
    try {
      const result = await this.callContentScript('TEST_UNIVERSAL_ONLY');
      
      if (result && result.extractionMethod === 'universal') {
        this.log(`✅ Universal extraction successful`, 'success');
        this.log(`📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`, 'success');
        this.log(`⏱️ Time: ${result.extractionTime || 'N/A'}ms`, 'success');
        this.displayResult(result);
      } else {
        this.log(`❌ Universal extraction failed`, 'error');
        this.log(`📊 Result: ${JSON.stringify(result)}`, 'warning');
      }
      
    } catch (error) {
      this.log(`❌ Test failed: ${error.message}`, 'error');
    }
    
    this.showProgress(false);
    this.setStatus('Universal test complete');
  },
  
  /**
   * Test AI extraction only
   */
  async testAIOnly() {
    this.log('🤖 Testing AI Extraction Only...');
    this.setStatus('Testing AI extraction...');
    this.showProgress(true);
    
    try {
      // Check if API key is configured
      const hasApiKey = await this.checkApiKey();
      if (!hasApiKey) {
        this.log(`❌ No API key configured - cannot test AI`, 'error');
        this.setStatus('API key required for AI testing');
        this.showProgress(false);
        return;
      }
      
      const result = await this.callContentScript('TEST_AI_ONLY');
      
      if (result && result.extractionMethod === 'ai') {
        this.log(`✅ AI extraction successful`, 'success');
        this.log(`📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`, 'success');
        this.log(`⏱️ Time: ${result.extractionTime || 'N/A'}ms`, 'success');
        this.displayResult(result);
      } else {
        this.log(`❌ AI extraction failed`, 'error');
        this.log(`📊 Result: ${JSON.stringify(result)}`, 'warning');
      }
      
    } catch (error) {
      this.log(`❌ Test failed: ${error.message}`, 'error');
    }
    
    this.showProgress(false);
    this.setStatus('AI test complete');
  },
  
  /**
   * Test both methods and compare
   */
  async testBothMethods() {
    this.log('🔄 Testing Both Methods - Comparison Mode...');
    this.setStatus('Comparing universal vs AI extraction...');
    this.showProgress(true);
    
    try {
      // Test universal first
      this.updateProgress(25);
      const universalResult = await this.callContentScript('TEST_UNIVERSAL_ONLY');
      this.log(`🔍 Universal result: ${universalResult ? 'Success' : 'Failed'}`, universalResult ? 'success' : 'warning');
      
      // Test AI second
      this.updateProgress(75);
      const aiResult = await this.callContentScript('TEST_AI_ONLY');
      this.log(`🤖 AI result: ${aiResult ? 'Success' : 'Failed'}`, aiResult ? 'success' : 'warning');
      
      // Compare results
      this.updateProgress(100);
      this.compareResults(universalResult, aiResult);
      
    } catch (error) {
      this.log(`❌ Comparison failed: ${error.message}`, 'error');
    }
    
    this.showProgress(false);
    this.setStatus('Comparison complete');
  },
  
  /**
   * Test fallback extraction
   */
  async testFallback() {
    this.log('🛡️ Testing Fallback Extraction...');
    this.setStatus('Testing fallback extraction...');
    this.showProgress(true);
    
    try {
      const result = await this.callContentScript('TEST_FALLBACK_ONLY');
      
      if (result) {
        this.log(`✅ Fallback extraction successful`, 'success');
        this.log(`📊 Method: ${result.extractionMethod}`, 'success');
        this.displayResult(result);
      } else {
        this.log(`❌ Fallback extraction failed`, 'error');
      }
      
    } catch (error) {
      this.log(`❌ Test failed: ${error.message}`, 'error');
    }
    
    this.showProgress(false);
    this.setStatus('Fallback test complete');
  },
  
  /**
   * Compare results from both methods
   */
  compareResults(universalResult, aiResult) {
    this.log('📊 COMPARISON RESULTS:', 'success');
    
    if (universalResult && aiResult) {
      // Compare titles
      const titleMatch = universalResult.title === aiResult.title;
      this.log(`📝 Title Match: ${titleMatch ? '✅' : '❌'}`, titleMatch ? 'success' : 'warning');
      
      // Compare prices
      const priceMatch = Math.abs((universalResult.price || 0) - (aiResult.price || 0)) < 1;
      this.log(`💰 Price Match: ${priceMatch ? '✅' : '❌'}`, priceMatch ? 'success' : 'warning');
      
      // Compare confidence
      const universalConf = (universalResult.confidence || 0) * 100;
      const aiConf = (aiResult.confidence || 0) * 100;
      this.log(`📊 Confidence - Universal: ${universalConf.toFixed(1)}%, AI: ${aiConf.toFixed(1)}%`);
      
      // Recommend best method
      if (universalConf > aiConf) {
        this.log(`🏆 Recommendation: Use Universal (higher confidence)`, 'success');
      } else {
        this.log(`🏆 Recommendation: Use AI (higher confidence)`, 'success');
      }
      
    } else {
      this.log(`⚠️ Cannot compare - one or both methods failed`, 'warning');
    }
  },
  
  /**
   * Display extraction result
   */
  displayResult(result) {
    this.log('📋 EXTRACTION RESULT:', 'success');
    this.log(`📝 Title: ${result.title || 'N/A'}`);
    this.log(`💰 Price: ${result.price ? '₹' + result.price.toLocaleString() : 'N/A'}`);
    this.log(`💱 Currency: ${result.currency || 'N/A'}`);
    this.log(`📦 Stock: ${result.stock || 'N/A'}`);
    this.log(`⭐ Rating: ${result.rating || 'N/A'}`);
    this.log(`🏪 Seller: ${result.seller || 'N/A'}`);
    this.log(`🔧 Method: ${result.extractionMethod || 'N/A'}`);
    this.log(`📊 Confidence: ${result.confidence ? (result.confidence * 100).toFixed(1) + '%' : 'N/A'}`);
  },
  
  /**
   * Call content script with test command
   */
  async callContentScript(testType) {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        
        chrome.tabs.sendMessage(tab.id, { 
          type: 'PICKSY_TEST',
          testType: testType,
          options: {
            verbose: document.getElementById('verboseLogging').checked,
            forceAI: document.getElementById('forceAI').checked
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Content script error:', chrome.runtime.lastError.message);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      });
    });
  },
  
  /**
   * Check if API key is configured
   */
  async checkApiKey() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['geminiApiKey'], (result) => {
        resolve(result.geminiApiKey && result.geminiApiKey.length > 0);
      });
    });
  },
  
  /**
   * Utility methods
   */
  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const resultsDiv = document.getElementById('testResults');
    
    const logEntry = document.createElement('div');
    logEntry.className = `result-${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    resultsDiv.appendChild(logEntry);
    resultsDiv.scrollTop = resultsDiv.scrollHeight;
    
    // Also log to console if verbose
    if (document.getElementById('verboseLogging')?.checked) {
      console.log(`🧪 ${message}`);
    }
  },
  
  setStatus(message) {
    document.getElementById('testStatus').textContent = message;
  },
  
  showProgress(show) {
    const progressBar = document.getElementById('testProgress');
    progressBar.style.display = show ? 'block' : 'none';
    if (!show) {
      this.updateProgress(0);
    }
  },
  
  updateProgress(percentage) {
    const progress = document.querySelector('#testProgress .progress');
    progress.style.width = `${percentage}%`;
  },
  
  clearResults() {
    document.getElementById('testResults').innerHTML = '';
  }
};

// Auto-initialize if in popup context
if (typeof chrome !== 'undefined' && chrome.tabs) {
  document.addEventListener('DOMContentLoaded', () => {
    // Add toggle button to show/hide test panel
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '🧪 Show Tests';
    toggleBtn.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999;';
    toggleBtn.onclick = () => {
      const panel = document.getElementById('testPanel');
      if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        toggleBtn.textContent = panel.style.display === 'none' ? '🧪 Show Tests' : '🧪 Hide Tests';
      } else {
        TestInterface.init();
      }
    };
    document.body.appendChild(toggleBtn);
  });
}

// Export for manual use
window.TestInterface = TestInterface;