const productService = require('../../services/productService');
const orderService = require('../../services/orderService');
const settingsService = require('../../services/settingsService');
const buttonService = require('../../services/buttonService');
const { Markup } = require('telegraf');

/* ======================================================
   CONSTANTS
====================================================== */

const BUTTONS = {
  BTN_ADMIN_ADD_PRODUCT: "➕ Tambah Produk",
  BTN_ADMIN_EDIT_PRODUCT: "✏️ Edit Produk",
  BTN_ADMIN_DELETE_PRODUCT: "❌ Hapus Produk",
  BTN_ADMIN_LIST_ORDERS: "📦 Daftar Order",
  BTN_ADMIN_CONFIRM_PAYMENT: "💳 Konfirmasi Pembayaran",
  BTN_ADMIN_SET_RESI: "🚚 Input Resi",
  BTN_ADMIN_SET_STATUS: "🔄 Ubah Status Order",
  BTN_ADMIN_SET_GREETING: "💬 Ubah Greeting",
  BTN_ADMIN_SET_PAYMENT: "💳 Ubah Rekening",
  BTN_ADMIN_SET_HELP: "❓ Ubah Text Bantuan",
  BTN_ADMIN_SET_CHAT_TEXT: "💬 Ubah Text Chat Admin",
  BTN_ADMIN_SET_VIDEO_TEXT: "🎥 Ubah Caption Video",
  BTN_ADMIN_UPLOAD_CHECKOUT_VIDEO: "🎬 Upload Video Checkout",
  BTN_ADMIN_SET_BUTTONS: "🔧 Ubah Nama Tombol"
};

buttonService.setDefaultButtons(BUTTONS);

/* ======================================================
   UTILITIES
====================================================== */

const ensureSession = (ctx) => {
  if (!ctx.session) ctx.session = {};
};

const resetSession = (ctx) => {
  ctx.session = {};
};

const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) },
    (_, i) => arr.slice(i * size, i * size + size));

const sanitizeId = (id = '') =>
  id.replace(/[^\p{L}\p{N}_-]/gu, '');

const parseKV = (text = '') => {
  const obj = {};
  text.split('\n').forEach(line => {
    const [k, ...v] = line.split(':');
    if (!k || !v.length) return;
    obj[k.trim().toLowerCase()] = v.join(':').trim();
  });
  return obj;
};

const getBtn = async (key) =>
  (await buttonService.getButtonLabel(key)) || BUTTONS[key];

/* ======================================================
   ADMIN PANEL
====================================================== */

async function showAdminMenu(ctx) {
  const keys = Object.keys(BUTTONS);

  const buttons = [];
  for (const key of keys) {
    buttons.push(
      Markup.button.callback(
        await getBtn(key),
        key.replace('BTN_', '')
      )
    );
  }

  await ctx.reply(
    "📋 *Panel Admin*",
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: chunk(buttons, 3) }
    }
  );
}

/* ======================================================
   GENERIC SETTING HANDLER (SCALABLE)
====================================================== */

function createSettingHandler(sessionKey, settingKey, successMsg) {
  return async (ctx) => {
    ensureSession(ctx);

    if (!ctx.session[sessionKey]) {
      ctx.session[sessionKey] = true;
      return ctx.reply("✏️ Kirim data baru:");
    }

    await settingsService.setSetting(settingKey, ctx.message.text.trim());
    resetSession(ctx);
    await ctx.reply(successMsg);
  };
}

/* ======================================================
   PRODUCT
====================================================== */

async function addProduct(ctx) {
  ensureSession(ctx);
  ctx.session.mode = "ADD_PRODUCT";
  await ctx.reply(
`Kirim format:

id:
nama:
harga:
stock:
deskripsi:
link1:
link2:
link3:`
  );
}

async function handleProductInput(ctx) {
  ensureSession(ctx);
  if (!ctx.session.mode) return;

  const data = parseKV(ctx.message.text);

  if (ctx.session.mode === "ADD_PRODUCT") {
    const product = {
      id: sanitizeId(data.id),
      name: data.nama,
      price: Number(data.harga || 0),
      stock: Number(data.stock || 0),
      description: data.deskripsi || '',
      links: [data.link1, data.link2, data.link3].filter(Boolean)
    };

    await productService.createProduct(product);
    resetSession(ctx);
    return ctx.reply("✅ Produk berhasil ditambahkan.");
  }
}

/* ======================================================
   EDIT PRODUCT
====================================================== */

async function showEditProductMenu(ctx) {
  const products = await productService.listProducts();
  if (!products.length) return ctx.reply("📭 Tidak ada produk.");

  for (const p of products) {
    await ctx.reply(
      `📦 *${p.id}*\n${p.name}\nRp${p.price}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            Markup.button.callback("✏️ Edit", `EDIT_${p.id}`),
            Markup.button.callback("🗑 Hapus", `DELETE_${p.id}`)
          ]]
        }
      }
    );
  }
}

/* ======================================================
   DELETE PRODUCT
====================================================== */

async function handleDeleteProduct(ctx) {
  const id = sanitizeId(ctx.callbackQuery.data.replace("DELETE_", ""));
  await productService.deleteProduct(id);
  await ctx.reply(`🗑 Produk ${id} dihapus.`);
}

/* ======================================================
   ORDER
====================================================== */

async function listOrders(ctx) {
  const orders = await orderService.listOrders();
  if (!orders.length) return ctx.reply("📭 Belum ada order.");

  let msg = "*Daftar Order*\n\n";
  orders.forEach(o => {
    msg += `• ${o.id} - ${o.status}\n`;
  });

  await ctx.replyWithMarkdown(msg);
}

/* ======================================================
   HELP SYSTEM
====================================================== */

async function uploadCheckoutVideo(ctx) {
  ensureSession(ctx);

  if (!ctx.session.awaitingVideo) {
    ctx.session.awaitingVideo = true;
    return ctx.reply("🎬 Kirim video sekarang.");
  }

  if (!ctx.message.video) return ctx.reply("❌ Kirim file video.");

  const data = {
    file_id: ctx.message.video.file_id,
    caption: ""
  };

  await settingsService.setSetting(
    "help_checkout_video",
    JSON.stringify(data)
  );

  resetSession(ctx);
  await ctx.reply("✅ Video berhasil disimpan.");
}

/* ======================================================
   EXPORT
====================================================== */

module.exports = {
  BUTTONS,
  showAdminMenu,
  addProduct,
  handleProductInput,
  showEditProductMenu,
  handleDeleteProduct,
  listOrders,
  uploadCheckoutVideo,

  setGreeting: createSettingHandler(
    "setGreeting",
    "greeting",
    "✅ Greeting diupdate."
  ),

  setPaymentInfo: createSettingHandler(
    "setPayment",
    "payment_info",
    "✅ Info pembayaran diupdate."
  ),

  setHelpText: createSettingHandler(
    "setHelp",
    "help",
    "✅ Text bantuan diupdate."
  )
};
