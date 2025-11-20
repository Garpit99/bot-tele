require("dotenv").config();
const { Telegraf } = require("telegraf");
const admin = require("./handlers/adminHandler");
const user = require("./handlers/userHandler");

const bot = new Telegraf(process.env.BOT_TOKEN);

// ========================================
// ADMIN LIST
// ========================================
const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((x) => x.trim());

// ========================================
// SESSION MIDDLEWARE
// ========================================
const session = {};
bot.use((ctx, next) => {
  const chatId = ctx.chat?.id;
  if (!session[chatId]) session[chatId] = {};
  ctx.session = session[chatId];
  return next();
});

// ========================================
// /START
// ========================================
bot.start(async (ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));
  await user.start(ctx, isAdmin);
});

// ========================================
// /admin
// ========================================
bot.command("admin", (ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));

  if (!isAdmin) {
    return ctx.reply("❌ Anda bukan admin. Akses ditolak.");
  }

  return admin.showAdminMenu(ctx);
});

// ========================================
// CALLBACK QUERY ROUTER
// ========================================
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));

  // 👉 ROUTER USER (boleh dulu dicek / dilayani)
  if (data === "VIEW_PRODUCTS") return user.viewProducts(ctx);
  if (data.startsWith("VIEW_DETAIL_")) return user.viewProductDetail(ctx);
  if (data.startsWith("OPEN_LINK_")) return user.openRandomLink(ctx);
  if (data.startsWith("BUY_PRODUCT_")) return user.buyProduct(ctx);
  if (data === "HELP_MENU") return user.helpMenu(ctx);
  if (data === "HELP_VIDEO_SHOW") return user.showHelpVideo(ctx);

  // Jika bukan admin → stop di sini
  if (!isAdmin) {
    return ctx.answerCbQuery("❌ Anda bukan admin.", { show_alert: true });
  }

  // 👉 ROUTER ADMIN
  if (data === "ADMIN_PANEL") return admin.showAdminMenu(ctx);

  // ===== PRODUCTS
  if (data === "ADMIN_ADD_PRODUCT") return admin.addProduct(ctx);
  if (data === "ADMIN_EDIT_PRODUCT") return admin.showEditProductMenu(ctx);
  if (data.startsWith("EDIT_PROD_")) return admin.handleSelectProductToEdit(ctx);
  if (data === "ADMIN_DELETE_PRODUCT") return admin.showDeleteProductMenu(ctx);
  if (data.startsWith("DEL_PROD_")) return admin.handleSelectDeleteProduct(ctx);
  if (data.startsWith("CONFIRM_DEL_")) return admin.handleConfirmDeleteProduct(ctx);
  if (data.startsWith("CANCEL_DEL_")) return admin.handleCancelDeleteProduct(ctx);

  // ===== ORDERS
  if (data === "ADMIN_LIST_ORDERS") return admin.listOrders(ctx);

  // ===== PAYMENT CONFIRM
  if (data === "ADMIN_CONFIRM_PAYMENT") return admin.confirmPayment(ctx);

  // ===== SHIPPING
  if (data === "ADMIN_SET_RESI") return admin.setResi(ctx);
  if (data === "ADMIN_SET_STATUS") return admin.setStatus(ctx);

  // ===== SETTINGS
  if (data === "ADMIN_SET_GREETING") return admin.setGreeting(ctx);
  if (data === "ADMIN_SET_PAYMENT") return admin.setPaymentInfo(ctx);
  if (data === "ADMIN_SET_HELP") return admin.setHelpText(ctx);

  // ===== LEGACY HELP VIDEO
  if (data === "ADMIN_UPLOAD_VIDEO") return admin.uploadHelpVideo(ctx);
  if (data === "ADMIN_DELETE_VIDEO") return admin.showDeleteHelpVideoMenu(ctx);
  if (data.startsWith("DEL_HELP_VIDEO_")) return admin.handleDeleteHelpVideo(ctx);

  // ===== BUTTON LABELS
  if (data === "ADMIN_SET_BUTTONS") return admin.showSetButtonsMenu(ctx);
  if (data.startsWith("ADMIN_SET_BTN_")) return admin.handleSelectButtonToEdit(ctx);

  return admin.noop(ctx);
});

// ========================================
// TEXT MESSAGE ROUTER
// ========================================
bot.on("text", async (ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));

  // 👉 USER ORDER
  if (ctx.session.orderStep) return user.handleOrderInput(ctx);

  // 👉 ADMIN ONLY BELOW
  if (!isAdmin) return;

  // PRODUCT
  if (ctx.session.awaitingAddProduct) return admin.handleAddProduct(ctx);
  if (ctx.session.awaitingEditProduct) return admin.handleEditProduct(ctx);

  // PAYMENT
  if (ctx.session.awaitingConfirmOrder) return admin.handleConfirmPayment(ctx);

  // SETTINGS
  if (ctx.session.awaitingSetGreeting) return admin.handleSetGreetingText(ctx);
  if (ctx.session.awaitingSetPayment) return admin.handleSetPaymentInfo(ctx);
  if (ctx.session.awaitingSetHelp) return admin.handleSetHelpText(ctx);

  // HELP VIDEO
  if (ctx.session.awaitingHelpVideo) return admin.handleUploadHelpVideo(ctx);

  // HELP CATEGORY
  if (ctx.session.awaitingNewHelpCategory) return admin.saveNewHelpCategory(ctx);
  if (ctx.session.awaitingHelpCategoryName) return admin.handleAddHelpCategoryName(ctx);
  if (ctx.session.awaitingEditCategoryName) return admin.handleEditHelpCategoryName(ctx);
  if (ctx.session.awaitingUploadHelpVideoToCategory)
    return admin.handleUploadVideoToCategory_message(ctx);

  // LEGACY
  if (ctx.session.awaitingCategoryVideo)
    return admin.handleUploadHelpDescription(ctx);

  // BUTTON LABEL EDIT
  if (ctx.session.awaitingSetButtonKey)
    return admin.handleSetButtonLabel(ctx);
});

// ========================================
// VIDEO MESSAGE ROUTER
// ========================================
bot.on("video", async (ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));

  // USER tidak punya handler video → skip
  if (!isAdmin) return;

  if (ctx.session.awaitingHelpVideo)
    return admin.handleUploadHelpVideo(ctx);

  if (ctx.session.awaitingUploadHelpVideoToCategory)
    return admin.handleUploadVideoToCategory_message(ctx);
});

module.exports = bot;
