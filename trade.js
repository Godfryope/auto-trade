var request = require("request");

var options = {
  method: "POST",
  url: "https://streaming.bitquery.io/eap",
  headers: {
    "Content-Type": "application/json",
    Authorization:
      "Bearer ory_at_ES3V8WqpOjGsr6hAc54V-WTE-mKjvajBWuX8hhqJiWg.AU-UGWcDcME8mEhFsTartaMAORq5Lkib4A3eKs6fzSM",
  },
  body: JSON.stringify({
    query: 'subscription MyQuery {\n  Solana {\n    DEXPools(\n      where: {Pool: {Base: {PostAmount: {gt: \"206900000\", lt: \"246555000\"}}, Dex: {ProgramAddress: {is: \"6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P\"}}, Market: {QuoteCurrency: {MintAddress: {is: \"11111111111111111111111111111111\"}}}}, Transaction: {Result: {Success: true}}}\n    ) {\n      Pool {\n        Market {\n          BaseCurrency {\n            MintAddress\n            Name\n            Symbol\n          }\n          MarketAddress\n          QuoteCurrency {\n            MintAddress\n            Name\n            Symbol\n          }\n        }\n        Dex {\n          ProtocolName\n          ProtocolFamily\n        }\n        Base {\n          Balance: PostAmount\n          Marketcap: PostAmountInUSD\n          PriceInUSD\n        }\n        Quote {\n          PostAmountInUSD\n        }\n      }\n    }\n    DEXTrades {\n      Trade {\n        Buy {\n          Currency {\n            Uri\n          }\n          PriceInUSD\n        }\n      }\n    }\n  }\n}\n',
    variables: "{}",
  }),
};

request(options, function (error, response) {
  if (error) throw new Error(error);

  try {
    var responseBody = JSON.parse(response.body);
    console.log("Response Body: ", responseBody);

    var pools = responseBody?.data?.Solana?.DEXPools || [];
    var trades = responseBody?.data?.Solana?.DEXTrades || [];

    pools.forEach((pool, index) => {
      const base = pool?.Pool?.Market?.BaseCurrency || {};
      const quote = pool?.Pool?.Market?.QuoteCurrency || {};
      const marketcap = pool?.Pool?.Base?.PriceInUSD * 1000000000 || "N/A";
      const priceUSD = pool?.Pool?.Base?.PriceInUSD || "N/A";
      const balance = pool?.Pool?.Base?.Balance ?? 0; // Ensure it's a number
      const uri = trades?.Trade?.Buy?.Currency?.Uri || "N/A";
      const priceUSD2 = responseBody?.data?.Solana?.DEXTrades?.Trade?.Buy?.PriceInUSD || "N/A";

      // Calculate bonding curve safely
      const bondingcurve =
        balance > 0
          ? (100 - ((balance - 206900000) * 100) / 793100000).toFixed(4)
          : "N/A";

      const dexName = pool?.Pool?.Dex?.ProtocolName || "Unknown DEX";

      console.log(`--- Token Update #${index + 1} ---`);
      console.log(`DEX: ${dexName}`);
      console.log(`Token: ${base?.Name || "Unknown"} (${base?.Symbol || "N/A"})`);
      console.log(`Mint Address: ${base?.MintAddress || "N/A"}`);
      console.log(`Price: $${priceUSD !== "N/A" ? parseFloat(priceUSD).toFixed(10) : "N/A"}`);
      console.log(`Market Cap: $${marketcap !== "N/A" ? parseFloat(marketcap).toLocaleString() : "N/A"}`);
      console.log(`Bonding Curve: ${bondingcurve}%`);
      console.log(`priceUSD2: $${priceUSD2 !== "N/A" ? parseFloat(priceUSD2).toFixed(10) : "N/A"}`);
      console.log(`URI: ${uri}`);
      console.log(`Pair: ${base?.Symbol || "N/A"} / ${quote?.Symbol || "N/A"}`);
      console.log("--------------------------------\n");
    });
  } catch (e) {
    console.error("Failed to parse response body: ", e);
  }
});
