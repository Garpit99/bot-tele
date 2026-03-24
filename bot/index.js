require("dotenv").config();

const { Telegraf } = require("telegraf");

// ✅ FIX PATH (WAJIB)
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
bot.on("callback_query", async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));

    // WAJIB: biar tombol gak loading
    await ctx.answerCbQuery().catch(() => {});

    console.log("CALLBACK:", data);
    console.log("USER ID:", ctx.from.id);

    // ===== USER =====
    if (data === "VIEW_PRODUCTS") return user.viewProducts(ctx);
    if (data.startsWith("VIEW_DETAIL_")) return user.viewProductDetail(ctx);
    if (data.startsWith("OPEN_LINK_")) return user.openRandomLink(ctx);
    if (data.startsWith("BUY_PRODUCT_")) return user.buyProduct(ctx);

    if (data === "HELP_VIDEO_CHECKOUT") return user.showCheckoutVideo(ctx);

    if (data === "HELP_CHAT_ADMIN") {
      ctx.session.chatAdmin = true;
      return ctx.reply("Kirim pesan ke admin. /batal untuk keluar");
    }

    // ===== BLOCK NON ADMIN =====
    if (!isAdmin) {
      return ctx.answerCbQuery("❌ Bukan admin", { show_alert: true });
    }

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

    if (data === "ADMIN_UPLOAD_CHECKOUT_VIDEO")
      return admin.uploadCheckoutVideo(ctx);

    if (data === "ADMIN_DELETE_CHECKOUT_VIDEO")
      return admin.deleteCheckoutVideo(ctx);

    if (data === "CONFIRM_DELETE_VIDEO")
      return admin.handleConfirmDeleteVideo(ctx);

    if (data === "CANCEL_DELETE_VIDEO")
      return admin.handleCancelDeleteVideo(ctx);

  } catch (err) {
    console.error("❌ CALLBACK ERROR:", err);
    return ctx.answerCbQuery("❌ Error", { show_alert: true });
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
});

// ===== VIDEO ADMIN =====
bot.on("video", (ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));
  if (!isAdmin) return;

  if (ctx.session.awaitingCheckoutVideo)
    return admin.handleUploadCheckoutVideo(ctx);
});

// ===== ERROR =====
bot.catch((err) => console.error("BOT ERROR:", err));

module.exports = bot;
