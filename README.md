# 🤖 Wasl AI Bot - بوت واصل الذكي

An intelligent Telegram bot powered by Google Gemini AI with Gmail integration and conversational memory.

بوت تليجرام ذكي يعمل بحسابك الشخصي مع دعم كامل لخدمات Google

---

## ✨ Features - المميزات

### 🧠 **AI Agent with Intent Analysis**
- Two-stage processing: Intent detection → Execution
- Context-aware responses
- Natural language understanding

### 📧 **Gmail Integration**
- Send real emails through Gmail
- AI-powered email composition
- Smart recipient and content extraction

### 💾 **Session Memory**
- Remembers last 10 messages per user
- Context-aware conversations
- Auto-cleanup after 1 hour of inactivity

### 🌐 **Multilingual Support**
- Native Arabic support
- English support
- Auto-detection

### 🎯 **Smart Commands**
- `/clear` or `امسح` - Clear conversation memory
- `/status` or `الحالة` - View session stats

---

## 🚀 Quick Start - التشغيل السريع

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
GEMINI_API_KEY=your_gemini_key
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
```

### 3. Test Setup

```bash
npm test
```

### 4. Run Bot

```bash
npm start
```

OR

```bash
npm run dev
```

---

## 📝 Usage Examples - أمثلة الاستخدام

### Send Emails - إرسال إيميلات

```
User: "Send thank you email to boss@company.com"
User: "أرسل شكر لـ friend@gmail.com"
User: "أرسل إيميل لـ test@gmail.com عن الاجتماع"
```

### Ask Questions - طرح أسئلة

```
User: "Explain artificial intelligence"
User: "اشرح لي البرمجة"
User: "What is AI?"
```

### Get Help - المساعدة

```
User: "help"
User: "مساعدة"
```

---

## 🏗️ Project Structure

```
TelegramBoot/
├── index.js              # Main bot logic
├── start.js              # Clean startup script
├── test-setup.js         # Setup validator
├── package.json          # Dependencies
├── .env                  # Configuration (create this)
├── README.md            # This file
├── SESSION-MEMORY.md    # Memory system docs
└── functions/           # Firebase Functions (optional)
    └── index.js         # Firebase deployment version
```

---

## 🔧 Technical Stack

- **Node.js** - Runtime environment
- **Google Gemini AI** - gemini-2.0-flash model
- **Nodemailer** - Email sending
- **Axios** - Telegram API communication
- **Dotenv** - Environment management

---

## 📊 Bot Capabilities

| Feature | Status | Description |
|---------|--------|-------------|
| 📧 Gmail | ✅ Active | Send real emails via nodemailer |
| 🤖 AI Agent | ✅ Active | Intent-based 2-stage processing |
| 💾 Memory | ✅ Active | Session context (10 messages) |
| 🌐 Multilingual | ✅ Active | Arabic & English |
| 🛡️ Error Handling | ✅ Active | Graceful shutdown & recovery |
| 📊 Logging | ✅ Active | Detailed activity logs |
| 🔧 Commands | ✅ Active | /clear, /status |

---

## 💡 How It Works

### 1. **Message Reception**
User sends message → Bot receives via polling

### 2. **Session Management**
- Check/create user session
- Load conversation history
- Update last activity

### 3. **AI Processing**

**Stage 1: Intent Analysis**
```javascript
{
  intent: "send_email" / "question" / "help",
  action: "execute" / "ask_info" / "respond",
  confidence: 0.0-1.0
}
```

**Stage 2: Execution**
- If email → Extract info & send
- If question → Generate smart reply
- If help → Show capabilities

### 4. **Response**
- Save bot reply to history
- Send to user
- Update session

---

## 🔒 Security & Privacy

- ✅ Session data stored in RAM only
- ✅ Auto-cleanup after 1 hour
- ✅ No database storage
- ✅ Isolated user sessions
- ⚠️ Keep `.env` file private

---

## 🎯 Commands

```bash
npm start      # Start the bot (clean)
npm test       # Validate setup
npm run dev    # Start bot (direct)
```

---

## 🐛 Troubleshooting

### Bot not responding?

```bash
npm test
```

This checks all requirements.

### Duplicate messages?

Stop all Node processes:

**Windows:**
```bash
Get-Process node | Stop-Process -Force
npm start
```

**Linux/Mac:**
```bash
pkill -9 node
npm start
```

### Email not sending?

- Verify `GMAIL_APP_PASSWORD` in `.env`
- Use App Password, not regular password
- Check Gmail settings
- [Create App Password](https://myaccount.google.com/apppasswords)

---

## 📈 Session Memory System

### Automatic Management
- ✅ Last 10 messages saved
- ✅ Context window: 5 messages
- ✅ Auto-cleanup every 15 minutes
- ✅ Session expires after 1 hour

### Manual Control
- `/clear` - Reset conversation
- `/status` - View session info

See `SESSION-MEMORY.md` for details.

---

## 📞 Bot Information

- **Bot**: @Wasl_Ai_bot
- **Model**: gemini-2.0-flash
- **Email**: yahyahani16@gmail.com

---

## 🎉 Perfect Setup Checklist

- [x] Clean project structure
- [x] Minimal dependencies (4 only)
- [x] Simple configuration
- [x] AI Agent with 2-stage processing
- [x] Gmail integration working
- [x] Session memory implemented
- [x] Commands functional
- [x] Auto-cleanup active
- [x] Documentation complete
- [x] Test script ready

**🚀 Everything is ready! Start with `npm start`**

---

**Last updated:** November 2024  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
