require("dotenv").config();
const express = require("express");
const bot = require("./bot");
const { connect } = require("./db/database");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== HEALTH CHECK =====
app.get("/", (req, res) => res.send("✅ Bot Alive"));

// ===== SAFE WEBHOOK =====
async function safeSetWebhook(bot, url, retry = 0) {
  try {
    await bot.telegram.setWebhook(url, {
      drop_pending_updates: true,
    });
    console.log("✅ Webhook set:", url);
  } catch (err) {
    if (err.response?.error_code === 429) {
      const wait = err.response.parameters.retry_after || 1;

      console.log("⏳ Tunggu", wait, "detik...");

      await new Promise(r => setTimeout(r, wait * 1000));

      if (retry < 5) return safeSetWebhook(bot, url, retry + 1);
    } else {
      throw err;
    }
  }
}

// ===== START =====
async function init() {
  try {
    await connect();
    console.log("✅ DB Connected");

    const webhookPath = "/telegram/webhook";
    const webhookUrl = process.env.WEBHOOK_URL
      ? process.env.WEBHOOK_URL + webhookPath
      : null;

    if (webhookUrl) {
      const info = await bot.telegram.getWebhookInfo();

      if (info.url !== webhookUrl) {
        await safeSetWebhook(bot, webhookUrl);
      }

      app.use(bot.webhookCallback(webhookPath));
    } else {
      await bot.launch();
      console.log("🤖 Polling mode");
    }

    app.listen(PORT, () =>
      console.log("🚀 Server jalan di port", PORT)
    );

  } catch (err) {
    console.error("❌ ERROR INIT:", err);
  }
}

init();

// ===== ERROR GLOBAL =====
process.on("uncaughtException", (err) => {
  console.error("🔥 ERROR:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔥 PROMISE ERROR:", err);
});
