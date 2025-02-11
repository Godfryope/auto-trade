const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('./models/User'); // Adjust the path as necessary

// Route to handle token purchase
router.post('/', async (req, res) => {
  const { telegramId, mint } = req.body;
  const user = await User.findOne({ telegramId });

  if (!user) {
    return res.json({ success: false, message: 'User not found' });
  }

  try {
    const response = await axios.post("https://pumpportal.fun/api/trade?api-key=dcujpn1fdmt78n22dna6upb3ct5p2c3ca4t5aj1fe4qmrhtm5wnmyy26c9c58uv1arw6au3h8tw4cmkgcwt78dbe8n848kj8b1m32u3gcx4n0nuka9rm4ebed1a3cjaeexmpjtjp84ykuc5upckvg90nngkk3c96kgpj2cr9rv4gp36edm74kk7d4r36uj35xn4jc1pen8kuf8", {
      action: "buy",
      mint: mint,
      amount: 0.01,
      denominatedInSol: "true",
      slippage: 10,
      priorityFee: 0.005,
      pool: "pump"
    });
    const data = response.data;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to buy token', error });
  }
});

module.exports = router;