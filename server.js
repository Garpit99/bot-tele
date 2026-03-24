require("dotenv").config();
const express = require("express");
const { Telegraf } = require("telegraf");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

const PORT = process.env.PORT || 3000;

// ===== BASIC MIDDLEWARE =====
app.use(express.json());

// ===== HEALTH CHECK =====
app.get("/", (req, res) => {
  res.status(200).send("✅ Bot Alive");
});

// ===== TELEGRAM WEBHOOK =====
app.use("/telegram", bot.webhookCallback("/telegram"));

// ===== BOT COMMAND =====
bot.start((ctx) => {
  ctx.reply("🤖 Bot aktif di Leapcell!");
});

bot.help((ctx) => {
  ctx.reply("Gunakan /start untuk mulai.");
});

// ===== ERROR HANDLER =====
bot.catch((err) => {
  console.error("BOT ERROR:", err);
});

// ===== START SERVER =====
app.listen(PORT, async () => {
  console.log("🚀 Server running on port", PORT);

  if (!process.env.WEBHOOK_URL) {
    console.log("❌ WEBHOOK_URL belum diset di environment");
    return;
  }

  const webhookUrl = process.env.WEBHOOK_URL + "/telegram";

  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log("✅ Webhook berhasil diset ke:", webhookUrl);
  } catch (err) {
    console.error("❌ Gagal set webhook:", err.message);
  }
});
