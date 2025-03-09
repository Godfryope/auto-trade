const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  registrationDate: { type: Date, default: Date.now },
  solanaWallet: String,
  privateKey: String,
  apiKey: String,
  solanaBalance: { type: Number, default: 0 },
  qrCodeImage: String
});

module.exports = mongoose.model('User', userSchema);