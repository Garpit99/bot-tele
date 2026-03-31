require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { connect } = require('./db/database');
const bot = require('./bot/index');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.status(200).send('✅ Bot is running');
});

async function init() {
  try {
    await connect();
    console.log('✅ Database connected');

    // ✅ REDIS KEEP ALIVE
    setInterval(async () => {
      try {
        const client = require('./db/database').getClient();
        if (client) {
          await client.ping();
          console.log('🏓 Redis ping');
        }
      } catch {
        console.log('⚠️ Redis ping gagal');
      }
    }, 30000);

    const webhookPath = '/telegram/webhook';
    const webhookFull = process.env.WEBHOOK_URL
      ? `${process.env.WEBHOOK_URL}${webhookPath}`
      : null;

    if (webhookFull) {
      const info = await bot.telegram.getWebhookInfo();

      if (info.url !== webhookFull) {
        console.log("🔄 Setting webhook...");
        await bot.telegram.setWebhook(webhookFull);
      } else {
        console.log("✅ Webhook sudah sama");
      }

      app.use(bot.webhookCallback(webhookPath));

      console.log('🌐 Webhook mode aktif');
      console.log(`➡️ ${webhookFull}`);
    } else {
      await bot.telegram.deleteWebhook().catch(() => {});
      await bot.launch();

      console.log('🤖 Bot running (polling mode)');
    }

    app.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    });

  } catch (err) {
    console.error('❌ INIT ERROR:', err);
    process.exit(1);
  }
}

init();

// ERROR HANDLER
process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('🔥 Unhandled Rejection:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
