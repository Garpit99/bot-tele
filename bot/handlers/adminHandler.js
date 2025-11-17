const productService = require('../../services/productService');
const orderService = require('../../services/orderService');
const settingsService = require('../../services/settingsService');
const buttonService = require('../../services/buttonService');
const { Markup } = require('telegraf');

/* ============================================
   HELPER: BAGI ARRAY MENJADI GRID
=============================================== */
function chunkArray(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
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

// Register default to Redis
buttonService.setDefaultButtons(BUTTONS);

/* ===========================
   LOAD BUTTON FROM DB
=========================== */
async function getBtn(key) {
  return (await buttonService.getButtonLabel(key)) || BUTTONS[key];
}

/* ===========================
      ADMIN MENU (GRID 3)
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
          key.replace("BTN_", "") // example: BTN_ADMIN_ADD_PRODUCT → ADMIN_ADD_PRODUCT
        )
      );
    }

    const keyboard = chunkArray(buttonList, 3); // GRID 3 KOLOM

    await ctx.reply("📋 *Panel Admin* — pilih aksi:", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (err) {
    console.error(err);
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

    const keyboard = chunkArray(btns, 2); // GRID 2 KOLOM
    keyboard.push([
      Markup.button.callback("⬅️ Kembali", "ADMIN_PANEL")
    ]);

    await ctx.reply("🔧 Pilih tombol yang ingin diubah:", {
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (e) {
    console.error("showSetButtonsMenu error:", e);
    await ctx.reply("❌ Gagal membuka menu ubah tombol.");
  }
}

/* ===========================
    HANDLE SELECT BUTTON
=========================== */
async function handleSelectButtonToEdit(ctx) {
  await ctx.answerCbQuery();

  const key = ctx.callbackQuery.data.replace("ADMIN_SET_BTN_", "");

  ctx.session ||= {};
  ctx.session.awaitingSetButtonKey = key;

  const current = await getBtn(key);

  await ctx.reply(
    `✏️ Kirim nama baru untuk tombol *${key}*\n\n📄 Saat ini: ${current}`,
    { parse_mode: "Markdown" }
  );
}

/* ===========================
    HANDLE SET BUTTON LABEL
=========================== */
async function handleSetButtonLabel(ctx) {
  ctx.session ||= {};

  const key = ctx.session.awaitingSetButtonKey;
  if (!key) return;

  const newLabel = ctx.message.text.trim();

  await buttonService.setButtonLabel(key, newLabel);

  await ctx.reply(
    `✅ Nama tombol *${key}* berhasil diubah menjadi:\n${newLabel}`,
    { parse_mode: "Markdown" }
  );

  ctx.session.awaitingSetButtonKey = null;
}

/* ===========================
    EDIT PRODUCT
=========================== */
async function handleEditProduct(ctx) {
  ctx.session ||= {};

  try {
    const txt = ctx.message?.text?.trim() || "";
    if (!txt) {
      return ctx.reply(
        '❌ Tidak ada teks. Format:\n`id|nama|harga|stok|deskripsi|link1,link2`',
        { parse_mode: 'Markdown' }
      );
    }

    const parts = txt.split('|');
    if (parts.length < 5) {
      return ctx.reply(
        '❌ Format salah!\nGunakan:\n`id|nama|harga|stok|deskripsi|link1,link2`',
        { parse_mode: 'Markdown' }
      );
    }

    const id = parts[0].trim();
    const name = parts[1].trim();
    const price = Number(parts[2].trim());
    const stock = Number(parts[3].trim());
    const description = parts[4].trim();
    const links = parts[5] ? parts[5].split(',').map(l => l.trim()) : [];

    const updated = await productService.updateProduct(id, {
      name,
      price,
      stock,
      description,
      links
    });

    if (!updated) return ctx.reply('❌ Produk tidak ditemukan.');

    await ctx.reply('✅ Produk berhasil diperbarui!');
  } catch (err) {
    console.error(err);
    await ctx.reply(
      '⚠️ Format salah.\nGunakan:\n`id|nama|harga|stok|deskripsi|link1,link2`',
      { parse_mode: 'Markdown' }
    );
  } finally {
    ctx.session.awaitingEditProduct = false;
  }
}

/* ===========================
  ADD & DELETE PRODUCT
=========================== */
async function addProduct(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingAddProduct = true;

  await ctx.reply(
    '🧾 Kirim data produk:\n`id|nama|harga|stok|deskripsi|link`',
    { parse_mode: 'Markdown' }
  );
}

async function deleteProduct(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingDeleteProduct = true;

  await ctx.reply('🗑 Kirim *ID produk* yang ingin dihapus:', {
    parse_mode: 'Markdown'
  });
}

/* ===========================
    LIST ORDERS
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

/* ===========================
      CONFIRM PAYMENT
=========================== */
async function confirmPayment(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingConfirmOrder = true;

  await ctx.reply('💳 Kirim ID order (contoh: ORD-1234)');
}

async function handleConfirmPayment(ctx) {
  const orderId = ctx.message.text.trim();

  try {
    const order = await orderService.getOrder(orderId);
    if (!order) return ctx.reply('❌ Order tidak ditemukan.');

    await orderService.updateOrder(orderId, { status: 'paid' });

    await ctx.reply(`✅ Order *${orderId}* dikonfirmasi lunas.`, {
      parse_mode: 'Markdown'
    });

    await ctx.telegram.sendMessage(
      order.userId,
      `💰 *Pembayaran kamu sudah dikonfirmasi!*\n\n🧾 Order ID: ${orderId}\n📦 Produk: ${order.productName}\n💸 Status: Lunas.`,
      { parse_mode: 'Markdown' }
    );
  } catch {
    await ctx.reply('⚠️ Gagal konfirmasi pembayaran.');
  }

  ctx.session.awaitingConfirmOrder = false;
}

/* ===========================
    RESI & STATUS
=========================== */
async function setResi(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingSetResi = true;

  await ctx.reply('🚚 Kirim:\n`ORD-xxx|resi`', {
    parse_mode: 'Markdown'
  });
}

async function setStatus(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingSetStatus = true;

  await ctx.reply('🔄 Kirim:\n`ORD-xxx|status`', {
    parse_mode: 'Markdown'
  });
}

/* ===========================
      GREETING
=========================== */
async function setGreeting(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingSetGreeting = true;

  const current = await settingsService.getSetting('greeting');

  await ctx.reply(
    `💬 Kirim greeting baru.\n\n📄 *Saat ini:*\n${current || '_Belum diatur_'}`,
    { parse_mode: 'Markdown' }
  );
}

async function handleSetGreetingText(ctx) {
  const text = ctx.message.text.trim();

  await settingsService.setSetting('greeting', text);

  await ctx.reply('✅ Greeting berhasil diperbarui!', {
    parse_mode: 'Markdown'
  });

  ctx.session.awaitingSetGreeting = false;
}

/* ===========================
      PAYMENT INFO
=========================== */
async function setPaymentInfo(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingSetPayment = true;

  await ctx.reply(
    '💳 Kirim info pembayaran baru.\n\nContoh format:\n🏦 BANK BCA\nNomor: `1234567890`\nA/N: PT Contoh Toko Makmur',
    { parse_mode: 'Markdown' }
  );
}

async function handleSetPaymentInfo(ctx) {
  const text = ctx.message.text.trim();

  await settingsService.setSetting('payment_info', text);

  await ctx.reply('✅ Info pembayaran berhasil diperbarui.', {
    parse_mode: 'Markdown'
  });

  ctx.session.awaitingSetPayment = false;
}

/* ===========================
        HELP TEXT
=========================== */
async function setHelpText(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingSetHelp = true;

  const current = await settingsService.getSetting('help');

  await ctx.reply(
    `❓ Kirim teks bantuan baru.\n\n📄 *Saat ini:* ${current || '_Belum diatur_'}`,
    { parse_mode: 'Markdown' }
  );
}

async function handleSetHelpText(ctx) {
  const text = ctx.message.text.trim();

  await settingsService.setSetting('help', text);

  await ctx.reply('✅ Teks bantuan berhasil diperbarui!', {
    parse_mode: 'Markdown'
  });

  ctx.session.awaitingSetHelp = false;
}

/* ===========================
       UPLOAD HELP VIDEO
=========================== */
async function uploadHelpVideo(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingHelpVideo = true;

  await ctx.reply(
    '🎥 Kirim *video bantuan* satu per satu.\n\nKirim /done jika selesai.',
    { parse_mode: 'Markdown' }
  );
}

async function handleUploadHelpVideo(ctx) {
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
  deleteProduct,
  handleEditProduct,

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
