const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const axios = require('axios');
const WebSocket = require('ws');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect('mongodb+srv://bitcoption:Precious1@autotrader.myq0i.mongodb.net/?retryWrites=true&w=majority&appName=autotrader')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log(err));

// Telegram Bot Setup
const bot = new TelegramBot('7423072615:AAE4n0XMukzbdsW_lsvhY2KcmJ2uS_RjR20', { polling: true });

app.use(express.json());
app.use(express.static('public'));

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
  solanaBalance: { type: Number, default: 0 } // Track balance of Solana for the user
});

// Create a model for the schema
const User = mongoose.model('User', userSchema);

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
      return { walletAddress, privateKey, apiKey };
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
      await newUser.save();

      bot.sendMessage(
        chatId,
        `🎉 Registration successful! Welcome, ${msg.from.first_name}! 🚀\n\nYour unique Solana wallet address is: \`${walletDetails.walletAddress}\``,
        { parse_mode: 'Markdown' }
      );
    } else {
      bot.sendMessage(chatId, `✅ Welcome back, ${user.firstName}!`);
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

// // Handle user login (open specified URL)
// bot.onText(/\/login/, (msg) => {
//   const chatId = msg.chat.id;

//   // Send a message with a button that opens the specified URL
//   bot.sendMessage(chatId, `🚀 Click the button below to log in:`, {
//     reply_markup: {
//       inline_keyboard: [
//         [{ 
//           text: '🔑 Login', 
//           url: `https://auto-trade-production.up.railway.app?telegramId=${chatId}`
//         }]
//       ]
//     }
//   });
// });

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
      await newUser.save();

      bot.sendMessage(
        chatId,
        `🎉 Registration successful! Welcome, ${msg.from.first_name}! 🚀\n\nYour unique Solana wallet address is: \`${walletDetails.walletAddress}\``,
        { parse_mode: 'Markdown' }
      );
    } else {
      bot.sendMessage(chatId, `✅ Welcome back, ${user.firstName}!`);
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

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});