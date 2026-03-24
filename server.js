require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { connect } = require('./db/database');
const bot = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(bodyParser.json());
app.get('/', (req, res) => res.status(200).send('✅ Bot is running and healthy'));

async function init() {
  await connect();
  console.log('🚀 Database connected');

  const webhookPath = '/telegram/webhook';
  const webhookFull = `${process.env.WEBHOOK_URL}${webhookPath}`;

  if (process.env.WEBHOOK_URL) {
    // 🔧 Hapus polling jika webhook aktif
    await bot.telegram.deleteWebhook().catch(() => {});
    await bot.telegram.setWebhook(webhookFull);

    app.use(bot.webhookCallback(webhookPath));

    console.log(`✅ Webhook registered: ${webhookFull}`);
  } else {
    // 🔄 Mode development: polling
    await bot.telegram.deleteWebhook().catch(() => {});
    await bot.launch();
    console.log('🤖 Bot polling launched (development mode)');
  }

  app.listen(PORT, HOST, () => {
    console.log(`🌐 Server running on http://${HOST}:${PORT}`);
  });
}

init().catch((err) => {
  console.error('❌ Initialization failed:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
