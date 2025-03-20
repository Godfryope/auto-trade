require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const axios = require('axios');
const QRCode = require('qrcode');
const express = require('express');
const crypto = require('crypto');
const session = require('express-session');
const userRoutes = require('./routes/userRoutes');
const app = express();
const port = process.env.PORT || 3000;

const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');

const server = http.createServer(app);
const io = new Server(server);

// Generate secret key
const secret = crypto.randomBytes(64).toString('hex');
console.log(`Generated secret key: ${secret}`);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log(err));

// Telegram Bot Setup
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Session setup
app.use(session({
  secret: secret, // Use the generated secret key
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    httpOnly: true, // Helps prevent XSS attacks
    sameSite: 'Lax' // Helps prevent CSRF attacks
  }
}));

app.use(express.json());
app.use(express.static('public'));
app.use('/api/user', userRoutes);

// Define User Schema for MongoDB (Ensure this matches your existing schema)
const walletSchema = new mongoose.Schema({
  address: String,
  privateKey: String,
  apiKey: String,
  qrCodeImage: String,
  solanaBalance: { type: Number, default: 0 },
});

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  registrationDate: { type: Date, default: Date.now },
  mainWallet: walletSchema,
  tradingWallet: walletSchema,
});

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

      const mainWalletDetails = await createSolanaWallet();
      const tradingWalletDetails = await createSolanaWallet();
      if (!mainWalletDetails || !tradingWalletDetails) {
        return bot.sendMessage(chatId, `⚠️ *Error creating your wallets.* Please try again later.`, { parse_mode: 'Markdown' });
      }

      newUser.mainWallet = {
        address: mainWalletDetails.walletAddress,
        privateKey: mainWalletDetails.privateKey,
        apiKey: mainWalletDetails.apiKey,
        qrCodeImage: mainWalletDetails.qrCodeImage
      };
      newUser.tradingWallet = {
        address: tradingWalletDetails.walletAddress,
        privateKey: tradingWalletDetails.privateKey,
        apiKey: tradingWalletDetails.apiKey,
        qrCodeImage: tradingWalletDetails.qrCodeImage
      };
      await newUser.save();

      bot.sendMessage(chatId, `🎉 Registration successful! Welcome, ${msg.from.first_name}! 🚀\n\nYour unique Solana wallet addresses are:\n\nMain Wallet: \`${mainWalletDetails.walletAddress}\`\nTrading Wallet: \`${tradingWalletDetails.walletAddress}\``, { parse_mode: 'Markdown' });
      bot.sendPhoto(chatId, mainWalletDetails.qrCodeImage, { caption: 'Here is your QR code for the Main wallet address.' });
      bot.sendPhoto(chatId, tradingWalletDetails.qrCodeImage, { caption: 'Here is your QR code for the Trading wallet address.' });
    } else {
      bot.sendMessage(chatId, `✅ Welcome back, ${user.firstName}!`);
    }

    const script = `<script>localStorage.setItem('telegramId', '${chatId}');</script>`;
    const userData = {
      firstName: user ? user.firstName : newUser.firstName,
      lastName: user ? user.lastName : newUser.lastName,
      username: user ? user.username : newUser.username,
      mainWallet: user ? user.mainWallet.address : newUser.mainWallet.address,
      tradingWallet: user ? user.tradingWallet.address : newUser.tradingWallet.address,
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

      const mainWalletDetails = await createSolanaWallet();
      const tradingWalletDetails = await createSolanaWallet();
      if (!mainWalletDetails || !tradingWalletDetails) {
        return bot.sendMessage(chatId, `⚠️ *Error creating your wallets.* Please try again later.`, { parse_mode: 'Markdown' });
      }

      newUser.mainWallet = {
        address: mainWalletDetails.walletAddress,
        privateKey: mainWalletDetails.privateKey,
        apiKey: mainWalletDetails.apiKey,
        qrCodeImage: mainWalletDetails.qrCodeImage
      };
      newUser.tradingWallet = {
        address: tradingWalletDetails.walletAddress,
        privateKey: tradingWalletDetails.privateKey,
        apiKey: tradingWalletDetails.apiKey,
        qrCodeImage: tradingWalletDetails.qrCodeImage
      };
      await newUser.save();

      bot.sendMessage(chatId, `🎉 Registration successful! Welcome, ${msg.from.first_name}! 🚀\n\nYour unique Solana wallet addresses are:\n\nMain Wallet: \`${mainWalletDetails.walletAddress}\`\nTrading Wallet: \`${tradingWalletDetails.walletAddress}\``, { parse_mode: 'Markdown' });
      bot.sendPhoto(chatId, mainWalletDetails.qrCodeImage, { caption: 'Here is your QR code for the Main wallet address.' });
      bot.sendPhoto(chatId, tradingWalletDetails.qrCodeImage, { caption: 'Here is your QR code for the Trading wallet address.' });
    } else {
      bot.sendMessage(chatId, `✅ Welcome back, ${user.firstName}!`);
    }

    const script = `<script>localStorage.setItem('telegramId', '${chatId}');</script>`;
    const userData = {
      firstName: user ? user.firstName : newUser.firstName,
      lastName: user ? user.lastName : newUser.lastName,
      username: user ? user.username : newUser.username,
      mainWallet: user ? user.mainWallet.address : newUser.mainWallet.address,
      tradingWallet: user ? user.tradingWallet.address : newUser.tradingWallet.address,
    };

    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔑 Login', url: `https://auto-trade-production.up.railway.app?telegramId=${chatId}&userData=${encodeURIComponent(JSON.stringify(userData))}` }]
        ]
      }
    };

    bot.sendMessage(chatId, `Welcome to the MemeTrade Bot!\n\nTo get started, click below to log in. Once logged in, you'll be ready to explore all the features of this bot! 💼\n\nLet’s make some trades! 🚀`, options);
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

// Endpoint to update user data
app.put('/api/user/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const updateData = req.body;

  try {
    const user = await User.findOne({ telegramId });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (updateData.mainWallet) {
      user.mainWallet.solanaBalance = updateData.mainWallet.solanaBalance;
    }
    if (updateData.tradingWallet) {
      user.tradingWallet.solanaBalance = updateData.tradingWallet.solanaBalance;
    }

    await user.save();

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user data:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// WebSocket setup for Raydium liquidity events
const ws = new WebSocket('wss://pumpportal.fun/api/data');

ws.on('open', function open() {
  // Subscribing to Raydium liquidity events
  const payload = {
    method: "subscribeNewToken",
  };
  ws.send(JSON.stringify(payload));
});

ws.on('message', function message(data) {
  const tokens = JSON.parse(data);
  io.emit('tokensDetected', tokens);
});

// Endpoint to fetch detected tokens
app.get('/api/tokens', (req, res) => {
  ws.on('message', function message(data) {
    const tokens = JSON.parse(data);
    res.json(tokens);
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});