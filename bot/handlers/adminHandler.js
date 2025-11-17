// bot/handlers/adminHandler.js
const productService = require('../../services/productService');
const orderService = require('../../services/orderService');
const settingsService = require('../../services/settingsService');
const { Markup } = require('telegraf');

/* ===========================
   🧭 Panel Admin Utama
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
    ]);

    await ctx.reply('📋 *Panel Admin* — pilih aksi:', {
      parse_mode: 'Markdown',
      ...keyboard,
    });
  } catch (err) {
    console.error('❌ showAdminMenu error:', err);
    await ctx.reply('Terjadi kesalahan membuka panel admin.');
  }
}

/* ===========================
   ➕ Tambah & Hapus Produk
=========================== */
async function addProduct(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.awaitingAddProduct = true;
  await ctx.reply('🧾 Kirim data produk dalam format:\n\n`id|nama|harga|stok|deskripsi`', {
    parse_mode: 'Markdown',
  });
}

async function deleteProduct(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.awaitingDeleteProduct = true;
  await ctx.reply('🗑 Kirim *ID produk* yang ingin dihapus:', { parse_mode: 'Markdown' });
}

/* ===========================
   📦 Daftar & Kelola Order
=========================== */
async function listOrders(ctx) {
  try {
    const orders = await orderService.listOrders();
    if (!orders.length) return ctx.reply('📭 Belum ada order.');

    for (const o of orders) {
      const total =
        o.total && !isNaN(Number(o.total))
          ? Number(o.total)
          : o.price
          ? Number(o.price)
          : 0;

      await ctx.replyWithMarkdown(
        `📦 *${o.id}*\n👤 User: ${o.userId}\n💰 Total: Rp${total.toLocaleString(
          'id-ID'
        )}\n📍 Status: *${o.status || '-'}*`
      );
    }
  } catch (err) {
    console.error('❌ listOrders error:', err);
    await ctx.reply('Gagal memuat daftar order.');
  }
}

/* ===========================
   💳 Konfirmasi Pembayaran
=========================== */
async function confirmPayment(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.awaitingConfirmOrder = true;
  await ctx.reply('💳 Kirim ID order untuk dikonfirmasi pembayarannya (contoh: ORD-1234)');
}

/**
 * ✅ Dipanggil oleh FSM ketika admin kirim ID order
 * contoh input: ORD-1762963746149
 */
async function handleConfirmPayment(ctx) {
  const orderId = ctx.message.text.trim();

  try {
    const order = await orderService.getOrder(orderId);
    if (!order) return ctx.reply('❌ Order tidak ditemukan.');

    await orderService.updateOrder(orderId, { status: 'paid' });

    // ✅ Kirim pesan konfirmasi ke admin
    await ctx.reply(`✅ Order *${orderId}* dikonfirmasi lunas.`, { parse_mode: 'Markdown' });

    // 🔔 Kirim notifikasi ke user
    if (order.userId) {
      try {
        await ctx.telegram.sendMessage(
          order.userId,
          `💰 *Pembayaran kamu sudah dikonfirmasi!*\n\n🧾 *Order ID:* ${orderId}\n📦 *Produk:* ${order.productName}\n💸 *Status:* Lunas / Sedang diproses.\n\nTerima kasih telah berbelanja 🙏`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.error('❌ Gagal kirim notifikasi ke user:', err);
      }
    }
  } catch (err) {
    console.error('❌ Error konfirmasi pembayaran:', err);
    await ctx.reply('⚠️ Gagal konfirmasi pembayaran.');
  }

  ctx.session.awaitingConfirmOrder = false;
}

/* ===========================
   🚚 Input Resi & Status Order
=========================== */
async function setResi(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.awaitingSetResi = true;
  await ctx.reply('🚚 Kirim data dalam format:\n\n`ORD-...|nomor_resi`', {
    parse_mode: 'Markdown',
  });
}

async function setStatus(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.awaitingSetStatus = true;
  await ctx.reply('🔄 Kirim data dalam format:\n\n`ORD-...|status`', {
    parse_mode: 'Markdown',
  });
}

/* ===========================
   💬 Greeting
=========================== */
async function setGreeting(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.awaitingSetGreeting = true;
  await ctx.reply('💬 Kirim teks greeting baru:');
}

/* ===========================
   🧩 Ekspor Semua Fungsi
=========================== */
module.exports = {
  showAdminMenu,
  addProduct,
  deleteProduct,
  listOrders,
  confirmPayment,
  handleConfirmPayment, // <— fungsi baru untuk kirim notif ke user
  setResi,
  setStatus,
  setGreeting,
};
