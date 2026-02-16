require("dotenv").config();

if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN belum diset di .env");
  process.exit(1);
}
const { Telegraf } = require("telegraf");

// PERBAIKAN 1: Gunakan path yang konsisten (plural) sesuai file yang kita buat sebelumnya
const admin = require("./handlers/adminHandlers");
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
  // Pastikan userHandler memiliki fungsi 'start'
  if (user && user.start) {
    await user.start(ctx, isAdmin);
  } else {
    console.error("userHandler.start tidak ditemukan!");
    await ctx.reply("Bot siap!");
  }
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
// HELP COMMAND (Gabungan)
// ========================================
bot.command("help", (ctx) => {
    // Gunakan fungsi dari admin handler
    return admin.showHelpMenu(ctx);
});

// ========================================
// CALLBACK QUERY ROUTER
// ========================================
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));

  // 👉 ROUTER USER
  if (user) {
    if (data === "VIEW_PRODUCTS") return user.viewProducts(ctx);
    if (data.startsWith("VIEW_DETAIL_")) return user.viewProductDetail(ctx);
    if (data.startsWith("OPEN_LINK_")) return user.openRandomLink(ctx);
    if (data.startsWith("BUY_PRODUCT_")) return user.buyProduct(ctx);
    if (data === "HELP_MENU") return admin.showHelpMenu(ctx); // Pakai admin.showHelpMenu
    if (data === "HELP_VIDEO_SHOW") return user.showHelpVideo(ctx);
  }

  // Jika bukan admin → stop
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

  // ===== PAYMENT
  if (data === "ADMIN_CONFIRM_PAYMENT") return admin.confirmPayment(ctx);
  if (data === "ADMIN_SET_RESI") return admin.setResi(ctx);
  if (data === "ADMIN_SET_STATUS") return admin.setStatus(ctx);

  // ===== SETTINGS
  if (data === "ADMIN_SET_GREETING") return admin.setGreeting(ctx);
  if (data === "ADMIN_SET_PAYMENT") return admin.setPaymentInfo(ctx);
  if (data === "ADMIN_SET_HELP") return admin.setHelpText(ctx);

  // ===== HELP VIDEO
  if (data === "ADMIN_UPLOAD_VIDEO") return admin.uploadHelpVideo(ctx);
  if (data === "ADMIN_DELETE_VIDEO") return admin.showDeleteHelpVideoMenu(ctx);
  if (data.startsWith("DEL_VIDEO_")) return admin.handleDeleteHelpVideo(ctx);
  // if (data === "DELETE_ALL_HELP_VIDEOS") return admin.deleteAllHelpVideos(ctx); // Hapus jika tidak ada fungsinya

  // ===== BUTTON LABELS
  if (data === "ADMIN_SET_BUTTONS") return admin.showSetButtonsMenu(ctx);
  if (data.startsWith("ADMIN_SET_BTN_")) return admin.handleSelectButtonToEdit(ctx);
  
  // ===== HELP CALLBACKS (Generic)
  // Tangani semua callback yang diawali HELP_
  if (data.startsWith("HELP_")) return admin.handleHelpChoice(ctx);

  // Fallback
  return ctx.answerCbQuery().catch(() => {});
});

// ========================================
// TEXT MESSAGE ROUTER
// ========================================
bot.on("text", async (ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));

  // ===== EXIT CHAT ADMIN =====
if (ctx.message.text === "/batal") {
  ctx.session.chatAdmin = false;
  return ctx.reply("❌ Chat admin ditutup.");
}
  // ===== USER CHAT ADMIN =====
  if (ctx.session.chatAdmin) {

  const now = Date.now();
  if (ctx.session.lastMsg && now - ctx.session.lastMsg < 1000) {
    return; // block spam < 1 detik
  }
  ctx.session.lastMsg = now;

  const ADMIN_ID = ADMIN_IDS[0];
  await ctx.telegram.forwardMessage(
    ADMIN_ID,
    ctx.chat.id,
    ctx.message.message_id
  );

  return ctx.reply("📨 Pesan dikirim ke admin");
}

  // ===== USER ORDER FLOW =====
  if (ctx.session.orderStep && user?.handleOrderInput) {
    return user.handleOrderInput(ctx);
  }

  // ===== STOP JIKA BUKAN ADMIN =====
  if (!isAdmin) return;

  // ===== ADMIN SESSION HANDLERS =====
  if (ctx.session.awaitingAddProduct)
    return admin.handleAddProduct(ctx);

  if (ctx.session.awaitingEditProduct)
    return admin.handleEditProduct(ctx);

  if (ctx.session.awaitingConfirmOrder)
    return admin.handleConfirmPayment(ctx);

  if (ctx.session.awaitingSetGreeting)
    return admin.handleSetGreetingText(ctx);

  if (ctx.session.awaitingSetPayment)
    return admin.handleSetPaymentInfo(ctx);

  if (ctx.session.awaitingSetHelp)
    return admin.handleSetHelpText(ctx);

  if (ctx.session.awaitingVideoCategory)
    return admin.handleVideoCategory(ctx);


  if (ctx.session.awaitingVideoUpload)
    return admin.handleUploadHelpVideo(ctx);

  if (ctx.session.awaitingSetButtonKey)
    return admin.handleSetButtonLabel(ctx);
});

// ========================================
// VIDEO MESSAGE ROUTER
// ========================================
bot.on("video", async (ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));
  if (!isAdmin) return;

  if (ctx.session.awaitingVideoUpload) return admin.handleUploadHelpVideo(ctx);
});

// ========================================
// START BOT (WAJIB)
// ========================================

// Handle stop signal (untuk docker/cloud)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// ===== ADMIN REPLY TO USER =====
bot.on("message", async (ctx, next) => {
  if (ctx.updateType !== "message") return next();
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));
  if (!isAdmin) return;
  if (!ctx.message.reply_to_message) return;
  if (!ctx.message.reply_to_message.forward_from) return;

  const userId = ctx.message.reply_to_message.forward_from.id;

  await ctx.telegram.copyMessage(
  userId,
  ctx.chat.id,
  ctx.message.message_id
);
});

module.exports = bot;

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
