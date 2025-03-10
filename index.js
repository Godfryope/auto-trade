require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const axios = require('axios');
const QRCode = require('qrcode');
const express = require('express');
const crypto = require('crypto');
const session = require('express-session'); // Add express-session for session management
const userRoutes = require('./routes/userRoutes');
const app = express();
const port = process.env.PORT || 3000;

// Generate secret key
const secret = crypto.randomBytes(64).toString('hex');
console.log(secret);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log(err));

// Telegram Bot Setup
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Session setup
app.use(session({
  secret: secret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

app.use(express.json());
app.use(express.static('public'));
app.use('/api/user', userRoutes);

// Define User Schema for MongoDB (Ensure this matches your existing schema)
const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  registrationDate: { type: Date, default: Date.now },
  solanaWallet: String,
  privateKey: String,
  apiKey: String,
  solanaBalance: { type: Number, default: 0 },
  qrCodeImage: String
});

// Create a model for the schema
const User = mongoose.models.User || mongoose.model('User', userSchema);

// Function to create a Solana wallet and generate QR code
const createSolanaWallet = async () => {
  try {
    const response = await axios.get('https://pumpportal.fun/api/create-wallet');
    const data = response.data;
    const { privateKey, walletPublicKey: walletAddress, apiKey } = data;

    if (walletAddress && apiKey) {
      const qrCodeImage = await QRCode.toDataURL(walletAddress);
      return { walletAddress, privateKey, apiKey, qrCodeImage };
    } else {
      throw new Error('Invalid response data');
    }
  } catch (error) {
    console.error('Failed to create wallet:', error.response ? error.response.data : error.message);
    return null;
  }
};

// Handle user login (check if user exists or register)
bot.onText(/\/login/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    let user = await User.findOne({ telegramId: chatId });

    if (!user) {
      const newUser = new User({
        telegramId: chatId,
        firstName: msg.from.first_name,
        lastName: msg.from.last_name || '',
        username: msg.from.username || '',
      });

      const walletDetails = await createSolanaWallet();
      if (!walletDetails) {
        return bot.sendMessage(chatId, `⚠️ *Error creating your wallet.* Please try again later.`, { parse_mode: 'Markdown' });
      }

      newUser.solanaWallet = walletDetails.walletAddress;
      newUser.privateKey = walletDetails.privateKey;
      newUser.apiKey = walletDetails.apiKey;
      newUser.qrCodeImage = walletDetails.qrCodeImage;
      await newUser.save();

      bot.sendMessage(chatId, `🎉 Registration successful! Welcome, ${msg.from.first_name}! 🚀\n\nYour unique Solana wallet address is: \`${walletDetails.walletAddress}\``, { parse_mode: 'Markdown' });
      bot.sendPhoto(chatId, walletDetails.qrCodeImage, { caption: 'Here is your QR code for the Solana wallet address.' });
    } else {
      bot.sendMessage(chatId, `✅ Welcome back, ${user.firstName}!`);
    }

    const script = `<script>localStorage.setItem('telegramId', '${chatId}');</script>`;
    const userData = {
      firstName: user ? user.firstName : newUser.firstName,
      lastName: user ? user.lastName : newUser.lastName,
      username: user ? user.username : newUser.username,
      solanaWallet: user ? user.solanaWallet : newUser.solanaWallet,
    };

    bot.sendMessage(chatId, `🚀 Redirecting you to the dashboard...`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔑 Go to Dashboard', url: `https://auto-trade-production.up.railway.app?telegramId=${chatId}&userData=${encodeURIComponent(JSON.stringify(userData))}` }]
        ]
      }
    });
  } catch (error) {
    bot.sendMessage(chatId, `⚠️ Error: ${error.message}`, { parse_mode: 'Markdown' });
  }
});

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    let user = await User.findOne({ telegramId: chatId });
    let newUser = null;

    if (!user) {
      newUser = new User({
        telegramId: chatId,
        firstName: msg.from.first_name,
        lastName: msg.from.last_name || '',
        username: msg.from.username || '',
      });

      const walletDetails = await createSolanaWallet();
      if (!walletDetails) {
        return bot.sendMessage(chatId, `⚠️ *Error creating your wallet.* Please try again later.`, { parse_mode: 'Markdown' });
      }

      newUser.solanaWallet = walletDetails.walletAddress;
      newUser.privateKey = walletDetails.privateKey;
      newUser.apiKey = walletDetails.apiKey;
      newUser.qrCodeImage = walletDetails.qrCodeImage;
      await newUser.save();

      bot.sendMessage(chatId, `🎉 Registration successful! Welcome, ${msg.from.first_name}! 🚀\n\nYour unique Solana wallet address is: \`${walletDetails.walletAddress}\``, { parse_mode: 'Markdown' });
      bot.sendPhoto(chatId, walletDetails.qrCodeImage, { caption: 'Here is your QR code for the Solana wallet address.' });
    } else {
      bot.sendMessage(chatId, `✅ Welcome back, ${user.firstName}!`);
    }

    const script = `<script>localStorage.setItem('telegramId', '${chatId}');</script>`;
    const userData = {
      firstName: user ? user.firstName : newUser.firstName,
      lastName: user ? user.lastName : newUser.lastName,
      username: user ? user.username : newUser.username,
      solanaWallet: user ? user.solanaWallet : newUser.solanaWallet,
    };

    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔑 Login', url: `https://auto-trade-production.up.railway.app?telegramId=${chatId}&userData=${encodeURIComponent(JSON.stringify(userData))}` }]
        ]
      }
    };

    bot.sendMessage(chatId, `Welcome to the MemeTrade Bot!\n\nTo get started, click below to log in. Once logged in, you'll be ready to explore all the features of this bot! 💼\n\nLet’s make this happen! 🚀`, options);
  } catch (error) {
    bot.sendMessage(chatId, `⚠️ Error: ${error.message}`, { parse_mode: 'Markdown' });
  }
});

// Help command to show available commands
bot.onText(/\/help/, (msg) => {
  const helpMessage = `Available Commands:
/start - Start the bot and display the login button
/login - Log in or register to the platform
/help - Show this help message`;

  bot.sendMessage(msg.chat.id, helpMessage);
});

// Authentication endpoint
app.post('/api/user/authenticate', async (req, res) => {
  const { telegramId } = req.body;

  try {
    const user = await User.findOne({ telegramId });

    if (user) {
      // Start session
      req.session.telegramId = telegramId;
      req.session.user = user;
      res.json({ success: true, user });
    } else {
      res.json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
