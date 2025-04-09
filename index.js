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
const walletSchema = new mongoose.Schema({
  address: String,
  privateKey: String,
  apiKey: String,
  qrCodeImage: String,
  solanaBalance: { type: Number, default: 0 },
  walletPublicKey: String, // Added walletPublicKey field
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
    const { privateKey, walletPublicKey, walletPublicKey: walletAddress, apiKey } = data;

    if (walletAddress && apiKey) {
      const qrCodeImage = await QRCode.toDataURL(walletAddress);
      return { walletAddress, walletPublicKey, privateKey, apiKey, qrCodeImage };
    } else {
      throw new Error('Invalid response data');
    }
  } catch (error) {
    console.error('Failed to create wallet:', error.response ? error.response.data : error.message);
    return null;
  }
};


import { VersionedTransaction, Keypair, Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js'; // Import Solana web3.js
const connection = new Connection('https://api.mainnet-beta.solana.com'); // Solana RPC URL

async function getMainWalletAddress(telegramId) {
  try {
    const user = await User.findOne({ telegramId });
    if (user) {
      return user.mainWallet.address;
    } else {
      throw new Error('User not found');
    }
  } catch (error) {
    console.error('Error fetching main wallet address:', error);
    throw error;
  }
}

async function updateSolanaBalance(telegramId) {
  try {
    const walletAddress = await getMainWalletAddress(telegramId);
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL; // Convert from lamports to SOL

    console.log(`📊 The Solana balance for wallet ${walletAddress} is: ${solBalance} SOL`);
    return solBalance;
  } catch (err) {
    console.log(`Error fetching balance for wallet: ${err.message}`);
    throw err;
  }
}

app.get('/update-balance/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const balance = await updateSolanaBalance(telegramId);
    res.status(200).json({ balance }); // Return JSON response
  } catch (error) {
    res.status(500).json({ error: 'Error updating balance' });
  }
});

// Set a periodic update every 5 minutes (300,000 ms)
setInterval(async () => {
  try {
    const users = await User.find({});
    for (const user of users) {
      await updateSolanaBalance(user.telegramId);
    }
  } catch (err) {
    console.log(`Error updating balances: ${err.message}`);
  }
}, 300000); // Run every 5 minutes

// You can also run the function once on bot startup to immediately fetch balance
(async () => {
  try {
    const users = await User.find({});
    for (const user of users) {
      await updateSolanaBalance(user.telegramId);
    }
  } catch (err) {
    console.log(`Error updating balances on startup: ${err.message}`);
  }
})();

async function getTradingWalletAddress(telegramId) {
  try {
    const user = await User.findOne({ telegramId });
    if (user) {
      return user.tradingWallet.address;
    } else {
      throw new Error('User not found');
    }
  } catch (error) {
    console.error('Error fetching main wallet address:', error);
    throw error;
  }
}

async function updateSolanaBalance2(telegramId) {
  try {
    const walletAddress = await getTradingWalletAddress(telegramId);
    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL; // Convert from lamports to SOL

    console.log(`📊 The Solana balance for wallet ${walletAddress} is: ${solBalance} SOL`);
    return solBalance;
  } catch (err) {
    console.log(`Error fetching balance for wallet: ${err.message}`);
    throw err;
  }
}

app.get('/update-balance2/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const balance = await updateSolanaBalance2(telegramId);
    res.status(200).json({ balance }); // Return JSON response
  } catch (error) {
    res.status(500).json({ error: 'Error updating balance' });
  }
});

// Set a periodic update every 5 minutes (300,000 ms)
setInterval(async () => {
  try {
    const users = await User.find({});
    for (const user of users) {
      await updateSolanaBalance2(user.telegramId);
    }
  } catch (err) {
    console.log(`Error updating balances: ${err.message}`);
  }
}, 300000); // Run every 5 minutes

// You can also run the function once on bot startup to immediately fetch balance
(async () => {
  try {
    const users = await User.find({});
    for (const user of users) {
      await updateSolanaBalance(user.telegramId);
    }
  } catch (err) {
    console.log(`Error updating balances on startup: ${err.message}`);
  }
})();


app.get('/get-trading-wallet-address', async (req, res) => {
  const { telegramId } = req.query;

  try {
      const user = await User.findOne({ telegramId });
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }

      res.status(200).json({ tradingWallet: user.tradingWallet.address });
  } catch (error) {
      console.error('Error fetching trading wallet address:', error);
      res.status(500).json({ message: 'Error fetching trading wallet address' });
  }
});


// Existing code...

app.post('/withdraw', async (req, res) => {
    const { telegramId, amount, walletAddress } = req.body;

    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user has enough balance
        const publicKey = new PublicKey(user.mainWallet.address);
        const balance = await connection.getBalance(publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL;

        if (solBalance < amount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // Process the withdrawal using apiKey and privateKey
        const { privateKey } = user.mainWallet;

        // Create a keypair from the user's private key
        const fromWallet = Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));

        // Create the transaction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fromWallet.publicKey,
                toPubkey: new PublicKey(walletAddress),
                lamports: amount * LAMPORTS_PER_SOL,
            })
        );

        // Sign and send the transaction
        const signature = await sendAndConfirmTransaction(connection, transaction, [fromWallet]);

        // Update the user's balance
        user.mainWallet.solanaBalance -= parseFloat(amount);
        await user.save();

        res.status(200).json({ message: 'Withdrawal processed successfully', signature });
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        res.status(500).json({ message: 'Error processing withdrawal' });
    }
});

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
        qrCodeImage: mainWalletDetails.qrCodeImage,
        walletPublicKey: mainWalletDetails.walletPublicKey
      };
      newUser.tradingWallet = {
        address: tradingWalletDetails.walletAddress,
        privateKey: tradingWalletDetails.privateKey,
        apiKey: tradingWalletDetails.apiKey,
        qrCodeImage: tradingWalletDetails.qrCodeImage,
        walletPublicKey: tradingWalletDetails.walletPublicKey
      };
      await newUser.save();

      bot.sendMessage(chatId, `🎉 Registration successful! Welcome, ${msg.from.first_name}! 🚀\n\nYour unique Solana wallet addresses are:\n\nMain Wallet: \`${mainWalletDetails.walletAddress}\`\nTrading Wallet: \`${tradingWalletDetails.walletAddress}\``, { parse_mode: 'Markdown' });
      bot.sendPhoto(chatId, mainWalletDetails.qrCodeImage, { caption: 'Here is your QR code for the Main wallet address.' });
      bot.sendPhoto(chatId, tradingWalletDetails.qrCodeImage, { caption: 'Here is your QR code for the Trading wallet address.' });
    } else {
      bot.sendMessage(chatId, `✅ Welcome back, ${user.firstName}!`);
    }

    // Removed req.session.telegramId as req is not defined in this context
    const userData = {
      firstName: user ? user.firstName : newUser.firstName,
      lastName: user ? user.lastName : newUser.lastName,
      username: user ? user.username : newUser.username,
      mainWallet: user ? user.mainWallet.address : newUser.mainWallet.address,
      tradingWallet: user ? user.tradingWallet.address : newUser.tradingWallet.address,
    };

    bot.sendMessage(chatId, `✅ Welcome back, ${user.firstName},! 🚀 Redirecting you to the dashboard...`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔑 Go to Dashboard', url: `https://shimmering-liberation-production.up.railway.app/?telegramId=${chatId}&userData=${encodeURIComponent(JSON.stringify(userData))}` }]
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
        qrCodeImage: mainWalletDetails.qrCodeImage,
        walletPublicKey: mainWalletDetails.walletPublicKey
      };
      newUser.tradingWallet = {
        address: tradingWalletDetails.walletAddress,
        privateKey: tradingWalletDetails.privateKey,
        apiKey: tradingWalletDetails.apiKey,
        qrCodeImage: tradingWalletDetails.qrCodeImage,
        walletPublicKey: tradingWalletDetails.walletPublicKey
      };
      await newUser.save();

      bot.sendMessage(chatId, `🎉 Registration successful! Welcome, ${msg.from.first_name}! 🚀\n\nYour unique Solana wallet addresses are:\n\nMain Wallet: \`${mainWalletDetails.walletAddress}\`\nTrading Wallet: \`${tradingWalletDetails.walletAddress}\``, { parse_mode: 'Markdown' });
      bot.sendPhoto(chatId, mainWalletDetails.qrCodeImage, { caption: 'Here is your QR code for the Main wallet address.' });
      bot.sendPhoto(chatId, tradingWalletDetails.qrCodeImage, { caption: 'Here is your QR code for the Trading wallet address.' });
    } else {
      bot.sendMessage(chatId, `✅ Welcome back, ${user.firstName}!`);
    }

    // Removed req.session.telegramId as req is not defined in this context
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
          [{ text: '🔑 Login', url: `https://shimmering-liberation-production.up.railway.app/?telegramId=${chatId}&userData=${encodeURIComponent(JSON.stringify(userData))}` }]
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

import bs58 from "bs58";

const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com"; // Solana RPC URL
const web3Connection = new Connection(RPC_ENDPOINT, "confirmed");

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files (HTML, JS)
app.use(express.static("public"));

// Toggle state for trading (default to OFF)
let isTradingEnabled = false;

// WebSocket connection for external API
const externalWs = new WebSocket("wss://pumpportal.fun/api/data");

externalWs.on("open", () => {
  console.log("Connected to external WebSocket");

  // Subscribe to new token creation events
  const payload = { method: "subscribeNewToken" };
  externalWs.send(JSON.stringify(payload));

  // Notify frontend about successful connection
  broadcast({ type: "success", message: "Connected to token updates!" });
});

// Handle toggle state updates from frontend
wss.on("connection", (socket) => {
  console.log("New WebSocket connection established.");

  socket.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Message received from client:", data);

      if (data.type === "toggleTrade") {
        // Toggle trading state based on frontend input
        isTradingEnabled = data.state;
        console.log(`Trade toggled: ${isTradingEnabled ? "ON" : "OFF"}`);
      }

      if (data.type === "authenticate") {
        const userWallet = await getTradingWalletAddress(data.telegramId);

        if (userWallet) {
          // Notify frontend of successful authentication
          socket.send(JSON.stringify({ type: "authenticated", wallet: userWallet.address }));
        } else {
          // Notify frontend of failed authentication
          socket.send(JSON.stringify({ type: "error", message: "User not found!" }));
        }
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  });

  socket.on("close", () => {
    console.log("WebSocket connection closed.");
  });
});

async function getTradingWalletAddress(telegramId) {
  try {
    const user = await User.findOne({ telegramId });
    if (user) {
      return {
        address: user.tradingWallet.address,
        privateKey: user.tradingWallet.privateKey,
      };
    } else {
      console.error("User not found for telegramId:", telegramId);
      return null;
    }
  } catch (error) {
    console.error("Error fetching trading wallet address:", error);
    throw error;
  }
}

externalWs.on("message", async (data) => {
  try {
    const parsedData = JSON.parse(data);

    // Broadcast token data to the frontend
    broadcast({ type: "newToken", data: parsedData });

    // Only execute trade if trading is enabled
    if (!isTradingEnabled) {
      console.log("Trading is disabled. Ignoring token trade execution.");
      return;
    }

    const userWallet = await getTradingWalletAddress(parsedData.telegramId);
    if (!userWallet) {
      console.error("User wallet not found! Skipping trade.");
      return;
    }

    // Proceed with trade execution
    const buySignature = await sendPortalTransaction(parsedData, userWallet, "buy");
    if (buySignature) {
      broadcast({ type: "tradeSuccess", data: { buySignature } });

      // Set timeout for selling the token
      setTimeout(async () => {
        const sellSignature = await sendPortalTransaction(parsedData, userWallet, "sell");
        if (sellSignature) {
          broadcast({ type: "tradeSuccess", data: { sellSignature } });
        } else {
          broadcast({ type: "error", message: "Failed to execute sell trade!" });
        }
      }, 1000);
    } else {
      broadcast({ type: "error", message: "Failed to execute buy trade!" });
    }
  } catch (error) {
    console.error("Error processing token data:", error);
    broadcast({ type: "error", message: "Failed to process token data!" });
  }
});

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

externalWs.on("close", () => {
  console.log("External WebSocket closed");
  broadcast({ type: "error", message: "Connection closed! Trying to reconnect..." });
});

externalWs.on("error", (err) => {
  console.error("WebSocket error:", err);
  broadcast({ type: "error", message: "WebSocket error occurred!" });
});

// Function to send data to all connected frontend clients
// function broadcast(data) {
//   wss.clients.forEach((client) => {
//     if (client.readyState === WebSocket.OPEN) {
//       client.send(JSON.stringify(data));
//     }
//   });
// }

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