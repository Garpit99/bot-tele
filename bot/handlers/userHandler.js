// bot/handlers/userHandler.js
const settingsService = require('../../services/settingsService');
const { mainMenu } = require('../keyboards');
const { getClient } = require('../../db/database');
const orderService = require('../../services/orderService');

const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

module.exports = {
  // 🏠 Start Command
  async start(ctx, isAdmin = false) {
    const greeting =
      (await settingsService.getSetting('greeting')) ||
      '👋 Selamat datang di toko kami!';
    const help =
      (await settingsService.getSetting('help')) ||
      'Gunakan menu di bawah untuk melihat produk, membeli, atau melacak pesanan.';

    await ctx.reply(`${greeting}\n\n${help}`, mainMenu(isAdmin));
  },

  // 📦 Daftar Produk
  async viewProducts(ctx) {
    const client = getClient();
    const ids = await client.sMembers('products');
    if (!ids || ids.length === 0)
      return ctx.reply('📭 Belum ada produk tersedia.');

    const buttons = [];
    for (const id of ids) {
      const data = await client.hGetAll(`product:${id}`);
      if (!data || !data.name) continue;
      buttons.push([{ text: `🛍️ ${data.name}`, callback_data: `VIEW_DETAIL_${id}` }]);
    }

    await ctx.reply('🛒 Pilih produk untuk melihat detail:', {
      reply_markup: { inline_keyboard: buttons },
    });
  },

  // 📖 Detail Produk
  async viewProductDetail(ctx) {
    const client = getClient();
    const id = ctx.callbackQuery.data.replace('VIEW_DETAIL_', '');
    const data = await client.hGetAll(`product:${id}`);

    if (!data || !data.id)
      return ctx.editMessageText('❌ Produk tidak ditemukan.');

    const randomLink = await client.sRandMember(`product_links:${id}`);

    const message = `🛍️ *${data.name}*\n💰 Harga: Rp${Number(
      data.price || 0
    ).toLocaleString('id-ID')}\n📦 Stok: ${
      data.stock
    }\n📝 ${data.description || '-'}`;

    const buttons = [
      [{ text: '🌐 Buka Link Acak', callback_data: `OPEN_LINK_${id}` }],
      [{ text: '🛒 Beli Produk Ini', callback_data: `BUY_PRODUCT_${id}` }],
      [{ text: '⬅️ Kembali', callback_data: 'VIEW_PRODUCTS' }],
    ];

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });

    ctx.session = ctx.session || {};
    ctx.session.lastProductLink = randomLink || null;
  },

  // 🎲 Link Acak
  async openRandomLink(ctx) {
    const client = getClient();
    const id = ctx.callbackQuery.data.replace('OPEN_LINK_', '');
    const randomLink = await client.sRandMember(`product_links:${id}`);

    if (!randomLink) return ctx.answerCbQuery('❌ Tidak ada link untuk produk ini.');

    const data = await client.hGetAll(`product:${id}`);
    const message = `🛍️ *${data.name}*\n💰 Harga: Rp${Number(
      data.price || 0
    ).toLocaleString('id-ID')}\n📦 Stok: ${data.stock}\n📝 ${data.description || '-'}`;

    const buttons = [
      [{ text: '🌐 Buka Link Acak', url: randomLink }],
      [{ text: '⬅️ Kembali', callback_data: 'VIEW_PRODUCTS' }],
    ];

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });

    ctx.answerCbQuery('🎲 Link diacak ulang!');
  },

  // 🛒 Mulai Order Step 1 (Klik Beli Produk)
  async buyProduct(ctx) {
    const client = getClient();
    const id = ctx.callbackQuery.data.replace('BUY_PRODUCT_', '');
    const data = await client.hGetAll(`product:${id}`);

    if (!data || !data.id)
      return ctx.answerCbQuery('❌ Produk tidak ditemukan.');

    ctx.session = ctx.session || {};
    ctx.session.orderStep = 1;
    ctx.session.orderingProduct = data;
    ctx.session.orderData = {};

    await ctx.reply(`🧾 Kamu akan membeli *${data.name}* seharga Rp${Number(data.price).toLocaleString('id-ID')}.\n\nSilakan ketik *Nama Lengkap* kamu:`, { parse_mode: 'Markdown' });
  },

  // 📋 Handle input user (step-by-step)
  async handleOrderInput(ctx) {
    ctx.session = ctx.session || {};
    const step = ctx.session.orderStep;
    const text = ctx.message.text?.trim();

    if (!ctx.session.orderingProduct) return;

    switch (step) {
      case 1:
        ctx.session.orderData.name = text;
        ctx.session.orderStep = 2;
        await ctx.reply('📍 Sekarang ketik *Alamat Pengiriman* kamu:', { parse_mode: 'Markdown' });
        break;

      case 2:
        ctx.session.orderData.address = text;
        ctx.session.orderStep = 3;
        await ctx.reply('📞 Terakhir, ketik *Nomor HP* kamu:', { parse_mode: 'Markdown' });
        break;

      case 3:
        ctx.session.orderData.phone = text;

        const product = ctx.session.orderingProduct;
        const { name, address, phone } = ctx.session.orderData;
        const orderId = `ORD-${Date.now()}`;

        await orderService.createOrder({
          id: orderId,
          productId: product.id,
          productName: product.name,
          price: product.price,
          userId: ctx.from.id,
          name,
          address,
          phone,
          status: 'waiting_payment',
          date: new Date().toISOString(),
        });

        // 💳 Kirim info pembayaran
        const rekening = process.env.REKENING_INFO || 
          '🏦 *BANK BCA*\nNomor: `1234567890`\nA/N: PT Contoh Toko Makmur';

        await ctx.replyWithMarkdown(
          `✅ Pesanan kamu berhasil dibuat!\n\n🧾 *Order ID:* ${orderId}\n📦 *Produk:* ${product.name}\n💰 *Harga:* Rp${Number(
            product.price
          ).toLocaleString('id-ID')}\n📞 *Kontak:* ${phone}\n📍 *Alamat:* ${address}\n\n` +
          `Silakan lakukan pembayaran ke rekening berikut:\n\n${rekening}\n\n` +
          `📤 Setelah transfer, kirim *foto bukti pembayaran* ke sini untuk dikonfirmasi admin.`
        );

        // 🔔 Notifikasi ke admin
        for (const adminId of ADMIN_IDS) {
          await ctx.telegram.sendMessage(
            adminId,
            `📢 Pesanan Baru!\n🧾 ${orderId}\n👤 ${name}\n📦 ${product.name}\n💰 Rp${Number(product.price).toLocaleString('id-ID')}`
          );
        }

        ctx.session.orderStep = null;
        ctx.session.orderData = null;
        ctx.session.orderingProduct = null;
        break;

      default:
        await ctx.reply('⚠️ Mulai lagi dengan pilih produk dan tekan "Beli Produk Ini".');
        ctx.session.orderStep = null;
        ctx.session.orderingProduct = null;
        ctx.session.orderData = null;
    }
  },

  // 🚚 Lacak pesanan
  async trackOrder(ctx) {
    const orders = await orderService.listOrdersByUser(ctx.from.id);
    if (!orders.length)
      return ctx.reply('📭 Kamu belum memiliki pesanan.');

    for (const o of orders) {
      await ctx.reply(
        `🧾 *Order ID:* ${o.id}\n🛍️ *${o.productName}*\n💰 Rp${Number(o.price).toLocaleString(
          'id-ID'
        )}\n📦 Status: *${o.status}*\n🚚 Resi: ${o.trackingNumber || '-'}\n📅 ${new Date(
          o.date
        ).toLocaleString('id-ID')}`,
        { parse_mode: 'Markdown' }
      );
    }
  },
};
