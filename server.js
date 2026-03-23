require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { connect } = require('./db/database');
const bot = require('./index'); // ✅ FIX PATH

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(bodyParser.json());

// ===== HEALTH CHECK =====
app.get('/', (req, res) => {
  res.status(200).send('✅ Bot is running');
});

// ===== INIT =====
async function init() {
  try {
    // ===== DB CONNECT =====
    await connect();
    console.log('✅ Database connected');

    const webhookPath = '/telegram/webhook';
    const webhookFull = process.env.WEBHOOK_URL
      ? `${process.env.WEBHOOK_URL}${webhookPath}`
      : null;

    if (webhookFull) {
      // ===== WEBHOOK MODE =====
      await bot.telegram.deleteWebhook().catch(() => {});
      await bot.telegram.setWebhook(webhookFull);

      app.use(bot.webhookCallback(webhookPath));

      console.log('🌐 Webhook mode aktif');
      console.log(`➡️ ${webhookFull}`);
    } else {
      // ===== POLLING MODE =====
      await bot.telegram.deleteWebhook().catch(() => {});
      await bot.launch();

      console.log('🤖 Bot running (polling mode)');
    }

    // ===== START SERVER =====
    app.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    });

  } catch (err) {
    console.error('❌ INIT ERROR:', err);
    process.exit(1);
  }
}

init();

// ===== GLOBAL ERROR HANDLER =====
process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('🔥 Unhandled Rejection:', err);
});

// ===== SHUTDOWN =====
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
