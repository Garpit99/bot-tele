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

bot.start(async (ctx) => {
  try {
    await userHandler.start(ctx, isAdmin(ctx));
  } catch (err) {
    console.error('❌ Error in /start:', err);
  }
});

// ===================================
// USER BUTTONS
// ===================================

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

// Tracking
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

// Help
bot.action('HELP_MENU', (ctx) => userHandler.helpMenu(ctx));

/* ===================================
   🛠 ADMIN PANEL
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

// CRUD Produk
bot.action('ADMIN_ADD_PRODUCT', (ctx) => adminHandler.addProduct(ctx));
bot.action('ADMIN_DELETE_PRODUCT', (ctx) => adminHandler.deleteProduct(ctx));

bot.action('ADMIN_EDIT_PRODUCT', async (ctx) => {
  ctx.session ||= {};
  ctx.session.awaitingEditProduct = true;

  await ctx.reply(
    '✏️ Kirim data produk yang ingin diedit:\n\n`id|nama|harga|stok|deskripsi|link1,link2`',
    { parse_mode: 'Markdown' }
  );
});

bot.action('ADMIN_LIST_ORDERS', (ctx) => adminHandler.listOrders(ctx));
bot.action('ADMIN_CONFIRM_PAYMENT', (ctx) => adminHandler.confirmPayment(ctx));

bot.action('ADMIN_SET_RESI', (ctx) => adminHandler.setResi(ctx));
bot.action('ADMIN_SET_STATUS', (ctx) => adminHandler.setStatus(ctx));

bot.action('ADMIN_SET_GREETING', (ctx) => adminHandler.setGreeting(ctx));
bot.action('ADMIN_SET_PAYMENT', (ctx) => adminHandler.setPaymentInfo(ctx));
bot.action('ADMIN_SET_HELP', (ctx) => adminHandler.setHelpText(ctx));

bot.action('ADMIN_UPLOAD_HELP_VIDEO', (ctx) => adminHandler.uploadHelpVideo(ctx));

/* =====================================================
   ✅ MENU LIST TOMBOL UTAMA
===================================================== */
bot.action('ADMIN_SET_BUTTONS', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("❌ Kamu bukan admin!");
  return adminHandler.showSetButtonsMenu(ctx);
});

/* =====================================================
   ✅ TOMBOL: Pilih Tombol Yang Mau Diedit
===================================================== */
bot.action(/^ADMIN_SET_BTN_/, (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("❌ Kamu bukan admin!");
  return adminHandler.handleSelectButtonToEdit(ctx);
});

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

bot.on('video', async (ctx) => {
  try {
    if (ctx.session?.awaitingHelpVideo) {
      return adminHandler.handleUploadHelpVideo(ctx);
    }
  } catch (err) {
    console.error('❌ Video upload error:', err);
  }
});

/* ===================================
   ✏️ TEXT INPUT HANDLER
=================================== */

bot.on('text', async (ctx) => {
  try {
    ctx.session ||= {};

    // SET HELP
    if (ctx.session.awaitingSetHelp) {
      return adminHandler.handleSetHelpText(ctx);
    }

    // SET GREETING
    if (ctx.session.awaitingSetGreeting) {
      return adminHandler.handleSetGreetingText(ctx);
    }

    // SET PAYMENT INFO
    if (ctx.session.awaitingSetPayment) {
      return adminHandler.handleSetPaymentInfo(ctx);
    }

    // SET BUTTON LABEL (sudah benar → ke FSM)
    if (ctx.session.awaitingSetButtonKey) {
      return fsmHandler.handleState(ctx);
    }

    // EDIT PRODUCT
    if (ctx.session.awaitingEditProduct) {
      return adminHandler.handleEditProduct(ctx);
    }

    // UPLOAD VIDEO BANTUAN
    if (ctx.session.awaitingHelpVideo) {
      return adminHandler.handleUploadHelpVideo(ctx);
    }

    // USER ORDER INPUT
    if (ctx.session.orderingProduct) {
      return userHandler.handleOrderInput(ctx);
    }

    // fallback → FSM utama
    await fsmHandler.handleState(ctx);

  } catch (err) {
    console.error("❌ FSM/text error:", err);
  }
});

/* ===================================
   ⚠️ GLOBAL ERROR HANDLER
=================================== */
bot.catch((err, ctx) => {
  console.error('❌ Unhandled bot error:', err);
});

module.exports = bot;
