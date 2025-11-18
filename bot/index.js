// bot/index.js
const { Telegraf, session } = require('telegraf');
const userHandler = require('./handlers/userHandler');
const adminHandler = require('./handlers/adminHandler');
const uploadHandler = require('./handlers/uploadHandler');
const fsmHandler = require('./handlers/fsmHandler');
const { connect } = require('../db/database'); // ⬅ PENTING: panggil connect()

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('BOT_TOKEN required');

// ==============================
// 🔌 CONNECT REDIS SEBELUM BOT JALAN
// ==============================
(async () => {
  try {
    await connect(); // ⬅ WAJIB, agar getClient() tidak error
    console.log('🔗 Redis connected — starting bot...');
  } catch (err) {
    console.error("❌ Redis failed to connect:", err);
    process.exit(1);
  }
})();

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

bot.start(async (ctx) => {
  try {
    await userHandler.start(ctx, isAdmin(ctx));
  } catch (err) {
    console.error('❌ Error in /start:', err);
  }
});

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

bot.action(/^BUY_PRODUCT_/, async (ctx) => {
  try {
    await userHandler.buyProduct(ctx);
  } catch (err) {
    console.error('❌ BUY_PRODUCT error:', err);
  }
});

bot.action('TRACK_ORDER', async (ctx) => {
  try {
    await userHandler.trackOrder(ctx);
  } catch (err) {
    console.error('❌ TRACK_ORDER error:', err);
  }
});

bot.command('tracking', async (ctx) => {
  try {
    await userHandler.trackOrder(ctx);
  } catch (err) {
    console.error('❌ /tracking error:', err);
  }
});

bot.action('HELP_MENU', async (ctx) => {
  try {
    await userHandler.helpMenu(ctx);
  } catch (err) {
    console.error('❌ HELP_MENU error:', err);
  }
});

/* ===================================
   🛠 ADMIN PANEL & ACTIONS
=================================== */

bot.action('ADMIN_PANEL', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Kamu bukan admin!');
  try {
    await adminHandler.showAdminMenu(ctx);
  } catch (err) {
    console.error('❌ ADMIN_PANEL error:', err);
  }
});

bot.command('admin', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Kamu bukan admin!');
  try {
    await adminHandler.showAdminMenu(ctx);
  } catch (err) {
    console.error('❌ /admin error:', err);
  }
});

/* ============ ADMIN PRODUCT MENU ============ */

bot.action('ADMIN_ADD_PRODUCT', (ctx) => adminHandler.addProduct(ctx));
bot.action('ADMIN_EDIT_PRODUCT', (ctx) => adminHandler.showEditProductMenu(ctx));
bot.action('ADMIN_DELETE_PRODUCT', (ctx) => adminHandler.showDeleteProductMenu(ctx));

bot.action(/^EDIT_PROD_/, (ctx) => adminHandler.handleSelectProductToEdit(ctx));
bot.action(/^DEL_PROD_/, (ctx) => adminHandler.handleSelectDeleteProduct(ctx));
bot.action(/^CONFIRM_DEL_/, (ctx) => adminHandler.handleConfirmDeleteProduct(ctx));
bot.action(/^CANCEL_DEL_/, (ctx) => adminHandler.handleCancelDeleteProduct(ctx));

/* ============ ORDERS ============ */

bot.action('ADMIN_LIST_ORDERS', (ctx) => adminHandler.listOrders(ctx));
bot.action('ADMIN_CONFIRM_PAYMENT', (ctx) => adminHandler.confirmPayment(ctx));

/* ============ RESI & STATUS ============ */

bot.action('ADMIN_SET_RESI', (ctx) => adminHandler.setResi(ctx));
bot.action('ADMIN_SET_STATUS', (ctx) => adminHandler.setStatus(ctx));

/* ============ GREETING / PAYMENT / HELP ============ */

bot.action('ADMIN_SET_GREETING', (ctx) => adminHandler.setGreeting(ctx));
bot.action('ADMIN_SET_PAYMENT', (ctx) => adminHandler.setPaymentInfo(ctx));
bot.action('ADMIN_SET_HELP', (ctx) => adminHandler.setHelpText(ctx));

/* ============ BUTTON CUSTOMIZATION ============ */

bot.action('ADMIN_SET_BUTTONS', (ctx) => adminHandler.showSetButtonsMenu(ctx));
bot.action(/^ADMIN_SET_BTN_/, (ctx) => adminHandler.handleSelectButtonToEdit(ctx));

/* ============ VIDEO UPLOAD ============ */

bot.action('ADMIN_UPLOAD_VIDEO', (ctx) => adminHandler.uploadHelpVideo(ctx));
bot.on('video', (ctx) => adminHandler.handleUploadHelpVideo(ctx));
bot.command('done', (ctx) => adminHandler.handleUploadHelpVideo(ctx));

/* ===================================
   🧾 UPLOAD BUKTI BAYAR
=================================== */
bot.on('photo', (ctx) => {
  try {
    uploadHandler.handleUpload(ctx);
  } catch (err) {
    console.error('❌ Upload error:', err);
  }
});

/* ===================================
   📝 GLOBAL TEXT HANDLER
=================================== */

bot.on('text', async (ctx) => {
  try {
    if (ctx.session?.orderingProduct) return userHandler.handleOrderInput(ctx);
    if (ctx.session?.awaitingAddProduct) return adminHandler.handleAddProduct(ctx);
    if (ctx.session?.awaitingEditProduct) return adminHandler.handleEditProduct(ctx);
    if (ctx.session?.awaitingSetGreeting) return adminHandler.handleSetGreetingText(ctx);
    if (ctx.session?.awaitingSetPayment) return adminHandler.handleSetPaymentInfo(ctx);
    if (ctx.session?.awaitingSetHelp) return adminHandler.handleSetHelpText(ctx);
    if (ctx.session?.awaitingConfirmOrder) return adminHandler.handleConfirmPayment(ctx);
    if (ctx.session?.awaitingSetButtonKey) return adminHandler.handleSetButtonLabel(ctx);

    return fsmHandler.handleState(ctx);
  } catch (err) {
    console.error('❌ GLOBAL TEXT ERROR:', err);
  }
});

/* ===================================
   ⚠️ GLOBAL ERROR HANDLER
=================================== */

bot.catch((err) => {
  console.error('❌ Unhandled bot error:', err);
});

module.exports = bot;
