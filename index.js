// Command to handle user login (check if user exists or needs registration)
bot.onText(/\/login/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user is already registered in MongoDB
  const user = await User.findOne({ telegramId: chatId });

  if (user) {
    // If user exists, redirect to the URL with user details
    bot.sendMessage(chatId, `Welcome back, ${user.firstName}!`, {
      parse_mode: 'Markdown'
    });
    bot.sendMessage(chatId, `Redirecting you to the dashboard...`);
    bot.sendMessage(chatId, `https://auto-trade-production.up.railway.app/dashboard?telegramId=${chatId}&firstName=${user.firstName}&lastName=${user.lastName}&username=${user.username}&solanaWallet=${user.solanaWallet}`);
  } else {
    // If user doesn't exist, register them silently
    const newUser = new User({
      telegramId: chatId,
      firstName: msg.from.first_name,
      lastName: msg.from.last_name || '',
      username: msg.from.username || ''
    });

    // Create a Solana wallet for the user and save the user with the wallet details
    const walletDetails = await createSolanaWallet();
    if (walletDetails) {
      const { walletAddress, privateKey, apiKey } = walletDetails;
      // Assign wallet details to newUser
      newUser.solanaWallet = walletAddress;
      newUser.privateKey = privateKey;
      newUser.apiKey = apiKey;

      console.log('Wallet details successfully retrieved and used.');

      await newUser.save()
        .then((savedUser) => {
          bot.sendMessage(chatId, `Registration successful!🎉 \n\nThank you for joining, ${msg.from.first_name}! 🚀\n\nYour unique Solana wallet address is: ${savedUser.solanaWallet}`, {
            parse_mode: 'Markdown'
          });
          bot.sendMessage(chatId, `Redirecting you to the dashboard...`);
          bot.sendMessage(chatId, `https://auto-trade-production.up.railway.app/dashboard?telegramId=${chatId}&firstName=${savedUser.firstName}&lastName=${savedUser.lastName}&username=${savedUser.username}&solanaWallet=${savedUser.solanaWallet}`);
        })
        .catch(err => {
          bot.sendMessage(chatId, `⚠️ *Error during registration:*\n${err.message}`, {
            parse_mode: 'Markdown'
          });
        });
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
      // If user exists, redirect to the URL with user details
      bot.sendMessage(chatId, `Welcome back, ${user.firstName}!`, {
        parse_mode: 'Markdown'
      });
      bot.sendMessage(chatId, `Redirecting you to the dashboard...`);
      bot.sendMessage(chatId, `https://auto-trade-production.up.railway.app/dashboard?telegramId=${chatId}&firstName=${user.firstName}&lastName=${user.lastName}&username=${user.username}&solanaWallet=${user.solanaWallet}`);
    } else {
      // If user doesn't exist, register them silently
      const newUser = new User({
        telegramId: chatId,
        firstName: query.from.first_name,
        lastName: query.from.last_name || '',
        username: query.from.username || ''
      });

      // Create a Solana wallet for the user and save the user with the wallet details
      const walletDetails = await createSolanaWallet();
      if (walletDetails) {
        const { walletAddress, privateKey, apiKey } = walletDetails;
        // Assign wallet details to newUser
        newUser.solanaWallet = walletAddress;
        newUser.privateKey = privateKey;
        newUser.apiKey = apiKey;

        console.log('Wallet details successfully retrieved and used.');

        await newUser.save()
          .then((savedUser) => {
            bot.sendMessage(chatId, `Registration successful!🎉 \n\nThank you for joining, ${query.from.first_name}! 🚀\n\nYour unique Solana wallet address is: ${savedUser.solanaWallet}`, {
              parse_mode: 'Markdown'
            });
            bot.sendMessage(chatId, `Redirecting you to the dashboard...`);
            bot.sendMessage(chatId, `https://auto-trade-production.up.railway.app/dashboard?telegramId=${chatId}&firstName=${savedUser.firstName}&lastName=${savedUser.lastName}&username=${savedUser.username}&solanaWallet=${savedUser.solanaWallet}`);
          })
          .catch(err => {
            bot.sendMessage(chatId, `⚠️ *Error during registration:*\n${err.message}`, {
              parse_mode: 'Markdown'
            });
          });
      }
    }
  }
  // Other callback query handlers...
});
