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

// Handle user login (open specified URL)
bot.onText(/\/login/, (msg) => {
  const chatId = msg.chat.id;

  // Send a message with a button that opens the specified URL
  bot.sendMessage(chatId, `🚀 Click the button below to log in:`, {
    reply_markup: {
      inline_keyboard: [
        [{ 
          text: '🔑 Login', 
          url: `https://auto-trade-production.up.railway.app?telegramId=${chatId}`
        }]
      ]
    }
  });
});

// Start command to test bot with styled login button
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ 
          text: '🔑 Login', 
          url: `https://auto-trade-production.up.railway.app?telegramId=${chatId}`
        }]
      ]
    }
  };

  bot.sendMessage(chatId, `Welcome!\n\nClick the button below to log in.`, options);
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});