// bot/index.js
const { Telegraf, session } = require('telegraf');
const userHandler = require('./handlers/userHandler');
const adminHandler = require('./handlers/adminHandler');
const uploadHandler = require('./handlers/uploadHandler');
const fsmHandler = require('./handlers/fsmHandler');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('BOT_TOKEN required');

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// 🧑‍💼 List admin dari .env
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

function isAdmin(ctx) {
  return ADMIN_IDS.includes(String(ctx.from?.id));
}

/* ===================================
   👥 USER COMMANDS & MENU UTAMA
=================================== */

// /start command — tampilkan menu utama
bot.start(async (ctx) => {
  try {
    await userHandler.start(ctx, isAdmin(ctx));
  } catch (err) {
    console.error('❌ Error in /start:', err);
  }
});

// tombol utama user
bot.action('VIEW_PRODUCTS', async (ctx) => {
  try {
    await userHandler.viewProducts(ctx);
  } catch (err) {
    console.error('❌ VIEW_PRODUCTS error:', err);
  }
});

bot.action(/^VIEW_DETAIL_/, async (ctx) => {
  try {
    await userHandler.viewProductDetail(ctx);
  } catch (err) {
    console.error('❌ VIEW_DETAIL error:', err);
  }
});

bot.action(/^OPEN_LINK_/, async (ctx) => {
  try {
    await userHandler.openRandomLink(ctx);
  } catch (err) {
    console.error('❌ OPEN_LINK error:', err);
  }
});

/* ✅ tambahkan ini — agar tombol “Beli Produk” bisa bekerja */
bot.action(/^BUY_PRODUCT_/, async (ctx) => {
  try {
    await userHandler.buyProduct(ctx);
  } catch (err) {
    console.error('❌ BUY_PRODUCT error:', err);
  }
});

/* ✅ tambahkan agar user bisa tracking order nanti */
bot.action('TRACK_ORDER', async (ctx) => {
  try {
    await userHandler.trackOrder(ctx);
  } catch (err) {
    console.error('❌ TRACK_ORDER error:', err);
  }
});

// command manual tracking
bot.command('tracking', async (ctx) => {
  try {
    await userHandler.trackOrder(ctx);
  } catch (err) {
    console.error('❌ /tracking error:', err);
  }
});

/* ===================================
   🛠 ADMIN PANEL & ACTIONS
=================================== */

// Tombol "Admin Panel" dari menu utama
bot.action('ADMIN_PANEL', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Kamu bukan admin!');
  try {
    await adminHandler.showAdminMenu(ctx);
  } catch (err) {
    console.error('❌ ADMIN_PANEL error:', err);
  }
});

// Command manual: /admin
bot.command('admin', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Kamu bukan admin!');
  try {
    await adminHandler.showAdminMenu(ctx);
  } catch (err) {
    console.error('❌ /admin error:', err);
  }
});

// Tombol-tombol di panel admin
bot.action('ADMIN_ADD_PRODUCT', (ctx) => adminHandler.addProduct(ctx));
bot.action('ADMIN_DELETE_PRODUCT', (ctx) => adminHandler.deleteProduct(ctx));
bot.action('ADMIN_LIST_ORDERS', (ctx) => adminHandler.listOrders(ctx));
bot.action('ADMIN_CONFIRM_PAYMENT', (ctx) => adminHandler.confirmPayment(ctx));
bot.action('ADMIN_SET_RESI', (ctx) => adminHandler.setResi(ctx));
bot.action('ADMIN_SET_STATUS', (ctx) => adminHandler.setStatus(ctx));
bot.action('ADMIN_SET_GREETING', (ctx) => adminHandler.setGreeting(ctx));

/* ===================================
   🧾 UPLOAD & FSM INPUT HANDLER
=================================== */
bot.on('photo', (ctx) => {
  try {
    uploadHandler.handleUpload(ctx);
  } catch (err) {
    console.error('❌ Upload error:', err);
  }
});

/* ✅ Update agar bisa tangkap input order user */
bot.on('text', async (ctx) => {
  try {
    if (ctx.session?.orderingProduct) {
      await userHandler.handleOrderInput(ctx); // <— kirim data order
    } else {
      await fsmHandler.handleState(ctx); // fallback FSM handler
    }
  } catch (err) {
    console.error('❌ FSM/text error:', err);
  }
});

/* ===================================
   ⚠️ GLOBAL ERROR HANDLER
=================================== */
bot.catch((err, ctx) => {
  console.error('❌ Unhandled bot error:', err);
});

module.exports = bot;
