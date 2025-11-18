// adminHandler.js
const productService = require('../../services/productService');
const orderService = require('../../services/orderService');
const settingsService = require('../../services/settingsService');
const buttonService = require('../../services/buttonService');
const { Markup } = require('telegraf');

/* ===========================================
   HELPERS
=========================================== */
function chunkArray(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

function parseKeyValueText(text) {
  const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(l => l);
  const obj = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    obj[key] = val;
  }
  return obj;
}

// sanitize id: keep Unicode letters, numbers, underscore, hyphen
function sanitizeId(raw) {
  if (!raw) return '';
  // remove known prefixes like EDIT_PROD_, DEL_PROD_, CONFIRM_DEL_, etc.
  raw = raw.replace(/^(EDIT_PROD_|DEL_PROD_|CONFIRM_DEL_|CANCEL_DEL_|EDIT_NAME_|EDIT_PRICE_|EDIT_LINKS_)/i, '');
  raw = raw.trim();
  // keep letters, numbers, underscore, hyphen
  return raw.replace(/[^\p{L}\p{N}_-]+/gu, '');
}

/* ===========================
   BUTTON DEFAULT CONSTANTS
=========================== */
const BUTTONS = {
  BTN_VIEW_PRODUCTS: "🛍️ Lihat Produk",
  BTN_OPEN_LINK: "🌐 Buka Link Acak",
  BTN_BACK: "⬅️ Kembali",
  BTN_BUY: "🛒 Beli Produk Ini",

  // ADMIN
  BTN_ADMIN_ADD_PRODUCT: "➕ Tambah Produk",
  BTN_ADMIN_EDIT_PRODUCT: "✏️ Edit Produk",
  BTN_ADMIN_DELETE_PRODUCT: "❌ Hapus Produk",
  BTN_ADMIN_LIST_ORDERS: "📦 Daftar Order",
  BTN_ADMIN_CONFIRM_PAYMENT: "💳 Konfirmasi Pembayaran",
  BTN_ADMIN_SET_RESI: "🚚 Input Resi",
  BTN_ADMIN_SET_STATUS: "🔄 Ubah Status Order",
  BTN_ADMIN_SET_GREETING: "💬 Ubah Greeting",
  BTN_ADMIN_SET_PAYMENT: "💳 Ubah Rekening Pembayaran",
  BTN_ADMIN_SET_HELP: "❓ Ubah Text Bantuan",
  BTN_ADMIN_UPLOAD_VIDEO: "🎥 Upload Video Bantuan",
  BTN_ADMIN_SET_BUTTONS: "🔧 Ubah Nama Tombol"
};

// Register default to storage (best-effort)
try {
  buttonService.setDefaultButtons(BUTTONS);
} catch (e) {
  console.error('buttonService.setDefaultButtons failed:', e);
}

async function getBtn(key) {
  try {
    return (await buttonService.getButtonLabel(key)) || BUTTONS[key];
  } catch (e) {
    console.error('getBtn error', e);
    return BUTTONS[key];
  }
}

/* ===========================
      ADMIN MAIN MENU
=========================== */
async function showAdminMenu(ctx) {
  try {
    const keys = [
      "BTN_ADMIN_ADD_PRODUCT",
      "BTN_ADMIN_EDIT_PRODUCT",
      "BTN_ADMIN_DELETE_PRODUCT",
      "BTN_ADMIN_LIST_ORDERS",
      "BTN_ADMIN_CONFIRM_PAYMENT",
      "BTN_ADMIN_SET_RESI",
      "BTN_ADMIN_SET_STATUS",
      "BTN_ADMIN_SET_GREETING",
      "BTN_ADMIN_SET_PAYMENT",
      "BTN_ADMIN_SET_HELP",
      "BTN_ADMIN_UPLOAD_VIDEO",
      "BTN_ADMIN_SET_BUTTONS"
    ];

    const buttonList = [];

    for (const key of keys) {
      buttonList.push(
        Markup.button.callback(
          await getBtn(key),
          key.replace("BTN_", "") // e.g. BTN_ADMIN_ADD_PRODUCT -> ADMIN_ADD_PRODUCT
        )
      );
    }

    const keyboard = chunkArray(buttonList, 3); // 3 columns

    await ctx.reply("📋 *Panel Admin* — pilih aksi:", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (err) {
    console.error('showAdminMenu error', err);
    await ctx.reply("❌ Terjadi kesalahan membuka panel admin.");
  }
}

/* ===========================
  MENU EDIT BUTTON LABEL (GRID 2)
=========================== */
async function showSetButtonsMenu(ctx) {
  try {
    const btnKeys = Object.keys(BUTTONS);
    const btns = [];

    for (const key of btnKeys) {
      btns.push(
        Markup.button.callback(
          await getBtn(key),
          `ADMIN_SET_BTN_${key}`
        )
      );
    }

    const keyboard = chunkArray(btns, 2);
    keyboard.push([ Markup.button.callback("⬅️ Kembali", "ADMIN_PANEL") ]);

    await ctx.reply("🔧 Pilih tombol yang ingin diubah:", {
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (e) {
    console.error("showSetButtonsMenu error:", e);
    await ctx.reply("❌ Gagal membuka menu ubah tombol.");
  }
}

async function handleSelectButtonToEdit(ctx) {
  await ctx.answerCbQuery().catch(() => {});

  const key = ctx.callbackQuery.data.replace("ADMIN_SET_BTN_", "");
  ctx.session ||= {};
  ctx.session.awaitingSetButtonKey = key;

  const current = await getBtn(key);

  await ctx.reply(
    `✏️ Kirim nama baru untuk tombol *${key}*\n\n📄 Saat ini: ${current}`,
    { parse_mode: "Markdown" }
  );
}

async function handleSetButtonLabel(ctx) {
  ctx.session ||= {};
  const key = ctx.session.awaitingSetButtonKey;
  if (!key) return;

  const newLabel = ctx.message.text.trim();
  await buttonService.setButtonLabel(key, newLabel);

  await ctx.reply(`✅ Nama tombol *${key}* berhasil diubah menjadi:\n${newLabel}`, { parse_mode: 'Markdown' });

  ctx.session.awaitingSetButtonKey = null;
}

/* ===========================
   ADD PRODUCT
=========================== */
async function addProduct(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingAddProduct = true;

  await ctx.reply(
    '🧾 Kirim data produk (baris per baris):\n\n' +
    '```\n' +
    'id:\nnama:\nharga:\nstock:\ndeskripsi:\nlink1:\nlink2:\nlink3:\n' +
    '```\nContoh:\n`id: PRD001`',
    { parse_mode: 'Markdown' }
  );
}

async function handleAddProduct(ctx) {
  ctx.session ||= {};
  if (!ctx.session.awaitingAddProduct) return;

  try {
    const text = ctx.message.text || '';
    const obj = parseKeyValueText(text);

    if (!obj.id || !obj.nama || !obj.harga || !obj.stock) {
      return ctx.reply('❌ Format salah. Pastikan minimal ada:\n`id, nama, harga, stock`', { parse_mode: 'Markdown' });
    }

    const product = {
      id: obj.id.trim(),
      name: obj.nama.trim(),
      price: Number(String(obj.harga).replace(/[^0-9.-]/g, '')) || 0,
      stock: Number(String(obj.stock).replace(/[^0-9.-]/g, '')) || 0,
      description: obj.deskripsi || '',
      links: []
    };

    ['link1','link2','link3'].forEach(k => { if (obj[k]) product.links.push(obj[k]); });

    let created;
    try {
      created = await productService.createProduct(product);
    } catch (err) {
      console.error('createProduct error', err);
      return ctx.reply(`❌ Error productService:\n${err.message}`);
    }

    if (!created) {
      return ctx.reply('❌ Produk gagal dibuat. Mungkin ID sudah ada atau service error.');
    }

    await ctx.reply(`✅ Produk *${product.id}* berhasil ditambahkan.`, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('handleAddProduct error', err);
    await ctx.reply('❌ Terjadi error saat menambahkan produk.');
  } finally {
    ctx.session.awaitingAddProduct = false;
  }
}

/* ===========================
   SHOW EDIT PRODUCT MENU
   - daftar semua produk dengan tombol Edit / Delete
=========================== */
async function showEditProductMenu(ctx) {
  try {
    const products = await productService.listProducts();
    if (!products || products.length === 0) {
      return ctx.reply("📭 Tidak ada produk.");
    }

    for (const p of products) {
      const links = Array.isArray(p.links) ? p.links : (p.links ? [p.links] : []);
      const msg =
        `📦 *${p.id}*\n` +
        `Nama: ${p.name || '-'}\n` +
        `Harga: Rp${Number(p.price || 0).toLocaleString('id-ID')}\n` +
        `Stok: ${p.stock ?? '-'}\n` +
        (p.description ? `Deskripsi: ${p.description}\n` : '') +
        (links.length ? `Links: ${links.join(' | ')}\n` : '');

      const keyboard = [
        [
          Markup.button.callback("✏️ Edit", `EDIT_PROD_${p.id}`),
          Markup.button.callback("🗑 Hapus", `DEL_PROD_${p.id}`)
        ]
      ];

      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
    }
  } catch (e) {
    console.error('showEditProductMenu error', e);
    await ctx.reply('❌ Gagal memuat daftar produk.');
  }
}

/* ===========================
   HANDLE CALLBACK: SELECT PRODUCT TO EDIT
=========================== */
async function handleSelectProductToEdit(ctx) {
  await ctx.answerCbQuery().catch(() => {});

  // sanitize incoming id
  const raw = ctx.callbackQuery.data || '';
  const id = sanitizeId(raw);

  ctx.session ||= {};
  ctx.session.awaitingEditProduct = id;

  try {
    const p = await productService.getProductById(id);
    if (!p) return ctx.reply("❌ Produk tidak ditemukan.");

    const links = Array.isArray(p.links) ? p.links : [];

    const sample =
      'id: ' + (p.id || '') + '\n' +
      'nama: ' + (p.name || '') + '\n' +
      'harga: ' + (p.price ?? '') + '\n' +
      'stock: ' + (p.stock ?? '') + '\n' +
      'deskripsi: ' + (p.description || '') + '\n' +
      (links[0] ? 'link1: ' + links[0] + '\n' : '') +
      (links[1] ? 'link2: ' + links[1] + '\n' : '') +
      (links[2] ? 'link3: ' + links[2] + '\n' : '');

    await ctx.reply(
      `✏️ Edit produk *${id}*\n\nKirim data baru dengan format:\n\`\`\`\n${sample}\`\`\`\n(Anda boleh mengubah sebagian field saja)`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('handleSelectProductToEdit error', e);
    ctx.session.awaitingEditProduct = null;
    await ctx.reply('❌ Gagal memuat data produk.');
  }
}

/* ===========================
   HANDLE EDIT PRODUCT (APPLY UPDATE)
=========================== */
async function handleEditProduct(ctx) {
  ctx.session ||= {};
  const id = ctx.session.awaitingEditProduct;
  if (!id) return;

  try {
    const text = ctx.message.text || '';
    const obj = parseKeyValueText(text);

    const payload = {};
    if (obj.nama) payload.name = obj.nama;
    if (obj.harga) payload.price = Number(String(obj.harga).replace(/[^0-9.-]/g, '')) || 0;
    if (obj.stock) payload.stock = Number(String(obj.stock).replace(/[^0-9.-]/g, '')) || 0;
    if (obj.deskripsi) payload.description = obj.deskripsi;

    const links = [];
    if (obj.link1) links.push(obj.link1);
    if (obj.link2) links.push(obj.link2);
    if (obj.link3) links.push(obj.link3);
    if (links.length) payload.links = links;

    const updated = await productService.updateProduct(id, payload);

    if (!updated) {
      await ctx.reply('❌ Produk tidak ditemukan atau gagal diperbarui.');
    } else {
      await ctx.reply(`✅ Produk *${id}* berhasil diperbarui.`, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error('handleEditProduct error', err);
    await ctx.reply('❌ Gagal memproses edit produk. Pastikan format benar.');
  } finally {
    ctx.session.awaitingEditProduct = null;
  }
}

/* ===========================
   SHOW DELETE PRODUCT MENU
=========================== */
async function showDeleteProductMenu(ctx) {
  try {
    const products = await productService.listProducts();
    if (!products || !products.length) {
      return ctx.reply("📭 Tidak ada produk.");
    }

    for (const p of products) {
      const msg =
        `📦 *${p.id}*\n` +
        `Nama: ${p.name || '-'}\n` +
        `Harga: Rp${Number(p.price || 0).toLocaleString('id-ID')}\n` +
        `Stok: ${p.stock ?? '-'}\n`;

      const keyboard = [
        [
          Markup.button.callback("🗑 Hapus", `DEL_PROD_${p.id}`),
          Markup.button.callback("✏️ Edit", `EDIT_PROD_${p.id}`)
        ]
      ];

      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
    }
  } catch (err) {
    console.error('showDeleteProductMenu error', err);
    await ctx.reply('❌ Gagal memuat daftar produk.');
  }
}

/* ===========================
   HANDLE SELECT DELETE
=========================== */
async function handleSelectDeleteProduct(ctx) {
  await ctx.answerCbQuery().catch(() => {});

  const raw = ctx.callbackQuery.data || '';
  const id = sanitizeId(raw);

  ctx.session ||= {};
  ctx.session.awaitingDeleteProduct = id;

  const keyboard = [
    [
      Markup.button.callback("✅ Ya, hapus", `CONFIRM_DEL_${id}`),
      Markup.button.callback("❌ Batal", `CANCEL_DEL_${id}`)
    ]
  ];

  await ctx.reply(`⚠️ Yakin ingin menghapus produk *${id}* ?`, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

/* ===========================
   HANDLE CONFIRM DELETE
   - treat no-return as success unless error thrown
=========================== */
async function handleConfirmDeleteProduct(ctx) {
  await ctx.answerCbQuery().catch(() => {});

  const raw = ctx.callbackQuery.data || '';
  const id = sanitizeId(raw);

  try {
    await productService.deleteProduct(id);
    await ctx.reply(`🗑 Produk *${id}* berhasil dihapus.`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('handleConfirmDeleteProduct error', err);
    await ctx.reply('❌ Produk tidak ditemukan atau gagal dihapus.');
  } finally {
    ctx.session ||= {};
    ctx.session.awaitingDeleteProduct = null;
  }
}

/* ===========================
   HANDLE CANCEL DELETE
=========================== */
async function handleCancelDeleteProduct(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const raw = ctx.callbackQuery.data || '';
  const id = sanitizeId(raw);
  ctx.session ||= {};
  ctx.session.awaitingDeleteProduct = null;
  await ctx.reply(`❎ Pembatalan hapus produk *${id}*.`, { parse_mode: 'Markdown' });
}

/* ===========================
   ORDERS & PAYMENT (existing)
=========================== */
async function listOrders(ctx) {
  try {
    const orders = await orderService.listOrders();
    if (!orders.length) return ctx.reply('📭 Belum ada order.');

    let msg = '📦 *Daftar Order*\n\n';
    for (const o of orders) {
      const total = Number(o.total || o.price || 0);
      msg +=
        `📦 *${o.id}*\n` +
        `👤 User: ${o.userId}\n` +
        `💰 Total: Rp${total.toLocaleString('id-ID')}\n` +
        `📍 Status: *${o.status || '-'}*\n\n`;
    }

    await ctx.replyWithMarkdown(msg);
  } catch (err) {
    console.error(err);
    await ctx.reply('Gagal memuat daftar order.');
  }
}

async function confirmPayment(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingConfirmOrder = true;
  await ctx.reply('💳 Kirim ID order (contoh: ORD-1234)');
}

async function handleConfirmPayment(ctx) {
  if (!ctx.session || !ctx.session.awaitingConfirmOrder) return;

  const orderId = (ctx.message.text || '').trim();

  try {
    const order = await orderService.getOrder(orderId);
    if (!order) return ctx.reply('❌ Order tidak ditemukan.');

    await orderService.updateOrder(orderId, { status: 'paid' });

    await ctx.reply(`✅ Order *${orderId}* dikonfirmasi lunas.`, { parse_mode: 'Markdown' });

    await ctx.telegram.sendMessage(
      order.userId,
      `💰 *Pembayaran kamu sudah dikonfirmasi!*\n\n🧾 Order ID: ${orderId}\n📦 Produk: ${order.productName}\n💸 Status: Lunas.`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('handleConfirmPayment error', e);
    await ctx.reply('⚠️ Gagal konfirmasi pembayaran.');
  } finally {
    ctx.session.awaitingConfirmOrder = false;
  }
}

/* ===========================
   RESI / STATUS / GREETING / PAYMENT / HELP / VIDEO
   (keamanan: hanya run handlers if session awaiting flags)
=========================== */
async function setResi(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingSetResi = true;
  await ctx.reply('🚚 Kirim:\n`ORD-xxx|resi`', { parse_mode: 'Markdown' });
}

async function setStatus(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingSetStatus = true;
  await ctx.reply('🔄 Kirim:\n`ORD-xxx|status`', { parse_mode: 'Markdown' });
}

async function setGreeting(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingSetGreeting = true;
  const current = await settingsService.getSetting('greeting');
  await ctx.reply(`💬 Kirim greeting baru.\n\n📄 *Saat ini:*\n${current || '_Belum diatur_'}`, { parse_mode: 'Markdown' });
}

async function handleSetGreetingText(ctx) {
  if (!ctx.session || !ctx.session.awaitingSetGreeting) return;
  const text = ctx.message.text.trim();
  await settingsService.setSetting('greeting', text);
  await ctx.reply('✅ Greeting berhasil diperbarui!', { parse_mode: 'Markdown' });
  ctx.session.awaitingSetGreeting = false;
}

async function setPaymentInfo(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingSetPayment = true;
  await ctx.reply('💳 Kirim info pembayaran baru.\n\nContoh format:\n🏦 BANK BCA\nNomor: `1234567890`\nA/N: PT Contoh Toko Makmur', { parse_mode: 'Markdown' });
}

async function handleSetPaymentInfo(ctx) {
  if (!ctx.session || !ctx.session.awaitingSetPayment) return;
  const text = ctx.message.text.trim();
  await settingsService.setSetting('payment_info', text);
  await ctx.reply('✅ Info pembayaran berhasil diperbarui.', { parse_mode: 'Markdown' });
  ctx.session.awaitingSetPayment = false;
}

async function setHelpText(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingSetHelp = true;
  const current = await settingsService.getSetting('help');
  await ctx.reply(`❓ Kirim teks bantuan baru.\n\n📄 *Saat ini:* ${current || '_Belum diatur_'}`, { parse_mode: 'Markdown' });
}

async function handleSetHelpText(ctx) {
  if (!ctx.session || !ctx.session.awaitingSetHelp) return;
  const text = ctx.message.text.trim();
  await settingsService.setSetting('help', text);
  await ctx.reply('✅ Teks bantuan berhasil diperbarui!', { parse_mode: 'Markdown' });
  ctx.session.awaitingSetHelp = false;
}

async function uploadHelpVideo(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingHelpVideo = true;
  await ctx.reply('🎥 Kirim *video bantuan* satu per satu.\n\nKirim /done jika selesai.', { parse_mode: 'Markdown' });
}

async function handleUploadHelpVideo(ctx) {
  if (!ctx.session || !ctx.session.awaitingHelpVideo) return;
  if (ctx.message.text === '/done') {
    ctx.session.awaitingHelpVideo = false;
    return ctx.reply('✅ Semua video bantuan berhasil disimpan!');
  }
  if (!ctx.message.video) {
    return ctx.reply('❌ Kirim VIDEO, bukan teks atau gambar.');
  }
  const fileId = ctx.message.video.file_id;
  let videos = await settingsService.getSetting('help_videos');
  videos = videos ? JSON.parse(videos) : [];
  videos.push(fileId);
  await settingsService.setSetting('help_videos', JSON.stringify(videos));
  await ctx.reply('🎞 Video berhasil ditambahkan!');
}

/* ===========================
   EXPORT
=========================== */
module.exports = {
  BUTTONS,
  showAdminMenu,

  // Button editing
  showSetButtonsMenu,
  handleSelectButtonToEdit,
  handleSetButtonLabel,

  // Product
  addProduct,
  handleAddProduct,
  showEditProductMenu,
  handleSelectProductToEdit,
  handleEditProduct,
  showDeleteProductMenu,
  handleSelectDeleteProduct,
  handleConfirmDeleteProduct,
  handleCancelDeleteProduct,

  // Orders
  listOrders,

  // Payment
  confirmPayment,
  handleConfirmPayment,

  // Resi & Status
  setResi,
  setStatus,

  // Greeting & help
  setGreeting,
  handleSetGreetingText,

  setPaymentInfo,
  handleSetPaymentInfo,

  setHelpText,
  handleSetHelpText,

  uploadHelpVideo,
  handleUploadHelpVideo,
};
