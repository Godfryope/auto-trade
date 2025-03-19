const axios = require("axios");

// Fetch all tokens listed on Raydium
async function getRaydiumTokens() {
  try {
    const response = await axios.get("https://api.raydium.io/v2/main/token/list");
    return response.data;
  } catch (error) {
    console.error("Error fetching tokens from Raydium:", error.message);
    return [];
  }
}

// Display the token list
async function main() {
  const tokens = await getRaydiumTokens();
  if (tokens.length > 0) {
    console.log("List of Tokens on Raydium:");
    tokens.forEach(token => {
      console.log(`Name: ${token.name}, Symbol: ${token.symbol}, Mint: ${token.mint}`);
    });
  } else {
    console.log("No tokens found.");
  }
}

main();
