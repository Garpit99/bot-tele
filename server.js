require("dotenv").config();
const express = require("express");
const { Telegraf, Markup } = require("telegraf");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

const PORT = process.env.PORT || 3000;

const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map(x => x.trim());

// ===== SESSION SIMPLE =====
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

  return ctx.reply("Halo 👋", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📦 Lihat Produk", callback_data: "VIEW_PRODUCTS" }],
        isAdmin
          ? [{ text: "⚙️ Admin Panel", callback_data: "ADMIN_PANEL" }]
          : []
      ]
    }
  });
});

// ===== CALLBACK =====
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));

  await ctx.answerCbQuery().catch(() => {});

  console.log("CALLBACK:", data);

  // ===== USER =====
  if (data === "VIEW_PRODUCTS") {
    return ctx.reply("📦 Produk tersedia:\n\n1. Produk A\n2. Produk B");
  }

  // ===== ADMIN CHECK =====
  if (data.startsWith("ADMIN") && !isAdmin) {
    return ctx.reply("❌ Kamu bukan admin");
  }

  // ===== ADMIN =====
  if (data === "ADMIN_PANEL") {
    return ctx.reply("📋 Panel Admin", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Tambah Produk", callback_data: "ADD_PRODUCT" }]
        ]
      }
    });
  }

  if (data === "ADD_PRODUCT") {
    ctx.session.awaitingProduct = true;
    return ctx.reply("Ketik nama produk:");
  }
});

// ===== TEXT =====
bot.on("text", async (ctx) => {
  const isAdmin = ADMIN_IDS.includes(String(ctx.from.id));

  if (ctx.session.awaitingProduct && isAdmin) {
    ctx.session.awaitingProduct = false;
    return ctx.reply("✅ Produk berhasil ditambahkan:\n" + ctx.message.text);
  }
});

// ===== ERROR HANDLER =====
bot.catch((err) => console.error("BOT ERROR:", err));

// ===== EXPRESS =====
app.get("/", (req, res) => res.send("✅ Bot Alive"));

bot.launch().then(() => {
  console.log("🤖 Bot running...");
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
