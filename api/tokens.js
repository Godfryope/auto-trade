const express = require('express');
const router = express.Router();
const axios = require('axios');

// Route to fetch tokens from PumpPortal API
router.get('/', async (req, res) => {
  try {
    const response = await axios.get('https://pumpportal.fun/api/tokens');
    const tokens = response.data;
    res.json(tokens);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

module.exports = router;