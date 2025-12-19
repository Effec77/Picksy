/**
 * Email Notification System for Picksy
 * Sends price drop alerts and other notifications via email
 * 
 * NOTE: This requires a backend API to send emails
 * For MVP, we'll use a simple webhook approach
 */

/**
 * Email service configuration
 * Users can configure their preferred email service
 */
const EmailConfig = {
  // Service type: 'webhook', 'sendgrid', 'mailgun', 'ses'
  serviceType: 'webhook',
  
  // Webhook URL (for simple email services like Zapier, Make.com, n8n)
  webhookUrl: null,
  
  // User email address
  userEmail: null,
  
  // Email preferences
  preferences: {
    priceDrops: true,
    targetPriceReached: true,
    stockAlerts: true,
    weeklyDigest: false
  }
};

/**
 * Initialize email configuration from storage
 * @returns {Promise<Object>} Email configuration
 */
async function initEmailConfig() {
  try {
    const result = await chrome.storage.sync.get(['emailConfig']);
    if (result.emailConfig) {
      Object.assign(EmailConfig, result.emailConfig);
    }
    return EmailConfig;
  } catch (error) {
    console.error('Failed to load email config:', error);
    return EmailConfig;
  }
}

/**
 * Save email configuration
 * @param {Object} config - Email configuration
 * @returns {Promise<boolean>} Success status
 */
async function saveEmailConfig(config) {
  try {
    await chrome.storage.sync.set({ emailConfig: config });
    Object.assign(EmailConfig, config);
    return true;
  } catch (error) {
    console.error('Failed to save email config:', error);
    return false;
  }
}

/**
 * Check if email notifications are configured
 * @returns {boolean} True if configured
 */
function isEmailConfigured() {
  return EmailConfig.userEmail && 
         (EmailConfig.webhookUrl || EmailConfig.serviceType !== 'webhook');
}

/**
 * Send email via webhook
 * @param {Object} emailData - Email data
 * @returns {Promise<boolean>} Success status
 */
async function sendViaWebhook(emailData) {
  if (!EmailConfig.webhookUrl) {
    throw new Error('Webhook URL not configured');
  }
  
  try {
    const response = await fetch(EmailConfig.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: EmailConfig.userEmail,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        metadata: {
          productUrl: emailData.productUrl,
          productTitle: emailData.productTitle,
          timestamp: Date.now()
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }
    
    console.log('✅ Email sent via webhook');
    return true;
  } catch (error) {
    console.error('❌ Webhook email failed:', error);
    throw error;
  }
}

/**
 * Generate price drop email HTML
 * @param {Object} data - Email data
 * @returns {string} HTML content
 */
function generatePriceDropEmail(data) {
  const { productTitle, oldPrice, newPrice, savings, savingsPercent, productUrl, siteName, imageUrl } = data;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Price Drop Alert - Picksy</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">🎉 Price Drop Alert!</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Great news! The product you're tracking just dropped in price</p>
            </td>
          </tr>
          
          <!-- Product Info -->
          <tr>
            <td style="padding: 30px;">
              ${imageUrl ? `<img src="${imageUrl}" alt="${productTitle}" style="width: 100%; max-width: 300px; height: auto; border-radius: 8px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">` : ''}
              
              <h2 style="margin: 0 0 15px 0; color: #333; font-size: 20px; line-height: 1.4;">${productTitle}</h2>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 10px 0;">
                      <span style="color: #666; font-size: 14px;">Previous Price:</span><br>
                      <span style="color: #999; font-size: 18px; text-decoration: line-through;">₹${oldPrice.toLocaleString()}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0;">
                      <span style="color: #666; font-size: 14px;">New Price:</span><br>
                      <span style="color: #28a745; font-size: 28px; font-weight: bold;">₹${newPrice.toLocaleString()}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0;">
                      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px; border-radius: 8px; text-align: center;">
                        <span style="font-size: 24px; font-weight: bold;">💰 You Save: ₹${savings.toLocaleString()}</span><br>
                        <span style="font-size: 16px; opacity: 0.9;">(${savingsPercent}% off)</span>
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #666; font-size: 14px; margin: 20px 0;">
                📍 <strong>Available at:</strong> ${siteName}
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${productUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                      🛒 View Product Now
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #999; font-size: 13px; text-align: center; margin: 20px 0 0 0;">
                ⚡ Prices can change anytime. Act fast to grab this deal!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 13px;">
                You're receiving this because you're tracking this product on <strong>Picksy</strong>
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                <a href="#" style="color: #667eea; text-decoration: none;">Manage Preferences</a> | 
                <a href="#" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Generate target price reached email HTML
 * @param {Object} data - Email data
 * @returns {string} HTML content
 */
function generateTargetPriceEmail(data) {
  const { productTitle, targetPrice, currentPrice, productUrl, siteName } = data;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Target Price Reached - Picksy</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">🎯 Target Price Reached!</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Your target price has been reached</p>
            </td>
          </tr>
          
          <!-- Product Info -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 15px 0; color: #333; font-size: 20px; line-height: 1.4;">${productTitle}</h2>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 10px 0;">
                      <span style="color: #666; font-size: 14px;">Your Target Price:</span><br>
                      <span style="color: #333; font-size: 20px; font-weight: bold;">₹${targetPrice.toLocaleString()}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0;">
                      <span style="color: #666; font-size: 14px;">Current Price:</span><br>
                      <span style="color: #28a745; font-size: 28px; font-weight: bold;">₹${currentPrice.toLocaleString()}</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #666; font-size: 14px; margin: 20px 0;">
                📍 <strong>Available at:</strong> ${siteName}
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${productUrl}" style="display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(240, 147, 251, 0.4);">
                      🛒 Buy Now
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 13px;">
                You're receiving this because you set a target price on <strong>Picksy</strong>
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                <a href="#" style="color: #f5576c; text-decoration: none;">Manage Preferences</a> | 
                <a href="#" style="color: #f5576c; text-decoration: none;">Unsubscribe</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Send price drop notification email
 * @param {Object} data - Notification data
 * @returns {Promise<boolean>} Success status
 */
async function sendPriceDropEmail(data) {
  if (!isEmailConfigured()) {
    console.warn('Email not configured, skipping notification');
    return false;
  }
  
  if (!EmailConfig.preferences.priceDrops) {
    console.log('Price drop emails disabled');
    return false;
  }
  
  const emailData = {
    subject: `🎉 Price Drop Alert: ${data.productTitle.substring(0, 50)}...`,
    html: generatePriceDropEmail(data),
    text: `Price Drop Alert!\n\n${data.productTitle}\n\nOld Price: ₹${data.oldPrice}\nNew Price: ₹${data.newPrice}\nYou Save: ₹${data.savings} (${data.savingsPercent}%)\n\nView: ${data.productUrl}`,
    productUrl: data.productUrl,
    productTitle: data.productTitle
  };
  
  try {
    await sendViaWebhook(emailData);
    console.log('✅ Price drop email sent');
    return true;
  } catch (error) {
    console.error('❌ Failed to send price drop email:', error);
    return false;
  }
}

/**
 * Send target price reached notification email
 * @param {Object} data - Notification data
 * @returns {Promise<boolean>} Success status
 */
async function sendTargetPriceEmail(data) {
  if (!isEmailConfigured()) {
    console.warn('Email not configured, skipping notification');
    return false;
  }
  
  if (!EmailConfig.preferences.targetPriceReached) {
    console.log('Target price emails disabled');
    return false;
  }
  
  const emailData = {
    subject: `🎯 Target Price Reached: ${data.productTitle.substring(0, 50)}...`,
    html: generateTargetPriceEmail(data),
    text: `Target Price Reached!\n\n${data.productTitle}\n\nTarget: ₹${data.targetPrice}\nCurrent: ₹${data.currentPrice}\n\nView: ${data.productUrl}`,
    productUrl: data.productUrl,
    productTitle: data.productTitle
  };
  
  try {
    await sendViaWebhook(emailData);
    console.log('✅ Target price email sent');
    return true;
  } catch (error) {
    console.error('❌ Failed to send target price email:', error);
    return false;
  }
}

// Initialize on load
initEmailConfig();

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initEmailConfig,
    saveEmailConfig,
    isEmailConfigured,
    sendPriceDropEmail,
    sendTargetPriceEmail,
    EmailConfig
  };
}
