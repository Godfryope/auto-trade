const express = require('express');
const router = express.Router();
const User = require('./models/User'); // Adjust the path as necessary

// Route to authenticate user by Telegram ID
router.get('/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const user = await User.findOne({ telegramId });

  if (user) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

module.exports = router;