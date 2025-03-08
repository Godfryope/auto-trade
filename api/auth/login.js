const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust to your model
const router = express.Router();

router.post('/login', async (req, res) => {
  const { telegramId } = req.body;

  // Find user
  const user = await User.findOne({ telegramId });

  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found' });
  }

  // Generate a JWT token (valid for 1 hour)
  const token = jwt.sign({ telegramId: user.telegramId }, process.env.JWT_SECRET, { expiresIn: '1h' });

  res.json({ success: true, token });
});

module.exports = router;
