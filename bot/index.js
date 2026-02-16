require("dotenv").config();

if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN belum diset di .env");
  process.exit(1);
}

const { Telegraf } = require("telegraf");
const admin = require("./handlers/adminHandlers");
const user = require("./handlers/userHandler");
const settingsService = require("./services/settingsService");

const bot = new Telegraf(process.env.BOT_TOKEN);

// ========================================
// ADMIN LIST
// ========================================
const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

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
  if (!isAdmin)
    return ctx.reply("❌ Anda bukan admin.");

  return admin.showAdminMenu(ctx);
});

// ========================================
// /help
// ========================================
bot.command("help", (ctx) => user.helpMenu(ctx));

// ========================================
// CALLBACK ROUTER
// ========================================
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));

  // =============================
  // ===== USER ROUTER ===========
  // =============================
  if (data === "VIEW_PRODUCTS") return user.viewProducts(ctx);
  if (data.startsWith("VIEW_DETAIL_")) return user.viewProductDetail(ctx);
  if (data.startsWith("OPEN_LINK_")) return user.openRandomLink(ctx);
  if (data.startsWith("BUY_PRODUCT_")) return user.buyProduct(ctx);

  if (data === "HELP_MENU") return user.helpMenu(ctx);

  if (data === "HELP_VIDEO_CHECKOUT")
    return user.showCheckoutVideo(ctx);

  if (data === "HELP_CHAT_ADMIN") {
    ctx.session.chatAdmin = true;

    const chatText =
      (await settingsService.getSetting("help_chat_text")) ||
      "Silakan kirim pesan ke admin. Ketik /batal untuk keluar.";

    return ctx.reply(chatText);
  }

  // Jika bukan admin, stop di sini
  if (!isAdmin)
    return ctx.answerCbQuery("❌ Anda bukan admin.", { show_alert: true });

  // =============================
  // ===== ADMIN ROUTER ==========
  // =============================
  if (data === "ADMIN_PANEL") return admin.showAdminMenu(ctx);

  // --- HELP SETTINGS
  if (data === "ADMIN_SET_HELP_INTRO") return admin.setHelpIntro(ctx);
  if (data === "ADMIN_SET_CHAT_TEXT") return admin.setChatAdminText(ctx);
  if (data === "ADMIN_SET_VIDEO_CAPTION") return admin.setCheckoutVideoCaption(ctx);
  if (data === "ADMIN_UPLOAD_CHECKOUT_VIDEO") return admin.uploadCheckoutVideo(ctx);

  // --- PRODUCTS
  if (data === "ADMIN_ADD_PRODUCT") return admin.addProduct(ctx);
  if (data === "ADMIN_EDIT_PRODUCT") return admin.showEditProductMenu(ctx);
  if (data.startsWith("EDIT_PROD_")) return admin.handleSelectProductToEdit(ctx);
  if (data === "ADMIN_DELETE_PRODUCT") return admin.showDeleteProductMenu(ctx);
  if (data.startsWith("DEL_PROD_")) return admin.handleSelectDeleteProduct(ctx);
  if (data.startsWith("CONFIRM_DEL_")) return admin.handleConfirmDeleteProduct(ctx);
  if (data.startsWith("CANCEL_DEL_")) return admin.handleCancelDeleteProduct(ctx);

  // --- ORDERS
  if (data === "ADMIN_LIST_ORDERS") return admin.listOrders(ctx);

  // --- PAYMENT
  if (data === "ADMIN_CONFIRM_PAYMENT") return admin.confirmPayment(ctx);
  if (data === "ADMIN_SET_RESI") return admin.setResi(ctx);
  if (data === "ADMIN_SET_STATUS") return admin.setStatus(ctx);

  // --- SETTINGS
  if (data === "ADMIN_SET_GREETING") return admin.setGreeting(ctx);
  if (data === "ADMIN_SET_PAYMENT") return admin.setPaymentInfo(ctx);

  // --- BUTTON LABELS
  if (data === "ADMIN_SET_BUTTONS") return admin.showSetButtonsMenu(ctx);
  if (data.startsWith("ADMIN_SET_BTN_")) return admin.handleSelectButtonToEdit(ctx);

  return ctx.answerCbQuery().catch(() => {});
});

// ========================================
// TEXT ROUTER
// ========================================
bot.on("text", async (ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));

  // ===== EXIT CHAT ADMIN
  if (ctx.message.text === "/batal") {
    ctx.session.chatAdmin = false;
    return ctx.reply("❌ Chat admin ditutup.");
  }

  // ===== USER CHAT ADMIN
  if (ctx.session.chatAdmin) {
    const ADMIN_ID = ADMIN_IDS[0];

    await ctx.telegram.forwardMessage(
      ADMIN_ID,
      ctx.chat.id,
      ctx.message.message_id
    );

    return ctx.reply("📨 Pesan dikirim ke admin.");
  }

  // ===== USER ORDER FLOW
  if (ctx.session.orderStep)
    return user.handleOrderInput(ctx);

  // STOP jika bukan admin
  if (!isAdmin) return;

  // ===== ADMIN SESSION HANDLERS
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

  if (ctx.session.awaitingHelpIntro)
    return admin.handleSetHelpIntro(ctx);

  if (ctx.session.awaitingChatText)
    return admin.handleSetChatAdminText(ctx);

  if (ctx.session.awaitingVideoCaption)
    return admin.handleSetCheckoutVideoCaption(ctx);
});

// ========================================
// VIDEO ROUTER (ADMIN)
// ========================================
bot.on("video", async (ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));
  if (!isAdmin) return;

  if (ctx.session.awaitingCheckoutVideo)
    return admin.handleUploadCheckoutVideo(ctx);
});

// ========================================
// ADMIN REPLY TO USER
// ========================================
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

// ========================================
// START BOT
// ========================================
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

module.exports = bot;
