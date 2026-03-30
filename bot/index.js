require("dotenv").config();

const { Telegraf } = require("telegraf");
const admin = require("./handlers/adminHandlers");
const user = require("./handlers/userHandler");
const settingsService = require("../services/settingsService");

if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN belum diset di .env");
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// ===== ADMIN =====
const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((x) => x.trim());

// ===== SESSION =====
const session = {};
bot.use((ctx, next) => {
  const id = ctx.chat?.id;
  if (!session[id]) session[id] = {};
  ctx.session = session[id];
  return next();
});

// ===== START =====
bot.start((ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));
  return user.start(ctx, isAdmin);
});

// ===== ADMIN MENU =====
bot.command("admin", (ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));
  if (!isAdmin) return ctx.reply("❌ Bukan admin");
  return admin.showAdminMenu(ctx);
});

// ===== HELP =====
bot.command("help", (ctx) => user.helpMenu(ctx));

// ===== CALLBACK =====
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (process.env.DEBUG === "true") {
  console.log("CALLBACK:", data);
}
  await ctx.answerCbQuery(); // ✅ WAJIB
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));
  


  // ===== USER =====
  if (data === "VIEW_PRODUCTS") return user.viewProducts(ctx);
  if (data.startsWith("VIEW_DETAIL_")) return user.viewProductDetail(ctx);
  if (data.startsWith("OPEN_LINK_")) return user.openRandomLink(ctx);
  if (data.startsWith("BUY_PRODUCT_")) return user.buyProduct(ctx);
  if (data === "OPEN_HELP_MENU" || data === "HELP_MENU") {
  return user.helpMenu(ctx);
}
  if (data === "HELP_VIDEO_CHECKOUT") {
  console.log("MASUK VIDEO");
  return user.showCheckoutVideo(ctx);
}

  if (data === "HELP_CHAT_ADMIN") {
  ctx.session.chatAdmin = true;
  return ctx.reply("💬 Kirim pesan ke admin.\nKetik /batal untuk keluar");
  }

  // ===== STOP NON ADMIN =====
  if (!isAdmin)
    return ctx.answerCbQuery("❌ Bukan admin", { show_alert: true });

  // ===== ADMIN =====
  if (data === "ADMIN_PANEL") return admin.showAdminMenu(ctx);
  if (data === "ADMIN_ADD_PRODUCT") return admin.addProduct(ctx);
  if (data === "ADMIN_EDIT_PRODUCT") return admin.showEditProductMenu(ctx);
  if (data.startsWith("EDIT_PROD_")) return admin.handleSelectProductToEdit(ctx);
  if (data === "ADMIN_DELETE_PRODUCT") return admin.showDeleteProductMenu(ctx);
  if (data.startsWith("CONFIRM_DEL_")) return admin.handleConfirmDeleteProduct(ctx);

  if (data === "ADMIN_LIST_ORDERS") return admin.listOrders(ctx);
  if (data === "ADMIN_CONFIRM_PAYMENT") return admin.confirmPayment(ctx);

  if (data === "ADMIN_SET_GREETING") return admin.setGreeting(ctx);
  if (data === "ADMIN_SET_CHAT_TEXT") return admin.setChatAdminText(ctx);
  if (data === "ADMIN_SET_HELP_INTRO") return admin.setHelpIntro(ctx);

 // ===== VIDEO ADMIN =====
if (data === "ADMIN_UPLOAD_VIDEO") {
  ctx.session.awaitingUploadVideo = true;
  return ctx.reply("🎥 Kirim video sekarang...");
}

if (data === "ADMIN_DELETE_VIDEO") {
  return admin.showDeleteVideoMenu(ctx);
}

if (data.startsWith("DEL_VIDEO_")) {
  return admin.handleSelectDeleteVideo(ctx);
}

if (data.startsWith("CONFIRM_DEL_VIDEO_")) {
  return admin.handleConfirmDeleteVideo(ctx);
}

if (data === "CANCEL_DEL_VIDEO") {
  return admin.handleCancelDeleteVideo(ctx);
}
});

// ===== TEXT =====
bot.on("text", async (ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));

  if (ctx.message.text === "/batal") {
    ctx.session.chatAdmin = false;
    return ctx.reply("❌ Dibatalkan");
  }

  if (ctx.session.chatAdmin) {
    const adminId = ADMIN_IDS[0];
    await ctx.telegram.forwardMessage(adminId, ctx.chat.id, ctx.message.message_id);
    return ctx.reply("📨 Terkirim");
  }

  if (ctx.session.orderStep)
    return user.handleOrderInput(ctx);

  if (!isAdmin) return;

  if (ctx.session.awaitingAddProduct)
    return admin.handleAddProduct(ctx);

  if (ctx.session.awaitingEditProduct)
    return admin.handleEditProduct(ctx);

  if (ctx.session.awaitingConfirmOrder)
    return admin.handleConfirmPayment(ctx);

  if (ctx.session.awaitingSetGreeting)
    return admin.handleSetGreetingText(ctx);

  if (ctx.session.awaitingChatText)
    return admin.handleSetChatAdminText(ctx);

  if (ctx.session.awaitingHelpIntro)
    return admin.handleSetHelpIntro(ctx);
  
});

// ===== VIDEO ADMIN =====
bot.on("video", (ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));
  if (!isAdmin) return;

  if (ctx.session.awaitingUploadVideo)
  return admin.uploadHelpVideo(ctx);
});

// ===== ERROR HANDLER =====
bot.catch((err) => console.error("BOT ERROR:", err));

module.exports = bot;
