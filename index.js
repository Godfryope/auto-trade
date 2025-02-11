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

// Function to create a wallet using PumpPortal API
const createSolanaWallet = async () => {
  try {
    const response = await axios.get('https://pumpportal.fun/api/create-wallet');
    const data = response.data;
    const walletAddress = data.walletPublicKey;
    const privateKey = data.walletPrivateKey;
    const apiKey = data.apiKey;

    if (walletAddress && privateKey && apiKey) {
      return { walletAddress, privateKey, apiKey };
    } else {
      throw new Error('Invalid response data');
    }
  } catch (error) {
    throw new Error(error.response ? error.response.data : error.message);
  }
};

// Function to update user's Solana balance
const updateSolanaBalance = async () => {
  // Fetch all users from the database
  const users = await User.find({});

  // Loop through each user to fetch and update their Solana balance
  for (let user of users) {
    try {
      // Get the user's Solana wallet address
      const walletAddress = user.solanaWallet;

      // Get the current balance of the user's wallet from Solana blockchain
      const response = await axios.get(`https://pumpportal.fun/api/get-balance?wallet=${walletAddress}&apiKey=${user.apiKey}`);
      const balance = response.data.balance;
      const solBalance = balance / 1000000000; // Convert from lamports to SOL

      // If the balance has changed, update the balance in MongoDB
      if (user.solanaBalance !== solBalance) {
        user.solanaBalance = solBalance;
        await user.save();

        // Optionally, send a message to the user about the updated balance
        const chatId = user.telegramId;
        bot.sendMessage(chatId, `📊 Your Solana balance has been updated! Your new balance is: ${solBalance} SOL`);
      }
    } catch (err) {
      console.log(`Error fetching balance for user ${user.telegramId}: ${err.message}`);
    }
  }
};

// Set a periodic update every 5 minutes (300,000 ms)
setInterval(updateSolanaBalance, 300000); // Run every 5 minutes

// You can also run the function once on bot startup to immediately fetch balances
updateSolanaBalance();

// Handle Solana withdrawal
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;

  if (query.data === 'withdrawal') {
    const user = await User.findOne({ telegramId: chatId });

    if (!user || !user.solanaWallet) {
      bot.sendMessage(chatId, '⚠️ *User not found or wallet not set.*\n\nPlease log in first using the /login command.');
      return;
    }

    if (user.solanaBalance <= 0) {
      bot.sendMessage(chatId, '⚠️ Insufficient balance. Please deposit SOL first.');
      return;
    }

    bot.sendMessage(chatId, `💳 *Withdrawal Request*\n\nYour current balance: ${user.solanaBalance.toFixed(4)} SOL\n\nPlease enter the Solana wallet address where you want to withdraw:`);

    bot.once('message', async (msg) => {
      const destinationAddress = msg.text.trim();

      // Validate the wallet address
      if (!solanaWeb3.PublicKey.isOnCurve(destinationAddress)) {
        bot.sendMessage(chatId, '⚠️ Invalid Solana wallet address. Please check and try again.');
        return;
      }

      bot.sendMessage(chatId, 'Enter the amount of SOL you want to withdraw:');
      
      bot.once('message', async (amountMsg) => {
        const withdrawalAmount = parseFloat(amountMsg.text);

        if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
          bot.sendMessage(chatId, '⚠️ Invalid amount. Please enter a valid number.');
          return;
        }

        if (withdrawalAmount > user.solanaBalance) {
          bot.sendMessage(chatId, '⚠️ Insufficient balance. Please enter an amount within your available balance.');
          return;
        }

        try {
          const response = await axios.post('https://pumpportal.fun/api/withdraw', {
            fromWallet: user.solanaWallet,
            privateKey: user.privateKey,
            toWallet: destinationAddress,
            amount: withdrawalAmount,
            apiKey: user.apiKey
          });

          user.solanaBalance -= withdrawalAmount;
          await user.save();

          bot.sendMessage(chatId, `✅ Withdrawal of ${withdrawalAmount.toFixed(4)} SOL successful!\n\nTransaction signature: ${response.data.signature}\nNew balance: ${user.solanaBalance.toFixed(4)} SOL`);
        } catch (err) {
          bot.sendMessage(chatId, `⚠️ Error processing withdrawal: ${err.message}`);
        }
      });
    });
  }
});

// const ws = new WebSocket('wss://pumpportal.fun/api/data');

// ws.on('open', () => {
//     console.log('✅ Connected to PumpPortal WebSocket');
//     ws.send(JSON.stringify({ method: "subscribeNewToken" }));
// });

// ws.on('message', async (data) => {
//     try {
//         const tokenData = JSON.parse(data);
//         console.log('📩 Raw Data Received:', tokenData);

//         if (tokenData.vTokensInBondingCurve && tokenData.vSolInBondingCurve) {
//             const boundingCurvePercentage = (tokenData.vTokensInBondingCurve / 
//                 (tokenData.vTokensInBondingCurve + tokenData.vSolInBondingCurve)) * 100;

//             if (boundingCurvePercentage >= 98) {
//                 const tokenInfo = `🔥 98%+ Bounding Curve Token:
// 📛 Name: ${tokenData.name}
// 💠 Symbol: ${tokenData.symbol}
// 📊 Bounding Curve: ${boundingCurvePercentage.toFixed(2)}%
// 💰 Market Cap: ${tokenData.marketCapSol} SOL
// 🔗 URI: ${tokenData.uri}`;

//                 bot.sendMessage(chatId, tokenInfo);
//             }
//         }
//     } catch (error) {
//         console.error('❌ Error parsing message:', error);
//     }
// });

// ws.on('error', (error) => {
//     console.error('🚨 WebSocket Error:', error);
// });

// ws.on('close', (code, reason) => {
//     console.log(`❌ Connection closed: ${code} - ${reason}`);
// });

// Command to handle user login (check if user exists or needs registration)
bot.onText(/\/login/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user is already registered in MongoDB
  const user = await User.findOne({ telegramId: chatId });

  if (user) {
    // If user exists, show the main menu
    bot.sendMessage(chatId, `✅ Welcome ${user.firstName}! Fetching latest tokens...`);

    // Simulate fetching token data after login
    // ws.send(JSON.stringify({ method: "fetchLatestTokens" }));

    setTimeout(() => {
        bot.sendMessage(chatId, "📢 You will receive token alerts here!");
    }, 2000);

    // Display menu options for the user
    const menuOptions = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💸 Deposit', callback_data: 'deposit_solana' },
            { text: '💳 Withdrawal', callback_data: 'withdrawal' }
          ],
          [
            { text: '📈 Opened Positions', callback_data: 'opened_positions' },
            { text: '📜 History', callback_data: 'history' }
          ],
          [
            { text: '🔍 Check Balance', callback_data: 'check_balance' },
            { text: '📈 Trade', web_app: { url: `https://auto-trade-production.up.railway.app?telegramId=${chatId}` } } // New Trade button with mini app
          ]
        ]
      }
    };

    bot.sendMessage(chatId, 'Choose an action from the menu below:', menuOptions);
  } else {
    // If user doesn't exist, register them silently
    const newUser = new User({
      telegramId: chatId,
      firstName: msg.from.first_name,
      lastName: msg.from.last_name || '',
      username: msg.from.username || ''
    });

    await newUser.save()
      .then(async (savedUser) => {
        // Create a Solana wallet for the user
        const { walletAddress, privateKey, apiKey } = await createSolanaWallet();
        savedUser.solanaWallet = walletAddress;
        savedUser.privateKey = privateKey;
        savedUser.apiKey = apiKey;
        await savedUser.save();

        bot.sendMessage(chatId, `Registration successful!🎉 \n\nThank you for joining, ${msg.from.first_name}! 🚀\n\nYour unique Solana wallet address is: ${walletAddress}`, {
          parse_mode: 'Markdown'
        });

        // Show the main menu after registration
        const menuOptions = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💸 Deposit', callback_data: 'deposit_solana' },
                { text: '💳 Withdrawal', callback_data: 'withdrawal' }
              ],
              [
                { text: '📈 Opened Positions', callback_data: 'opened_positions' },
                { text: '📜 History', callback_data: 'history' }
              ],
              [
                { text: '🔍 Check Balance', callback_data: 'check_balance' },
                { text: '📈 Trade', web_app: { url: `https://auto-trade-production.up.railway.app?telegramId=${chatId}` } } // New Trade button with mini app
              ]
            ]
          }
        };

        bot.sendMessage(chatId, 'Choose an action from the menu below:', menuOptions);

      })
      .catch(err => {
        bot.sendMessage(chatId, `⚠️ *Error during registration:*\n${err.message}`, {
          parse_mode: 'Markdown'
        });
      });
  }
});

// Start command to test bot with styled login button
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔑 Login', callback_data: 'login' }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, `Welcome to the MemeTrade Bot!\n\nTo get started, click below to log in. Once logged in, you'll be ready to explore all the features of this bot! 💼\n\nLet’s make this fun! 😎`, options);
});

// Help command to show available commands
bot.onText(/\/help/, (msg) => {
  const helpMessage = `Available Commands:
/start - Start the bot and display the login button
/login - Log in or register to the platform
/menu - Show the main menu with available options
/help - Show this help message`;

  bot.sendMessage(msg.chat.id, helpMessage);
});

// Updated Menu Command with a "Check Balance" Button
bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;

  const menuOptions = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💸 Deposit', callback_data: 'deposit_solana' },
          { text: '💳 Withdrawal', callback_data: 'withdrawal' }
        ],
        [
          { text: '📈 Opened Positions', callback_data: 'opened_positions' },
          { text: '📜 History', callback_data: 'history' }
        ],
        [
          { text: '🔍 Check Balance', callback_data: 'check_balance' },
          { text: '📈 Trade', web_app: { url: `https://auto-trade-production.up.railway.app?telegramId=${chatId}` } } // New Trade button with mini app
        ]
      ]
    }
  };

  bot.sendMessage(chatId, 'Choose an action from the menu below:', menuOptions);
});

// Handle Check Balance Callback Query
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;

  if (query.data === 'check_balance') {
    // Fetch the user from the database
    const user = await User.findOne({ telegramId: chatId });

    if (user && user.solanaWallet) {
      try {
        // Get the current balance of the user's wallet from Solana blockchain
        const response = await axios.get(`https://pumpportal.fun/api/get-balance?wallet=${user.solanaWallet}&apiKey=${user.apiKey}`);
        const balance = response.data.balance;
        const solBalance = balance / 1000000000; // Convert from lamports to SOL

        bot.sendMessage(chatId, `📊 Your current Solana balance is: *${solBalance.toFixed(4)} SOL*`, {
          parse_mode: 'Markdown'
        });
      } catch (err) {
        bot.sendMessage(chatId, `⚠️ Error fetching balance: ${err.message}`);
      }
    } else {
      bot.sendMessage(chatId, '⚠️ *User not found or wallet not set.*\n\nPlease log in first using the /login command.');
    }
  }
});

// Handling inline button presses
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;

  if (query.data === 'login') {
    // Check if the user is already registered in MongoDB
    const user = await User.findOne({ telegramId: chatId });

    if (user) {
      // If user exists, show the main menu
      bot.sendMessage(chatId, `Welcome back, ${user.firstName}!`, {
        parse_mode: 'Markdown'
      });

      // Display menu options for the user
      const menuOptions = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💸 Deposit', callback_data: 'deposit_solana' },
              { text: '💳 Withdrawal', callback_data: 'withdrawal' }
            ],
            [
              { text: '📈 Opened Positions', callback_data: 'opened_positions' },
              { text: '📜 History', callback_data: 'history' }
            ],
            [
              { text: '🔍 Check Balance', callback_data: 'check_balance' },
              { text: '📈 Trade', web_app: { url: `https://auto-trade-production.up.railway.app?telegramId=${chatId}` } } // New Trade button with mini app
            ]
          ]
        }
      };

      bot.sendMessage(chatId, 'Choose an action from the menu below:', menuOptions);
    } else {
      // If user doesn't exist, register them silently
      const newUser = new User({
        telegramId: chatId,
        firstName: query.from.first_name,
        lastName: query.from.last_name || '',
        username: query.from.username || ''
      });

      await newUser.save()
        .then(async (savedUser) => {
          // Create a Solana wallet for the user
          const { walletAddress, privateKey, apiKey } = await createSolanaWallet();
          savedUser.solanaWallet = walletAddress;
          savedUser.privateKey = privateKey;
          savedUser.apiKey = apiKey;
          await savedUser.save();

          bot.sendMessage(chatId, `Registration successful!🎉 \n\nThank you for joining, ${query.from.first_name}! 🚀\n\nYour unique Solana wallet address is: ${walletAddress}`, {
            parse_mode: 'Markdown'
          });

          // Show the main menu after registration
          const menuOptions = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '💸 Deposit', callback_data: 'deposit_solana' },
                  { text: '💳 Withdrawal', callback_data: 'withdrawal' }
                ],
                [
                  { text: '📈 Opened Positions', callback_data: 'opened_positions' },
                  { text: '📜 History', callback_data: 'history' }
                ],
                [
                  { text: '🔍 Check Balance', callback_data: 'check_balance' },
                  { text: '📈 Trade', web_app: { url: `https://auto-trade-production.up.railway.app?telegramId=${chatId}` } } // New Trade button with mini app
                ]
              ]
            }
          };

          bot.sendMessage(chatId, 'Choose an action from the menu below:', menuOptions);
        })
        .catch(err => {
          bot.sendMessage(chatId, `⚠️ *Error during registration:*\n${err.message}`, {
            parse_mode: 'Markdown'
          });
        });
    }
  }

  // Handling menu options
  if (query.data === 'buy_token') {
    bot.sendMessage(chatId, '📈 *Buying token...*\n\nYou are about to purchase a token at 99% or 98% bonding curve, just before migration to Raydium. Please wait...');
    // Implement API logic here to buy the token using Bitquery and Jupiter API
    // e.g., axios calls to Jupiter API to perform the trade
  }

  if (query.data === 'monitor_market_cap') {
    bot.sendMessage(chatId, '📊 *Monitoring Market Cap...*\n\nI will track the market cap in real-time. You will be alerted if it drops below your set threshold.');
    // Implement logic to fetch market cap from CoinGecko API
  }

  if (query.data === 'sell_token') {
    bot.sendMessage(chatId, '⚖️ *Selling token...*\n\nThe market cap has dropped below your set threshold. The bot is selling your token to prevent losses. You can adjust the threshold if you believe the token will recover.');
    // Implement logic to sell token (e.g., stop-loss with Jupiter API)
  }

  if (query.data === 'deposit_solana') {
    // Fetch the user to get their Solana wallet address
    const user = await User.findOne({ telegramId: chatId });
  
    if (user) {
      bot.sendMessage(chatId, `💸 *Deposit Solana...*\n\nPlease send Solana to the following wallet address:\n\n${user.solanaWallet}`);
  
      bot.once('message', async (msg) => {
        // Assume the message contains the deposit amount as a string
        const depositAmount = parseFloat(msg.text);
  
        if (isNaN(depositAmount) || depositAmount <= 0) {
          bot.sendMessage(chatId, '⚠️ Invalid amount. Please enter a valid Solana deposit amount.');
        } else {
          // Update user's Solana balance
          user.solanaBalance += depositAmount;
          await user.save();
  
          bot.sendMessage(chatId, `💰 Solana Deposit of ${depositAmount} SOL confirmed! Your new balance is ${user.solanaBalance} SOL.`);
        }
      });
    } else {
      bot.sendMessage(chatId, '⚠️ *User not found.*\n\nPlease log in first using the /login command.');
    }
  }  
});

app.get('/api/authenticate/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const user = await User.findOne({ telegramId });

  if (user) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.get('/api/tokens', async (req, res) => {
  // Fetch tokens from the PumpPortal API
  try {
    const response = await fetch('https://pumpportal.fun/api/tokens');
    const tokens = await response.json();
    res.json(tokens);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

app.post('/api/buy', async (req, res) => {
  const { telegramId, mint } = req.body;
  const user = await User.findOne({ telegramId });

  if (!user) {
    return res.json({ success: false, message: 'User not found' });
  }

  try {
    const response = await fetch("https://pumpportal.fun/api/trade?api-key=dcujpn1fdmt78n22dna6upb3ct5p2c3ca4t5aj1fe4qmrhtm5wnmyy26c9c58uv1arw6au3h8tw4cmkgcwt78dbe8n848kj8b1m32u3gcx4n0nuka9rm4ebed1a3cjaeexmpjtjp84ykuc5upckvg90nngkk3c96kgpj2cr9rv4gp36edm74kk7d4r36uj35xn4jc1pen8kuf8", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "action": "buy",
        "mint": mint,
        "amount": 0.01,
        "denominatedInSol": "true",
        "slippage": 10,
        "priorityFee": 0.005,
        "pool": "pump"
      })
    });
    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to buy token', error });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});