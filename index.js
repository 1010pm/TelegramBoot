/**
 * 🤖 Wasl AI Bot
 * Intelligent Telegram Bot with AI Agent & Gmail Integration
 * 
 * Features:
 * - AI Agent with intent analysis
 * - Gmail email sending
 * - Session memory (last 10 messages)
 * - Context-aware responses
 * - Multilingual (Arabic & English)
 */

require('dotenv').config();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const nodemailer = require('nodemailer');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Validate required environment variables
if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in environment variables');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment variables');
  process.exit(1);
}

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Initialize Gmail
const emailTransporter = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    })
  : null;

let lastUpdateId = 0;

// 💾 Session Memory - ذاكرة المحادثات لكل مستخدم
const userSessions = new Map();

// إدارة الـ Session
class UserSession {
  constructor(chatId, userName) {
    this.chatId = chatId;
    this.userName = userName;
    this.history = []; // تاريخ المحادثة
    this.context = {}; // معلومات السياق
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  // إضافة رسالة للتاريخ
  addMessage(role, content) {
    this.history.push({
      role: role, // 'user' أو 'assistant'
      content: content,
      timestamp: Date.now()
    });
    
    // حفظ آخر 10 رسائل فقط (لتوفير الذاكرة)
    if (this.history.length > 10) {
      this.history = this.history.slice(-10);
    }
    
    this.lastActivity = Date.now();
  }

  // الحصول على تاريخ المحادثة
  getHistory() {
    return this.history;
  }

  // الحصول على آخر N رسائل
  getRecentMessages(count = 5) {
    return this.history.slice(-count);
  }

  // حفظ معلومات في السياق
  setContext(key, value) {
    this.context[key] = value;
  }

  // الحصول على معلومة من السياق
  getContext(key) {
    return this.context[key];
  }

  // تنظيف السياق
  clearContext() {
    this.context = {};
  }
}

// الحصول على Session المستخدم أو إنشاء واحد جديد
function getUserSession(chatId, userName) {
  if (!userSessions.has(chatId)) {
    userSessions.set(chatId, new UserSession(chatId, userName));
    console.log(`✨ New session created for ${userName} (${chatId})`);
  }
  return userSessions.get(chatId);
}

// تنظيف الـ Sessions القديمة (أكثر من ساعة)
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [chatId, session] of userSessions.entries()) {
    if (now - session.lastActivity > oneHour) {
      userSessions.delete(chatId);
      console.log(`🗑️ Cleaned old session for ${session.userName}`);
    }
  }
}, 15 * 60 * 1000); // كل 15 دقيقة

// إرسال رسالة مع retry
async function sendMessage(chatId, text, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      }, {
        timeout: 10000 // 10 seconds timeout
      });
      console.log(`✓ Sent to ${chatId}: ${text.substring(0, 50)}...`);
      return true;
    } catch (error) {
      console.error(`❌ Send attempt ${i + 1}/${retries} failed:`, error.message);
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      } else {
        console.error(`❌ Failed to send message after ${retries} attempts`);
        return false;
      }
    }
  }
}

// إرسال إيميل مع معالجة الأخطاء
async function sendEmail(to, subject, body) {
  if (!emailTransporter) {
    throw new Error('⚠️ Email service not configured. Check GMAIL_USER and GMAIL_APP_PASSWORD in .env');
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    throw new Error(`⚠️ Invalid email address: ${to}`);
  }

  try {
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: to,
      subject: subject,
      text: body,
      timeout: 15000 // 15 seconds
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully: ${info.messageId}`);
    return info.messageId;
  } catch (error) {
    console.error(`❌ Email send failed:`, error.message);
    
    // Specific error messages
    if (error.code === 'EAUTH') {
      throw new Error('⚠️ Gmail authentication failed. Check your App Password.');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('⚠️ Email timeout. Check your internet connection.');
    } else if (error.code === 'ECONNECTION') {
      throw new Error('⚠️ Cannot connect to Gmail servers.');
    } else {
      throw new Error(`⚠️ Email failed: ${error.message}`);
    }
  }
}

// استخراج البريد الإلكتروني
function extractEmail(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex);
  return emails ? emails[0] : null;
}

// استخراج معلومات الإيميل بالذكاء الاصطناعي مع معالجة الأخطاء
async function extractEmailInfo(userMessage, userName, chatId) {
  try {
    const emailAddress = extractEmail(userMessage);
    
    const prompt = `أنت محلل ذكي. استخرج معلومات الإيميل من رسالة المستخدم.

رسالة المستخدم: "${userMessage}"
${emailAddress ? `البريد المستخرج: ${emailAddress}` : ''}

قم بتحليل الرسالة واستخراج:
1. موضوع الإيميل (Subject)
2. محتوى الإيميل (Body)

رد بصيغة JSON فقط:
{
  "subject": "الموضوع",
  "body": "المحتوى"
}`;

    const result = await model.generateContent(prompt);
    
    if (!result || !result.response) {
      throw new Error('AI response is empty');
    }
    
    const response = await result.response;
    let text = response.text();
    
    if (!text || text.trim().length === 0) {
      throw new Error('AI returned empty text');
    }
    
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (jsonError) {
      console.error('❌ JSON parse error:', text);
      throw new Error('AI returned invalid JSON');
    }
    
    // التحقق من وجود البيانات المطلوبة
    if (!parsed.subject || !parsed.body) {
      throw new Error('Missing subject or body in AI response');
    }
    
    return {
      to: emailAddress,
      subject: parsed.subject,
      body: parsed.body,
      needsMoreInfo: !emailAddress
    };
  } catch (error) {
    console.error('❌ Error extracting email info:', error.message);
    
    // تحديد نوع الخطأ وإرجاع رسالة واضحة
    if (error.message.includes('AI returned invalid JSON')) {
      console.error('⚠️ AI response was not valid JSON format');
    } else if (error.message.includes('AI response is empty')) {
      console.error('⚠️ AI did not respond');
    } else if (error.message.includes('Missing subject or body')) {
      console.error('⚠️ AI response missing required fields');
    }
    
    return null;
  }
}

// 🤖 AI Agent - يحلل ويقرر الإجراء المناسب (مع ذاكرة)
async function getAIReply(userMessage, userName, chatId) {
  try {
    // الحصول على Session المستخدم
    const session = getUserSession(chatId, userName);
    
    // حفظ رسالة المستخدم في التاريخ
    session.addMessage('user', userMessage);
    
    // بناء سياق المحادثة من التاريخ
    const recentHistory = session.getRecentMessages(5);
    let conversationContext = '';
    if (recentHistory.length > 1) {
      conversationContext = '\n\nسياق المحادثة السابقة:\n';
      recentHistory.slice(0, -1).forEach(msg => {
        const role = msg.role === 'user' ? 'المستخدم' : 'أنت';
        conversationContext += `${role}: ${msg.content}\n`;
      });
    }
    
    // المرحلة 1: AI Agent يحلل النية (مع السياق)
    const intentPrompt = `أنت AI Agent. حلل الرسالة مع مراعاة السياق السابق.
${conversationContext}
الرسالة الحالية: "${userMessage}"

رد بـ JSON فقط:
{
  "intent": "send_email" / "question" / "greeting" / "help" / "follow_up",
  "action": "execute" / "ask_info" / "respond",
  "confidence": 0.0-1.0
}`;

    let intent;
    try {
      const intentResult = await model.generateContent(intentPrompt);
      
      if (!intentResult || !intentResult.response) {
        throw new Error('Intent detection failed: empty response');
      }
      
      let intentText = intentResult.response.text();
      if (!intentText || intentText.trim().length === 0) {
        throw new Error('Intent detection failed: empty text');
      }
      
      intentText = intentText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      intent = JSON.parse(intentText);
      
      // التحقق من البيانات المطلوبة
      if (!intent.intent || !intent.action) {
        throw new Error('Intent detection failed: missing required fields');
      }
      
    } catch (error) {
      console.error('❌ Intent detection error:', error.message);
      
      // Check if it's a quota error
      if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
        console.error('⚠️ API quota exceeded - using fallback response');
        return `🔄 معذرة! خادم الذكاء الاصطناعي مشغول حالياً.\n\nيرجى المحاولة بعد دقائق قليلة.`;
      }
      
      // استخدام intent افتراضي عند الفشل
      intent = { intent: 'question', action: 'respond', confidence: 0.5 };
    }

    console.log('🤖 AI Agent:', intent);

    // المرحلة 2: تنفيذ حسب النية
    
    // إرسال إيميل
    if (intent.intent === 'send_email' && emailTransporter) {
      const emailAddress = extractEmail(userMessage);
      
      if (!emailAddress) {
        return `📧 فهمت! تريد إرسال إيميل.

❌ لكن أحتاج البريد الإلكتروني!

📝 مثال: "أرسل شكر لـ boss@company.com"`;
      }

      console.log('🔍 Executing email send...');
      
      let emailInfo;
      try {
        emailInfo = await extractEmailInfo(userMessage, userName, chatId);
      } catch (error) {
        console.error('❌ Email extraction failed:', error.message);
        return `❌ حدث خطأ في تحليل معلومات الإيميل.
        
💡 حاول مرة أخرى بصيغة أوضح:
"أرسل إيميل لـ example@gmail.com عن الموضوع X محتواه Y"`;
      }
      
      if (!emailInfo) {
        return `❌ لم أستطع استخراج معلومات الإيميل.

💡 حاول صيغة أوضح مثل:
"أرسل شكر لـ boss@company.com"`;
      }
      
      if (emailInfo && emailInfo.to) {
        try {
          const subject = emailInfo.subject || 'رسالة من واصل';
          const body = emailInfo.body || 'مرحباً!';
          
          const sendingSuccess = await sendMessage(chatId, '📧 جاري الإرسال...');
          if (!sendingSuccess) {
            console.warn('⚠️ Failed to send "sending..." message');
          }
          
          const emailSuccess = await sendEmail(emailInfo.to, subject, body);
          
          if (!emailSuccess) {
            return `❌ فشل إرسال الإيميل.

🔄 يرجى المحاولة مرة أخرى، أو تحقق من:
- صحة البريد الإلكتروني
- اتصالك بالإنترنت`;
          }
          
          return `✅ تم! الإيميل وصل!

📬 إلى: ${emailInfo.to}
📝 الموضوع: ${subject}
✉️ المحتوى:
${body}

💡 يمكنك إرسال إيميل آخر!`;
        } catch (error) {
          console.error('❌ Email send process error:', error.message);
          return `❌ حدث خطأ أثناء إرسال الإيميل.

💡 يرجى المحاولة مرة أخرى.`;
        }
      }
    }

    // طلب مساعدة
    if (intent.intent === 'help' || userMessage.toLowerCase().includes('مساعدة') || userMessage.toLowerCase().includes('help')) {
      return `🤖 أنا واصل - AI Agent قوي!

⚡ قدراتي الحقيقية (شغالة الآن):

📧 إرسال إيميلات Gmail فعلية
   ✅ "أرسل شكر لـ boss@company.com"
   ✅ "send email to friend@gmail.com"
   ✅ أقدر أرسل إيميلات حقيقية لأي شخص!

💬 الإجابة على جميع أسئلتك
   "اشرح لي البرمجة"
   "What is AI?"

🔧 المساعدة في الكتابة
   "ساعدني في كتابة إيميل احترافي"

🌐 الترجمة والتحليل
   "ترجم: Thank you"

💾 ذاكرة المحادثة
   أتذكر كل شيء تقوله في الجلسة!

💡 جرب الآن! أرسل إيميل حقيقي:`;
    }

    // المرحلة 3: محادثة ذكية (مع ذاكرة المحادثة)
    const chatPrompt = `أنت "واصل" 🤖 - AI Agent ذكي مع ذاكرة وقدرات حقيقية.

شخصيتك:
- ذكي ومفيد
- ودود ومحترم  
- مباشر وعملي
- تتذكر المحادثة السابقة
- نفس لغة المستخدم

⚡ قدراتك الفعلية (شغالة الآن):
${emailTransporter ? '✅ إرسال إيميلات من Gmail - أقدر أرسل إيميلات فعلية!' : '⏳ إرسال إيميلات - قيد الإعداد'}
✅ الإجابة على جميع الأسئلة
✅ المساعدة في الكتابة والصياغة
✅ الشرح والتحليل بذكاء
✅ تذكر المحادثة الكاملة

⚠️ مهم جداً:
- إذا طلب إرسال إيميل، قل له "تمام! أرسل لي البريد الإلكتروني والمحتوى"
- لا تقل "لا أستطيع" أو "لا أقدر" - أنت تقدر فعلياً!
- شجعه على استخدام ميزة الإيميل
${conversationContext}
المستخدم: ${userName}
الرسالة الحالية: "${userMessage}"

رد بـ 100-200 كلمة، مفيد وعملي وإيجابي. إذا كانت الرسالة متعلقة بالمحادثة السابقة، اربط إجابتك بها.`;

    let aiReply;
    try {
      const result = await model.generateContent(chatPrompt);
      
      if (!result || !result.response) {
        throw new Error('AI response is empty');
      }
      
      aiReply = result.response.text();
      
      if (!aiReply || aiReply.trim().length === 0) {
        throw new Error('AI returned empty reply');
      }
      
      // حفظ رد البوت في التاريخ
      session.addMessage('assistant', aiReply);
      
      return aiReply;
      
    } catch (error) {
      console.error('❌ AI chat generation error:', error.message);
      
      // Check for quota exceeded
      if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
        console.error('⚠️ API quota exceeded - returning service unavailable message');
        return `🔄 معذرة ${userName}! خادم الذكاء الاصطناعي مشغول حالياً بسبب الطلبات الكثيرة.\n\nيرجى المحاولة بعد دقائق قليلة. شكراً على صبرك! 🙏`;
      }
      
      // رد احتياطي عند فشل AI
      return `🤖 مرحباً ${userName}!

حدث خطأ مؤقت في معالجة طلبك.

💡 يمكنك:
- إعادة المحاولة
- اكتب "مساعدة" لرؤية القدرات
- أرسل سؤال آخر

أنا جاهز للمساعدة! ✨`;
    }
    
  } catch (error) {
    console.error('❌ AI Agent Error:', error.message);
    
    // رد احتياطي شامل عند فشل كامل
    return `⚠️ عذراً ${userName}!

حدث خطأ غير متوقع.

💡 جرب:
- أعد صياغة السؤال
- اكتب "مساعدة"
- جرب مرة أخرى

أنا هنا للمساعدة! 🤖`;
  }
}

// معالجة الرسالة مع معالجة أخطاء شاملة
async function handleMessage(message) {
  try {
    if (!message || !message.chat || !message.from) {
      console.warn('⚠️ Invalid message structure:', message);
      return;
    }
    
    const chatId = message.chat.id;
    const text = message.text || '';
    const firstName = message.from.first_name || 'Friend';

    console.log(`\n📩 Message from ${firstName} (${chatId}): ${text}`);

    // أوامر خاصة
    if (text === '/clear' || text === 'امسح' || text === 'clear') {
      try {
        const session = getUserSession(chatId, firstName);
        session.history = [];
        session.clearContext();
        await sendMessage(chatId, '🗑️ تم مسح الذاكرة! بدأنا محادثة جديدة.');
      } catch (error) {
        console.error('❌ Error clearing session:', error.message);
        await sendMessage(chatId, '⚠️ حدث خطأ في مسح الذاكرة.');
      }
      return;
    }

    if (text === '/status' || text === 'الحالة') {
      try {
        const session = getUserSession(chatId, firstName);
        const messageCount = session.history.length;
        const sessionAge = Math.floor((Date.now() - session.createdAt) / 60000);
        await sendMessage(chatId, `📊 حالة الجلسة:\n\n💬 عدد الرسائل: ${messageCount}\n⏱️ مدة الجلسة: ${sessionAge} دقيقة\n\n💡 لمسح الذاكرة: /clear`);
      } catch (error) {
        console.error('❌ Error getting status:', error.message);
        await sendMessage(chatId, '⚠️ حدث خطأ في عرض الحالة.');
      }
      return;
    }

    // معالجة الرسالة العادية
    try {
      const reply = await getAIReply(text, firstName, chatId);
      const success = await sendMessage(chatId, reply);
      
      if (!success) {
        console.warn('⚠️ Failed to send reply to user');
      }
    } catch (error) {
      console.error('❌ Error processing message:', error.message);
      await sendMessage(chatId, `⚠️ عذراً ${firstName}، حدث خطأ في معالجة رسالتك. يرجى المحاولة مرة أخرى.`);
    }
    
  } catch (error) {
    console.error('❌ Critical error in handleMessage:', error.message);
    // محاولة إرسال رسالة خطأ عامة إذا أمكن
    try {
      if (message && message.chat && message.chat.id) {
        await sendMessage(message.chat.id, '⚠️ حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.');
      }
    } catch (sendError) {
      console.error('❌ Could not send error message:', sendError.message);
    }
  }
}

// استقبال التحديثات مع معالجة أخطاء شاملة
async function getUpdates() {
  try {
    const response = await axios.get(`${TELEGRAM_API}/getUpdates`, {
      params: {
        offset: lastUpdateId + 1,
        timeout: 30
      },
      timeout: 35000 // 35 ثانية timeout
    });

    if (!response || !response.data) {
      throw new Error('Empty response from Telegram API');
    }

    const updates = response.data.result;
    
    if (!Array.isArray(updates)) {
      console.warn('⚠️ Updates is not an array:', updates);
      return;
    }

    for (const update of updates) {
      try {
        lastUpdateId = update.update_id;
        if (update.message) {
          await handleMessage(update.message);
        }
      } catch (messageError) {
        console.error('❌ Error handling message:', messageError.message);
        // الاستمرار في معالجة الرسائل الأخرى
      }
    }
  } catch (error) {
    // تجاهل خطأ 409 (conflict - عدة instances تعمل)
    if (error.response?.status === 409) {
      console.warn('⚠️ Conflict: Another bot instance may be running');
      return;
    }
    
    // معالجة أخطاء الشبكة
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      console.warn('⚠️ Network timeout, retrying...');
      return;
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error('❌ Network connection error:', error.message);
      console.log('⏳ Waiting 5 seconds before retry...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      return;
    }
    
    // خطأ غير متوقع
    console.error('❌ Error getting updates:', error.message);
  }
}

// تشغيل البوت
async function startBot() {
  console.log('\n🚀 Starting Telegram Bot (Simple Version)...\n');

  // حذف webhook
  try {
    await axios.get(`${TELEGRAM_API}/deleteWebhook?drop_pending_updates=true`);
    console.log('✓ Webhook deleted');
  } catch (error) {
    console.log('Note:', error.message);
  }

  // التحقق من البوت
  try {
    const response = await axios.get(`${TELEGRAM_API}/getMe`);
    const botInfo = response.data.result;
    console.log(`✓ Bot connected: @${botInfo.username}`);
    console.log(`✓ Bot name: ${botInfo.first_name}`);
  } catch (error) {
    console.error('❌ Failed to connect:', error.message);
    process.exit(1);
  }

  console.log('\n✅ Bot is running!\n');
  console.log('Features:');
  if (emailTransporter) {
    console.log('  📧 Gmail - Send emails');
  }
  console.log('  🤖 Gemini AI - Smart replies');
  console.log('  💾 Session Memory - Context aware');
  console.log('\nCommands:');
  console.log('  /clear - مسح ذاكرة المحادثة');
  console.log('  /status - عرض حالة الجلسة\n');
  console.log('Press Ctrl+C to stop.\n');
  console.log('═══════════════════════════════════════\n');

  // Polling loop
  while (true) {
    await getUpdates();
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  console.log(`📊 Final stats: ${userSessions.size} active sessions`);
  console.log('👋 Goodbye!\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM, shutting down...\n');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

// Start the bot
startBot().catch(error => {
  console.error('\n❌ Failed to start bot:', error.message);
  process.exit(1);
});
