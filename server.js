require("dotenv").config();
const express = require("express");
const { Telegraf } = require("telegraf");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// WAJIB untuk parsing JSON
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.status(200).send("✅ Bot Alive");
});

// Telegram webhook
app.post("/telegram", (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// Bot command
bot.start((ctx) => {
  console.log("START MASUK");
  ctx.reply("🤖 Bot aktif di Leapcell!");
});

// Error handler
bot.catch((err) => console.error("BOT ERROR:", err));

// SET WEBHOOK SEKALI SAJA
(async () => {
  if (!process.env.WEBHOOK_URL) {
    console.log("❌ WEBHOOK_URL belum diset");
    return;
  }

  const webhookUrl = process.env.WEBHOOK_URL + "/telegram";

  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log("✅ Webhook berhasil diset ke:", webhookUrl);
  } catch (err) {
    console.error("❌ Gagal set webhook:", err.message);
  }
})();

// ❗ PENTING UNTUK LEAPCELL
module.exports = app;
