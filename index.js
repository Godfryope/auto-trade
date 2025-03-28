import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';
import axios from 'axios';
import QRCode from 'qrcode';
import express from 'express';
import crypto from 'crypto';
import session from 'express-session';
import userRoutes from './routes/userRoutes.js';
import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';


const port = 3000;


const app = express();

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

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files (HTML, JS)
app.use(express.static('public'));

// Connect to the external WebSocket API
// Connect to the external WebSocket API
const externalWs = new WebSocket('wss://pumpportal.fun/api/data');

externalWs.on('open', () => {
  console.log("Connected to external WebSocket");

  // Subscribe to new token creation events
  const payload = { method: "subscribeNewToken" };
  externalWs.send(JSON.stringify(payload));

  // Notify frontend about successful connection
  broadcast({ type: "success", message: "Connected to token updates!" });
});

async function fetchTokenMetadata(uri) {
  try {
    const response = await fetch(uri);
    const metadata = await response.json();
    return metadata.image || null; // Extract the image URL
  } catch (error) {
    console.error("Error fetching token metadata:", error);
    return null;
  }
}

externalWs.on("message", async (data) => {
  try {
    const parsedData = JSON.parse(data);
    // console.log("New Token:", parsedData);

    // Convert marketCap and price properly
    const marketCap = Number(parsedData.marketCapSol) || 0;
    const price = parsedData.initialBuy
      ? Number(parsedData.solAmount) / Number(parsedData.initialBuy)
      : 0;

    // Fetch token image from metadata URI
    const imageUrl = parsedData.uri ? await fetchTokenMetadata(parsedData.uri) : null;

    const tokenData = {
      name: parsedData.name || "Unknown",
      symbol: parsedData.symbol || "N/A",
      marketCap: marketCap > 0 ? `$${marketCap.toLocaleString()}` : "N/A",
      price: price > 0 ? `$${price.toFixed(8)}` : "N/A",
      bondingCurve: Math.trunc(parsedData.vSolInBondingCurve), // Convert to integer
      image: imageUrl || "../assets/images/faces/1.jpg", // Default image if not found
    };

    // Broadcast formatted token data to frontend
    broadcast({ type: "newToken", data: tokenData });
  } catch (error) {
    console.error("Error parsing message:", error);
    broadcast({ type: "error", message: "Failed to process token data!" });
  }
});



externalWs.on('close', () => {
  console.log("External WebSocket closed");
  broadcast({ type: "error", message: "Connection closed! Trying to reconnect..." });
});

externalWs.on('error', (err) => {
  console.error("WebSocket error:", err);
  broadcast({ type: "error", message: "WebSocket error occurred!" });
});

// Function to send data to all connected frontend clients
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// New WebSocket connection for SolanaStreaming
(async function () {
  const solanaWs = new WebSocket('wss://api.solanastreaming.com/', undefined, {
    headers: {
      'X-API-KEY': 'bfda16ff9287f3ddc9c48ad89428619a'
    }
  });

  solanaWs.on('error', console.error);

  solanaWs.on('open', () => {
    // Start the pair / price stream
    solanaWs.send('{"id":1,"method":"newPairSubscribe"}');
    broadcast({ type: "success", message: "Connected to Solana pair updates!" });
  });

  solanaWs.on('message', (data) => {
    try {
      const parsedData = JSON.parse(data);

      if (parsedData.method === "newPairNotification" && parsedData.params && parsedData.params.pair) {
        const pair = parsedData.params.pair;

        const pairData = {
          sourceExchange: pair.sourceExchange || "Unknown",
          ammAccount: pair.ammAccount || "N/A",
          baseToken: {
            account: pair.baseToken.account || "N/A",
            name: pair.baseToken.info?.metadata?.name || "Unknown",
            symbol: pair.baseToken.info?.metadata?.symbol || "N/A",
            logo: pair.baseToken.info?.metadata?.logo || "../assets/images/faces/1.jpg",
            decimals: pair.baseToken.info?.decimals || 0,
            supply: pair.baseToken.info?.supply || "N/A",
          },
          quoteToken: {
            account: pair.quoteToken.account || "N/A",
          },
          baseTokenLiquidityAdded: pair.baseTokenLiquidityAdded || "0",
          quoteTokenLiquidityAdded: pair.quoteTokenLiquidityAdded || "0",
        };

        // Broadcast formatted pair data to frontend
        broadcast({ type: "newPair", data: pairData });
      }
    } catch (error) {
      console.error("Error parsing Solana message:", error);
      broadcast({ type: "error", message: "Failed to process Solana pair data!" });
    }
  });

  solanaWs.on('close', () => {
    console.log("Solana WebSocket closed");
    broadcast({ type: "error", message: "Solana connection closed! Trying to reconnect..." });
  });
})();

// Start the server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});