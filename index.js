const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const axios = require('axios');
const QRCode = require('qrcode');
const express = require('express');
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;
const crypto = require('crypto');
const secret = crypto.randomBytes(64).toString('hex');
console.log(secret);

// MongoDB connection
mongoose.connect('mongodb+srv://bitcoption:Precious1@autotrader.myq0i.mongodb.net/?retryWrites=true&w=majority&appName=autotrader')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log(err));

// Telegram Bot Setup
const bot = new TelegramBot('7423072615:AAE4n0XMukzbdsW_lsvhY2KcmJ2uS_RjR20', { polling: true });

app.use(express.json());
app.use(express.static('public'));

// Session setup
app.use(session({
  secret: secret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using https
}));

// Define User Schema for MongoDB
const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  registrationDate: { type: Date, default: Date.now },
  solanaWallet: String, // Store Solana wallet address for each user
  privateKey: String, // Store private key for each user
  apiKey: String, // Store API key for each user
  solanaBalance: { type: Number, default: 0 }, // Track balance of Solana for the user
  qrCodeImage: String // Store QR code image as a base64 string
});

// Create a model for the schema
const User = mongoose.model('User', userSchema);

// Function to create a Solana wallet and generate QR code
const createSolanaWallet = async () => {
  try {
    // Step 1: Create a wallet
    const response = await axios.get('https://pumpportal.fun/api/create-wallet');
    console.log('API Response:', response.data); // Log the response data
    const data = response.data;
    const privateKey = data.privateKey;
    const walletAddress = data.walletPublicKey;
    const apiKey = data.apiKey;

    if (walletAddress && apiKey) {
      console.log(`Private Key: ${privateKey}`);
      console.log(`Wallet Address: ${walletAddress}`);
      console.log(`API Key: ${apiKey}`);

      // Generate QR code for the wallet address
      const qrCodeImage = await QRCode.toDataURL(walletAddress);
      return { walletAddress, privateKey, apiKey, qrCodeImage };
    } else {
      console.error('Failed to create wallet: Invalid response data');
      return null;
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
    // Check if user exists in MongoDB
    let user = await User.findOne({ telegramId: chatId });

    if (!user) {
      // If user doesn't exist, register them
      const newUser = new User({
        telegramId: chatId,
        firstName: msg.from.first_name,
        lastName: msg.from.last_name || '',
        username: msg.from.username || '',
      });

      // Create a Solana wallet for the user
      const walletDetails = await createSolanaWallet();
      if (!walletDetails) {
        return bot.sendMessage(
          chatId,
          `⚠️ *Error creating your wallet.* Please try again later.`,
          { parse_mode: 'Markdown' }
        );
      }

      newUser.solanaWallet = walletDetails.walletAddress;
      newUser.privateKey = walletDetails.privateKey;
      newUser.apiKey = walletDetails.apiKey;
      newUser.qrCodeImage = walletDetails.qrCodeImage;
      await newUser.save();

      bot.sendMessage(
        chatId,
        `🎉 Registration successful! Welcome, ${msg.from.first_name}! 🚀\n\nYour unique Solana wallet address is: \`${walletDetails.walletAddress}\``,
        { parse_mode: 'Markdown' }
      );

      bot.sendPhoto(chatId, walletDetails.qrCodeImage, {
        caption: 'Here is your QR code for the Solana wallet address.',
      });

      // Store userId in session
      app.use((req, res, next) => {
        req.session.userId = newUser._id;
        next();
      });
    } else {
      bot.sendMessage(chatId, `✅ Welcome back, ${user.firstName}!`);

      // Store userId in session
      app.use((req, res, next) => {
        req.session.userId = user._id;
        next();
      });
    }

    // Auto-redirect user to the dashboard with user data
    const userData = {
      firstName: user ? user.firstName : newUser.firstName,
      lastName: user ? user.lastName : newUser.lastName,
      username: user ? user.username : newUser.username,
      solanaWallet: user ? user.solanaWallet : newUser.solanaWallet,
    };

    bot.sendMessage(chatId, `🚀 Redirecting you to the platform...`, {
      reply_markup: {
        inline_keyboard: [
          [{ 
            text: '🚀 Open Dashboard', 
            web_app: { url: `https://auto-trade-production.up.railway.app?telegramId=${chatId}&userData=${encodeURIComponent(JSON.stringify(userData))}` } 
          }]
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
    // Check if user exists in MongoDB
    let user = await User.findOne({ telegramId: chatId });
    let newUser = null;

    if (!user) {
      // If user doesn't exist, register them
      newUser = new User({
        telegramId: chatId,
        firstName: msg.from.first_name,
        lastName: msg.from.last_name || '',
        username: msg.from.username || '',
      });

      // Create a Solana wallet for the user
      const walletDetails = await createSolanaWallet();
      if (!walletDetails) {
        return bot.sendMessage(
          chatId,
          `⚠️ *Error creating your wallet.* Please try again later.`,
          { parse_mode: 'Markdown' }
        );
      }

      newUser.solanaWallet = walletDetails.walletAddress;
      newUser.privateKey = walletDetails.privateKey;
      newUser.apiKey = walletDetails.apiKey;
      newUser.qrCodeImage = walletDetails.qrCodeImage;
      await newUser.save();

      bot.sendMessage(
        chatId,
        `🎉 Registration successful! Welcome, ${msg.from.first_name}! 🚀\n\nYour unique Solana wallet address is: \`${walletDetails.walletAddress}\``,
        { parse_mode: 'Markdown' }
      );

      bot.sendPhoto(chatId, walletDetails.qrCodeImage, {
        caption: 'Here is your QR code for the Solana wallet address.',
      });

      // Store userId in session
      app.use((req, res, next) => {
        req.session.userId = newUser._id;
        next();
      });
    } else {
      bot.sendMessage(chatId, `✅ Welcome back, ${user.firstName}!`);

      // Store userId in session
      app.use((req, res, next) => {
        req.session.userId = user._id;
        next();
      });
    }

    // Auto-redirect user to the dashboard with user data
    const userData = {
      firstName: user ? user.firstName : newUser.firstName,
      lastName: user ? user.lastName : newUser.lastName,
      username: user ? user.username : newUser.username,
      solanaWallet: user ? user.solanaWallet : newUser.solanaWallet,
    };

    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ 
            text: '🔑 Login', 
            url: `https://auto-trade-production.up.railway.app?telegramId=${chatId}&userData=${encodeURIComponent(JSON.stringify(userData))}`
          }]
        ]
      }
    };

    bot.sendMessage(chatId, `Welcome to the MemeTrade Bot!\n\nTo get started, click below to log in. Once logged in, you'll be ready to explore all the features of this bot! 💼\n\nLet’s make this fun! 😎`, options);
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

// Endpoint to get user's wallet address and QR code
app.get('/api/user/:telegramId', async (req, res) => {
  const telegramId = req.params.telegramId;
  try {
    const user = await User.findOne({ telegramId });

    if (user) {
      res.json({
        walletAddress: user.solanaWallet,
        qrCodeImage: user.qrCodeImage,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Endpoint to get telegramId from session
app.get('/api/session/telegramId', (req, res) => {
  if (req.session.telegramId) {
    res.json({ telegramId: req.session.telegramId });
  } else {
    res.status(404).json({ message: 'Telegram ID not found in session' });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});