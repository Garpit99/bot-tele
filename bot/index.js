require("dotenv").config();
const express = require("express");
const { Telegraf } = require("telegraf");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// ===== PENTING =====
app.use(express.json());

// ===== HEALTH CHECK =====
app.get("/", (req, res) => {
  res.send("✅ Bot Alive");
});

// ===== WEBHOOK ENDPOINT =====
app.post("/telegram", (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// ===== BOT START COMMAND =====
bot.start((ctx) => {
  console.log("START MASUK");
  ctx.reply("🤖 Bot kamu sudah aktif dan tidak error lagi!");
});

// ===== ERROR HANDLER =====
bot.catch((err) => {
  console.error("BOT ERROR:", err);
});

// ===== EXPORT UNTUK LEAPCELL =====
module.exports = app;
