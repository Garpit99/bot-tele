// bot/handlers/fsmHandler.js
const productService = require('../../services/productService');
const orderService = require('../../services/orderService');
const settingsService = require('../../services/settingsService');

async function handleState(ctx) {
  ctx.session = ctx.session || {};
  const text = ctx.message.text?.trim();

  /* ==========================
     🛍️ USER ORDER INPUT
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

    // Kirim pesan konfirmasi order ke user
    await ctx.reply(
      `✅ Pesanan kamu berhasil dibuat!\n\n🧾 *Order ID:* ${orderId}\n🛍️ *${product.name}*\n💰 Rp${Number(
        product.price
      ).toLocaleString('id-ID')}\n📞 ${phone}\n📦 ${address}\n\nSilakan lakukan pembayaran ke:\n\n🏦 *BANK BCA*\n👤 a.n. PT Contoh Digital\n💳 *1234567890*\n\nSetelah transfer, kirim bukti pembayaran dengan caption berisi *Order ID* (contoh: ORD-123456).`,
      { parse_mode: 'Markdown' }
    );

    // 🔔 Kirim notifikasi ke admin
    const adminIds = (process.env.ADMIN_IDS || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    for (const adminId of adminIds) {
      try {
        await ctx.telegram.sendMessage(
          adminId,
          `📢 Pesanan Baru!\n\n🧾 Order ID: ${orderId}\n👤 Nama: ${name}\n📦 Produk: ${product.name}\n💰 Rp${Number(
            product.price
          ).toLocaleString('id-ID')}\n📞 ${phone}\n📍 ${address}`
        );
      } catch (err) {
        console.error('❌ Gagal kirim notifikasi ke admin:', err);
      }
    }

    return;
  }

  /* ==========================
     ⚙️ ADMIN FSM - TAMBAH PRODUK
  ========================== */
  if (ctx.session.awaitingAddProduct) {
    try {
      const [id, name, price, stock, description, linksRaw] = text.split('|');
      let links = [];
      if (linksRaw && linksRaw.trim() !== '') {
        links = linksRaw.split(',').map((l) => l.trim()).filter((l) => l.startsWith('http'));
      }

      await productService.createProduct({
        id: id.trim(),
        name: name.trim(),
        price: Number(price),
        stock: Number(stock) || 0,
        description: description.trim(),
        links,
      });

      ctx.session.awaitingAddProduct = false;

      await ctx.reply(
        `✅ Produk *${name.trim()}* berhasil disimpan!\n💰 Harga: Rp${price}\n📦 Stok: ${stock}\n📝 ${description}\n🔗 Link: ${links.length ? links.join(', ') : '(tidak ada)'}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('❌ Error tambah produk:', err);
      await ctx.reply('⚠️ Gagal menambah produk. Cek format dan coba lagi.');
    }
    return;
  }

  /* ==========================
     🗑️ HAPUS PRODUK
  ========================== */
  if (ctx.session.awaitingDeleteProduct) {
    await productService.deleteProduct(text);
    ctx.session.awaitingDeleteProduct = false;
    return ctx.reply(`🗑 Produk *${text}* berhasil dihapus.`, { parse_mode: 'Markdown' });
  }

  /* ==========================
     💳 KONFIRMASI PEMBAYARAN ADMIN
  ========================== */
  if (ctx.session.awaitingConfirmOrder) {
    const orderId = text.trim();

    try {
      const order = await orderService.getOrder(orderId);
      if (!order) return ctx.reply('❌ Order tidak ditemukan.');

      // Update status jadi "paid"
      await orderService.updateOrder(orderId, { status: 'paid' });

      // ✅ Konfirmasi ke admin
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
    return;
  }

  /* ==========================
     🚚 INPUT RESI
  ========================== */
  if (ctx.session.awaitingSetResi) {
    const [orderId, resi] = text.split('|');
    await orderService.updateOrder(orderId.trim(), {
      trackingNumber: resi.trim(),
      status: 'shipped',
    });
    ctx.session.awaitingSetResi = false;

    // 🔔 Notifikasi ke user
    const order = await orderService.getOrder(orderId.trim());
    if (order && order.userId) {
      try {
        await ctx.telegram.sendMessage(
          order.userId,
          `🚚 Pesanan kamu telah dikirim!\n\n🧾 *Order ID:* ${orderId}\n📦 *Produk:* ${order.productName}\n🔢 *Nomor Resi:* ${resi}\n\nKamu bisa melacak pesananmu menggunakan nomor resi tersebut.`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.error('❌ Gagal kirim notifikasi resi ke user:', err);
      }
    }

    return ctx.reply(`🚚 Resi *${resi}* disimpan untuk *${orderId}*`, { parse_mode: 'Markdown' });
  }

  /* ==========================
     🔄 UBAH STATUS ORDER
  ========================== */
  if (ctx.session.awaitingSetStatus) {
    const [orderId, status] = text.split('|');
    await orderService.updateOrder(orderId.trim(), { status: status.trim() });
    ctx.session.awaitingSetStatus = false;
    return ctx.reply(`🔄 Status *${orderId}* diubah menjadi *${status}*`, { parse_mode: 'Markdown' });
  }

  /* ==========================
     💬 UBAH GREETING
  ========================== */
  if (ctx.session.awaitingSetGreeting) {
    await settingsService.setSetting('greeting', text);
    ctx.session.awaitingSetGreeting = false;
    return ctx.reply('💬 Greeting berhasil diperbarui.');
  }
}

module.exports = { handleState };
