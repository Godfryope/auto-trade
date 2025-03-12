const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Endpoint to get user's wallet addresses and QR codes
router.get('/:telegramId', async (req, res) => {
  const telegramId = req.params.telegramId;
  try {
    const user = await User.findOne({ telegramId });

    if (user) {
      res.json({
        mainWallet: {
          address: user.mainWallet.address,
          qrCodeImage: user.mainWallet.qrCodeImage,
          solanaBalance: user.mainWallet.solanaBalance // Include solanaBalance
        },
        tradingWallet: {
          address: user.tradingWallet.address,
          qrCodeImage: user.tradingWallet.qrCodeImage,
          solanaBalance: user.tradingWallet.solanaBalance // Include solanaBalance
        }
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Endpoint to update user data
router.put('/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const updateData = req.body;

  try {
    const user = await User.findOne({ telegramId });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (updateData.mainWallet) {
      user.mainWallet.solanaBalance = updateData.mainWallet.solanaBalance;
    }
    if (updateData.tradingWallet) {
      user.tradingWallet.solanaBalance = updateData.tradingWallet.solanaBalance;
    }

    await user.save();

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user data:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;