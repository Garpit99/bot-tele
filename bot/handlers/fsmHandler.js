// bot/handlers/fsmHandler.js
const productService = require('../../services/productService');
const orderService = require('../../services/orderService');
const settingsService = require('../../services/settingsService');

// ------------------------------
// Helper anti-spam untuk admin
// ------------------------------
const sentAdminMessages = new Set();
function sendToAdminOnce(ctx, adminId, message) {
  const hash = `${adminId}:${message}`;
  if (sentAdminMessages.has(hash)) return;
  sentAdminMessages.add(hash);
  return ctx.telegram.sendMessage(adminId, message).catch(() => {});
}

async function handleState(ctx) {
  ctx.session ||= {};
  const text = ctx.message?.text?.trim();
  if (!text) return;

  /* ==========================
       USER INPUT ORDER
  ========================== */
  if (ctx.session.orderingProduct) {
    const parts = text.split('|');
    if (parts.length < 3)
      return ctx.reply('⚠️ Format salah!\nGunakan: `Nama|Alamat|Nomor HP`', {
        parse_mode: 'Markdown',
      });

    const [name, address, phone] = parts.map((p) => p.trim());
    const product = ctx.session.orderingProduct;
    const orderId = `ORD-${Date.now()}`;

    await orderService.createOrder({
      id: orderId,
      userId: ctx.from.id,
      productId: product.id,
      productName: product.name,
      price: product.price,
      name,
      address,
      phone,
      status: 'pending',
      date: new Date().toISOString(),
    });

    ctx.session.orderingProduct = null;

    // --- AMBIL PAYMENT INFO DARI REDIS
    const paymentInfo =
      (await settingsService.getSetting('payment_info')) ||
      '🏦 *BANK BCA*\nNomor: `1234567890`\nA/N: PT Contoh Digital';

    // --- KIRIM PESAN KE USER
    const userMsg =
      `✅ *Pesanan berhasil dibuat!*\n\n` +
      `🧾 *Order ID:* ${orderId}\n` +
      `📦 *Produk:* ${product.name}\n` +
      `💰 Harga: Rp${Number(product.price).toLocaleString('id-ID')}\n` +
      `📞 ${phone}\n` +
      `📍 ${address}\n\n` +
      `Silakan lakukan pembayaran ke rekening berikut:\n\n${paymentInfo}\n\n` +
      `📤 Setelah transfer, kirim *foto bukti pembayaran* ke sini dengan caption Order ID.`;

    await ctx.replyWithMarkdown(userMsg);

    // --- NOTIF ADMIN
    const adminIds = (process.env.ADMIN_IDS || '')
      .split(',')
      .map(a => a.trim())
      .filter(a => a);

    const adminMessage =
      `📢 *Pesanan Baru Masuk!*\n\n` +
      `🧾 Order ID: ${orderId}\n` +
      `👤 Nama: ${name}\n` +
      `📦 Produk: ${product.name}\n` +
      `💰 Rp${Number(product.price).toLocaleString('id-ID')}\n` +
      `📞 ${phone}\n` +
      `📍 ${address}`;

    for (const adminId of adminIds) {
      sendToAdminOnce(ctx, adminId, adminMessage);
    }

    return;
  }

  /* ==========================
       ADD PRODUCT
  ========================== */
  if (ctx.session.awaitingAddProduct) {
    try {
      const [id, name, price, stock, description] = text.split('|');
      await productService.createProduct({
        id: id.trim(),
        name: name.trim(),
        price: Number(price),
        stock: Number(stock),
        description: description.trim(),
      });

      await ctx.reply(
        `✅ Produk *${name.trim()}* berhasil ditambahkan.`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      await ctx.reply('⚠️ Format salah! Gunakan: id|nama|harga|stok|deskripsi');
    }

    ctx.session.awaitingAddProduct = false;
    return;
  }

  /* ==========================
       DELETE PRODUCT
  ========================== */
  if (ctx.session.awaitingDeleteProduct) {
    await productService.deleteProduct(text);
    await ctx.reply(`🗑 Produk *${text}* berhasil dihapus.`, {
      parse_mode: 'Markdown',
    });
    ctx.session.awaitingDeleteProduct = false;
    return;
  }

  /* ==========================
      CONFIRM PAYMENT
  ========================== */
  if (ctx.session.awaitingConfirmOrder) {
    const orderId = text;

    try {
      const order = await orderService.getOrder(orderId);
      if (!order) return ctx.reply('❌ Order tidak ditemukan.');

      await orderService.updateOrder(orderId, { status: 'paid' });

      await ctx.reply(
        `✅ Pembayaran untuk *${orderId}* dikonfirmasi.`,
        { parse_mode: 'Markdown' }
      );

      const msg =
        `💰 *Pembayaran kamu sudah dikonfirmasi!*\n\n` +
        `🧾 Order ID: ${orderId}\n` +
        `📦 Produk: ${order.productName}\n` +
        `📌 Status: Lunas / Sedang diproses`;

      await ctx.telegram.sendMessage(order.userId, msg, {
        parse_mode: 'Markdown',
      });
    } catch (e) {
      await ctx.reply('⚠️ Terjadi kesalahan.');
    }

    ctx.session.awaitingConfirmOrder = false;
    return;
  }

  /* ==========================
          SET RESI
  ========================== */
  if (ctx.session.awaitingSetResi) {
    const [orderId, resi] = text.split('|').map(s => s.trim());

    await orderService.updateOrder(orderId, {
      trackingNumber: resi,
      status: 'shipped',
    });

    await ctx.reply(
      `🚚 Resi *${resi}* disimpan untuk order *${orderId}*.`,
      { parse_mode: 'Markdown' }
    );

    const order = await orderService.getOrder(orderId);
    if (order?.userId) {
      await ctx.telegram.sendMessage(
        order.userId,
        `🚚 Pesanan kamu dikirim!\n\n🧾 *${orderId}*\n🔢 Resi: *${resi}*`,
        { parse_mode: 'Markdown' }
      );
    }

    ctx.session.awaitingSetResi = false;
    return;
  }

  /* ==========================
        SET STATUS
  ========================== */
  if (ctx.session.awaitingSetStatus) {
    const [orderId, status] = text.split('|').map(s => s.trim());

    await orderService.updateOrder(orderId, { status });

    await ctx.reply(
      `🔄 Status order *${orderId}* diubah menjadi *${status}*`,
      { parse_mode: 'Markdown' }
    );

    ctx.session.awaitingSetStatus = false;
    return;
  }

  /* ==========================
        SET GREETING
  ========================== */
  if (ctx.session.awaitingSetGreeting) {
    await settingsService.setSetting('greeting', text);
    await ctx.reply('💬 Greeting berhasil diperbarui.');
    ctx.session.awaitingSetGreeting = false;
    return;
  }

  /* ==========================
       SET PAYMENT INFO
  ========================== */
  if (ctx.session.awaitingSetPayment) {
    await settingsService.setSetting('payment_info', text);

    await ctx.reply(
      '💳 Info pembayaran berhasil diperbarui!',
      { parse_mode: 'Markdown' }
    );

    ctx.session.awaitingSetPayment = false;
    return;
  }
}

module.exports = { handleState };
