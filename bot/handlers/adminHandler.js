const productService = require('../../services/productService');
const orderService = require('../../services/orderService');
const settingsService = require('../../services/settingsService');
const { Markup } = require('telegraf');

/* ===========================
   SHOW ADMIN MENU
=========================== */
async function showAdminMenu(ctx) {
  try {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('➕ Tambah Produk', 'ADMIN_ADD_PRODUCT')],
      [Markup.button.callback('❌ Hapus Produk', 'ADMIN_DELETE_PRODUCT')],
      [Markup.button.callback('📦 Daftar Order', 'ADMIN_LIST_ORDERS')],
      [Markup.button.callback('💳 Konfirmasi Pembayaran', 'ADMIN_CONFIRM_PAYMENT')],
      [Markup.button.callback('🚚 Input Resi', 'ADMIN_SET_RESI')],
      [Markup.button.callback('🔄 Ubah Status Order', 'ADMIN_SET_STATUS')],
      [Markup.button.callback('💬 Ubah Greeting', 'ADMIN_SET_GREETING')],
      [Markup.button.callback('💳 Ubah Rekening Pembayaran', 'ADMIN_SET_PAYMENT')],
      [Markup.button.callback('❓ Ubah Text Bantuan', 'ADMIN_SET_HELP')],
    ]);

    await ctx.reply('📋 *Panel Admin* — pilih aksi:', {
      parse_mode: 'Markdown',
      ...keyboard,
    });
  } catch (err) {
    await ctx.reply('Terjadi kesalahan membuka panel admin.');
  }
}

/* ===========================
  ADD & DELETE PRODUCT
=========================== */
async function addProduct(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingAddProduct = true;
  await ctx.reply('🧾 Kirim data produk:\n`id|nama|harga|stok|deskripsi`', {
    parse_mode: 'Markdown',
  });
}

async function deleteProduct(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingDeleteProduct = true;
  await ctx.reply('🗑 Kirim *ID produk* yang ingin dihapus:', { parse_mode: 'Markdown' });
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
      const total =
        o.total && !isNaN(Number(o.total))
          ? Number(o.total)
          : o.price
          ? Number(o.price)
          : 0;

      msg +=
        `📦 *${o.id}*\n` +
        `👤 User: ${o.userId}\n` +
        `💰 Total: Rp${total.toLocaleString('id-ID')}\n` +
        `📍 Status: *${o.status || '-'}*\n\n`;
    }

    await ctx.replyWithMarkdown(msg);
  } catch (err) {
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
      parse_mode: 'Markdown',
    });

    const msg =
      `💰 *Pembayaran kamu sudah dikonfirmasi!*\n\n` +
      `🧾 *Order ID:* ${orderId}\n` +
      `📦 *Produk:* ${order.productName}\n` +
      `💸 *Status:* Lunas / Sedang diproses.`;

    await ctx.telegram.sendMessage(order.userId, msg, {
      parse_mode: 'Markdown',
    });
  } catch (err) {
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

  await ctx.reply('🚚 Kirim:\n`ORD-xxx|resi`', { parse_mode: 'Markdown' });
}

async function setStatus(ctx) {
  ctx.session ||= {};
  ctx.session.awaitingSetStatus = true;

  await ctx.reply('🔄 Kirim:\n`ORD-xxx|status`', { parse_mode: 'Markdown' });
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
    parse_mode: 'Markdown',
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
    '💳 Kirim info pembayaran baru (contoh format):\n\n' +
      '🏦 *BANK BCA*\nNomor: `1234567890`\nA/N: PT Contoh Toko Makmur',
    { parse_mode: 'Markdown' }
  );
}

async function handleSetPaymentInfo(ctx) {
  const text = ctx.message.text.trim();

  await settingsService.setSetting('payment_info', text);

  await ctx.reply('✅ Info pembayaran berhasil diperbarui.', {
    parse_mode: 'Markdown',
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
    `❓ Kirim teks bantuan baru.\n\n📄 *Saat ini:*\n${current || '_Belum diatur_'}`,
    { parse_mode: 'Markdown' }
  );
}

async function handleSetHelpText(ctx) {
  const text = ctx.message.text.trim();

  await settingsService.setSetting('help', text);

  await ctx.reply('✅ Teks bantuan berhasil diperbarui!', {
    parse_mode: 'Markdown',
  });

  ctx.session.awaitingSetHelp = false;
}

/* ===========================
       EXPORT
=========================== */
module.exports = {
  showAdminMenu,
  addProduct,
  deleteProduct,
  listOrders,
  confirmPayment,
  handleConfirmPayment,
  setResi,
  setStatus,

  // greeting + handler FIXED
  setGreeting,
  handleSetGreetingText,

  // payment
  setPaymentInfo,
  handleSetPaymentInfo,

  // help
  setHelpText,
  handleSetHelpText,
};
