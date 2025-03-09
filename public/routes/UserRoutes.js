const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Endpoint to get user's wallet address and QR code
router.get('/:telegramId', async (req, res) => {
  const telegramId = req.params.telegramId;
  try {
    const user = await User.findOne({ telegramId });

    if (user) {
      res.json({
        walletAddress: user.solanaWallet,
        qrCodeImage: user.qrCodeImage,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;