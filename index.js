const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const axios = require('axios');
const solanaWeb3 = require('@solana/web3.js'); // Solana Web3 SDK for wallet and transactions

// MongoDB connection
mongoose.connect('mongodb+srv://nodedb:Precious1@cluster0.q9m0r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log(err));

// Telegram Bot Setup
const bot = new TelegramBot('7423072615:AAE4n0XMukzbdsW_lsvhY2KcmJ2uS_RjR20', { polling: true });

// Define User Schema for MongoDB
const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  registrationDate: { type: Date, default: Date.now },
  solanaWallet: String, // Store Solana wallet address for each user
  solanaBalance: { type: Number, default: 0 } // Track balance of Solana for the user
});

// Create a model for the schema
const User = mongoose.model('User', userSchema);

// Solana Web3 connection setup
const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed');

// Solana Wallet Creation Function
const createSolanaWallet = async () => {
  const wallet = solanaWeb3.Keypair.generate();
  return wallet.publicKey.toBase58(); // Return the public wallet address
};

// Function to fetch latest tokens hitting 99% bonding curve
const fetchLatestTokens = async () => {
  try {
    const response = await axios.post('https://graphql.bitquery.io', {
      query: `{
        ethereum(network: bsc) {
          dexTrades(
            options: {desc: ["block.height"], limit: 5}
            tradeAmountUsd: {gt: 100}
            exchangeName: {is: "Pancake v2"}
            quotePrice: {gteq: 0.99}
          ) {
            block {
              height
            }
            tradeAmountUsd
            quoteCurrency {
              symbol
            }
            baseCurrency {
              symbol
            }
          }
        }
      }`
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': 'YOUR_BITQUERY_API_KEY'
      }
    });

    const tokens = response.data.data.ethereum.dexTrades;
    return tokens.map(token => `Token: ${token.baseCurrency.symbol}, Quote: ${token.quoteCurrency.symbol}, Amount: ${token.tradeAmountUsd} USD`);
  } catch (error) {
    console.error('Error fetching latest tokens:', error.message);
    return ['No token data available at the moment.'];
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
      const balance = await connection.getBalance(new solanaWeb3.PublicKey(walletAddress));

      // Convert the balance from lamports (smallest unit of SOL) to SOL
      const solBalance = balance / solanaWeb3.LAMPORTS_PER_SOL;

      // If the balance has changed, update the balance in MongoDB
      if (user.solanaBalance !== solBalance) {
        user.solanaBalance = solBalance;
        await user.save();

        // Optionally, send a message to the user about the updated balance
        // (You can skip this part if not needed)
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

    bot.sendMessage(chatId, `💳 *Withdrawal Request*\\n\\nYour current balance: ${user.solanaBalance.toFixed(4)} SOL\\n\\nPlease enter the Solana wallet address where you want to withdraw:`);

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
          const senderKeypair = solanaWeb3.Keypair.generate();

          const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.transfer({
              fromPubkey: senderKeypair.publicKey,
              toPubkey: new solanaWeb3.PublicKey(destinationAddress),
              lamports: withdrawalAmount * solanaWeb3.LAMPORTS_PER_SOL,
            })
          );

          const signature = await solanaWeb3.sendAndConfirmTransaction(connection, transaction, [senderKeypair]);

          user.solanaBalance -= withdrawalAmount;
          await user.save();

          bot.sendMessage(chatId, `✅ Withdrawal of ${withdrawalAmount.toFixed(4)} SOL successful!\\n\\nTransaction signature: ${signature}\\nNew balance: ${user.solanaBalance.toFixed(4)} SOL.`);
        } catch (err) {
          bot.sendMessage(chatId, `⚠️ Error processing withdrawal: ${err.message}`);
        }
      });
    });
  }
});

// Handle user login and display latest tokens
bot.onText(/\/login/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user is already registered in MongoDB
  const user = await User.findOne({ telegramId: chatId });

  if (user) {
    bot.sendMessage(chatId, `Welcome back, ${user.firstName}!`, {
      parse_mode: 'Markdown'
    });

    const latestTokens = await fetchLatestTokens();
    bot.sendMessage(chatId, `📊 *Latest Tokens Hitting 99% Bonding Curve:*

${latestTokens.join('\n')}`, { parse_mode: 'Markdown' });
  } else {
    const newUser = new User({
      telegramId: chatId,
      firstName: msg.from.first_name,
      lastName: msg.from.last_name || '',
      username: msg.from.username || ''
    });

    await newUser.save()
      .then(async (savedUser) => {
        const walletAddress = await createSolanaWallet();
        savedUser.solanaWallet = walletAddress;
        await savedUser.save();

        bot.sendMessage(chatId, `Registration successful! 🎉\n\nThank you for joining, ${msg.from.first_name}! 🚀\n\nYour unique Solana wallet address is: ${walletAddress}`, {
          parse_mode: 'Markdown'
        });
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
          { text: '🔍 Check Balance', callback_data: 'check_balance' } // New button to check balance
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
        const balance = await connection.getBalance(new solanaWeb3.PublicKey(user.solanaWallet));
        const solBalance = balance / solanaWeb3.LAMPORTS_PER_SOL;

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
              { text: '🔍 Check Balance', callback_data: 'check_balance' } // New button to check balance
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
          const walletAddress = await createSolanaWallet();
          savedUser.solanaWallet = walletAddress;
          await savedUser.save();

          bot.sendMessage(chatId, `Registration successful!🎉 \n\nThank you for joining, ${query.from.first_name}! 🚀\n\nYour unique Solana wallet address is: ${walletAddress}`, {
            parse_mode: 'Markdown'
          });
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