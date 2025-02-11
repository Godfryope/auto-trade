const axios = require('axios');

// Step 1: Create a wallet
axios.get('https://pumpportal.fun/api/create-wallet')
  .then(response => {
    console.log('API Response:', response.data); // Log the response data
    const data = response.data;
    const walletAddress = data.walletPublicKey;
    const apiKey = data.apiKey;

    if (walletAddress && apiKey) {
      console.log(`Wallet Address: ${walletAddress}`);
      console.log(`API Key: ${apiKey}`);
      
    } else {
      console.error('Failed to create wallet: Invalid response data');
    }
  })
  .catch(error => {
    console.error('Failed to create wallet:', error.response ? error.response.data : error.message);
  });