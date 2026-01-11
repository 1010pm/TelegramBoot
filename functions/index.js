/**
 * Telegram Bot - Firebase Functions Version with Genkit AI
 * 
 * This is the Firebase Cloud Functions deployment version of the bot.
 * Receives messages from Telegram and responds intelligently using Genkit + Gemini
 * 
 * NOTE: This is a simplified version for Firebase deployment.
 * For the full-featured version with session memory and Gmail integration,
 * see the main index.js file in the root directory.
 * 
 * Current Status:
 * - Genkit AI is initialized but not fully integrated (using fallback responses)
 * - Firebase Firestore is configured for user data storage
 * - Intent detection logic is simplified (not using AI)
 * 
 * TODO: Complete Genkit AI integration for smart replies
 */

require('dotenv').config();
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const { genkit } = require('genkit');
const { gemini15Flash, googleAI } = require('@genkit-ai/googleai');

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Set API Key as environment variable for Genkit
process.env.GOOGLE_GENAI_API_KEY = process.env.GEMINI_API_KEY || functions.config().gemini?.key;

// Initialize Genkit with Google AI plugin
// NOTE: Currently initialized but not actively used - fallback responses are used instead
const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash, // Default model: Gemini 1.5 Flash
});

// Bot Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || functions.config().telegram?.token;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// =====================================
// Send Telegram Message
// =====================================
/**
 * Sends a message to a Telegram chat
 * @param {number} chatId - The chat ID to send the message to
 * @param {string} text - The message text to send
 */
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });
  } catch (error) {
    console.error('Error sending message:', error.message);
  }
}

// =====================================
// Get Smart Reply (Temporary Fallback)
// =====================================
/**
 * Generates a smart reply to user message
 * 
 * NOTE: Currently returns a simple template response.
 * This is a temporary implementation until Genkit AI is fully integrated.
 * 
 * @param {string} userMessage - The user's message
 * @param {string} userName - The user's first name
 * @returns {string} The bot's reply message
 */
async function getSmartReply(userMessage, userName) {
  // Simple fallback response without Genkit - for testing
  // TODO: Integrate Genkit AI for intelligent responses
  return `مرحباً ${userName}! 👋

أنا بوت واصل الذكي.

رسالتك كانت: "${userMessage}"

يمكنني مساعدتك في:
📧 إرسال إيميلات
📅 إدارة التقويم
📁 رفع ملفات

اكتب "مساعدة" لمعرفة المزيد!`;
}

// =====================================
// Telegram Webhook Handler
// =====================================
/**
 * Cloud Function to handle Telegram webhook updates
 * This function receives POST requests from Telegram when users send messages
 * 
 * Process:
 * 1. Validates the request method (must be POST)
 * 2. Extracts message data from the webhook payload
 * 3. Saves user data to Firestore
 * 4. Generates a reply using getSmartReply()
 * 5. Sends the reply back to the user
 */
exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const update = req.body;
    
    // تأكد أن الرسالة نصية
    if (!update.message || !update.message.text) {
      return res.status(200).send('ok');
    }

    const chatId = update.message.chat.id;
    const text = update.message.text;
    const firstName = update.message.from.first_name || 'صديقي';

    console.log(`Message from ${chatId}: ${text}`);

    // حفظ المستخدم
    const userId = `telegram:${chatId}`;
    await db.collection('users').doc(userId).set({
      telegramId: chatId,
      name: firstName,
      lastMessage: text,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // الرد الذكي باستخدام Genkit AI
    const reply = await getSmartReply(text, firstName);

    // إرسال الرد
    await sendMessage(chatId, reply);

    return res.status(200).send('ok');

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).send('Internal Server Error');
  }
});

// =====================================
// AI Logic - Intent Detection (Simplified)
// =====================================
/**
 * Cloud Function for intent detection
 * 
 * Analyzes user messages to determine their intent using simple pattern matching.
 * This is a simplified version - the main bot uses AI for intent detection.
 * 
 * Supported intents:
 * - send_email: User wants to send an email
 * - create_event: User wants to create a calendar event
 * - upload_file: User wants to upload a file
 * 
 * Returns a JSON object with intent information:
 * {
 *   action: string,
 *   confidence: number (0.0-1.0),
 *   parameters: object,
 *   message: string
 * }
 */
exports.aiLogic = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { text, userId } = req.body;
    const lowerText = (text || '').toLowerCase();

    let intent = {
      action: 'unknown',
      confidence: 0.0,
      parameters: {},
      message: text
    };

    // كشف الإيميل
    if (lowerText.includes('ايميل') || lowerText.includes('email') || lowerText.includes('أرسل')) {
      const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
      intent = {
        action: 'send_email',
        confidence: emailMatch ? 0.9 : 0.6,
        parameters: {
          recipient: emailMatch ? emailMatch[0] : null,
          subject: 'رسالة من Telegram Bot',
          message: text
        }
      };
    }
    // كشف الحدث
    else if (lowerText.includes('حدث') || lowerText.includes('اجتماع') || lowerText.includes('موعد')) {
      intent = {
        action: 'create_event',
        confidence: 0.7,
        parameters: {
          title: 'حدث جديد',
          description: text
        }
      };
    }
    // كشف الملف
    else if (lowerText.includes('ملف') || lowerText.includes('رفع') || lowerText.includes('upload')) {
      intent = {
        action: 'upload_file',
        confidence: 0.7,
        parameters: {
          fileName: 'file.pdf'
        }
      };
    }

    return res.status(200).json(intent);

  } catch (error) {
    console.error('AI Logic Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// =====================================
// Health Check Endpoint
// =====================================
/**
 * Health check endpoint to verify the bot is running
 * Returns status and timestamp
 */
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Telegram Bot is running!'
  });
});
