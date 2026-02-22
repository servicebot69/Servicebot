const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: String,
  service: String,
  name: String,
  discordId: String,
  platform: String,
  issue: String,
  workerId: String,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Order", orderSchema);
