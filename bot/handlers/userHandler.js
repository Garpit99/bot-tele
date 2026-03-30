const settingsService = require('../../services/settingsService');
const { mainMenu } = require('../keyboards');
const { getClient } = require('../../db/database');
const orderService = require('../../services/orderService');
const buttonService = require('../../services/buttonService');
const { Markup } = require('telegraf');

const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

/* ===========================
      HELPER AMBIL LABEL BUTTON
=========================== */
async function getBtn(key) {
  const defaultButtons = {
    BTN_VIEW_PRODUCTS: "🛍️ Lihat Produk",
    BTN_OPEN_LINK: "🌐 Buka Link Acak",
    BTN_BACK: "⬅️ Kembali",
    BTN_BUY: "🛒 Beli Produk Ini",
    BTN_HELP_VIDEO: "▶ Tonton Video Bantuan",
    BTN_HELP: "❓ Bantuan",
  };

  return (await buttonService.getButtonLabel(key)) || defaultButtons[key];
}

module.exports = {
/* ============================
    🏠 START COMMAND
============================ */
async start(ctx, isAdmin = false) {
  const greeting =
    (await settingsService.getSetting('greeting')) ||
    '👋 Selamat datang di toko kami!';

  await ctx.reply(greeting, await mainMenu(isAdmin));
},

  /* ============================
      ❓ HELP MENU
============================ */
async helpMenu(ctx) {
  try {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const intro =
      (await settingsService.getSetting("help_intro")) ||
      "Silakan pilih bantuan di bawah ini.";

    const buttons = [
      [
        {
          text: "🎥 Video Tutorial Checkout",
          callback_data: "HELP_VIDEO_CHECKOUT"
        }
      ],
      [
        {
          text: "💬 Chat Admin",
          callback_data: "HELP_CHAT_ADMIN"
        }
      ]
    ];

    return ctx.reply(
      `❓ *Bantuan*\n\n${intro}`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons }
      }
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Gagal membuka menu bantuan.");
  }
},

/* ============================
    🎥 SHOW CHECKOUT VIDEO
============================ */
async showCheckoutVideo(ctx) {
  try {
    const videoData = await settingsService.getSetting("help_checkout_video");

    // Jika video kosong atau tidak ada, jangan tampilkan
    if (!videoData || videoData === "") {
      return ctx.reply("❌ Video tutorial belum tersedia.");
    }

    let fileId = videoData;

    try {
      if (videoData.startsWith("{")) {
        const obj = JSON.parse(videoData);
        fileId = obj.file_id;
      }
    } catch (parseErr) {
      console.error("Parse video data error:", parseErr);
      fileId = videoData; // Gunakan langsung jika parse error
    }

    const caption =
      (await settingsService.getSetting("help_video_caption")) ||
      "🎥 Tutorial Checkout";

    await ctx.replyWithVideo(fileId, { caption });

  } catch (err) {
    console.error("❌ showCheckoutVideo error:", err.message);
    await ctx.reply("❌ Gagal menampilkan video.");
  }
},
  /* ============================
      🛒 VIEW PRODUCTS
  ============================ */
  async viewProducts(ctx) {
    const client = getClient();
    const ids = await client.sMembers('products');
    if (!ids || !ids.length) return ctx.reply('📭 Belum ada produk tersedia.');

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

  /* ============================
       📖 PRODUCT DETAIL
  ============================ */
  async viewProductDetail(ctx) {
    if (!ctx.session) ctx.session = {};
    const client = getClient();
    const id = ctx.callbackQuery.data.replace('VIEW_DETAIL_', '');
    const data = await client.hGetAll(`product:${id}`);

    if (!data || !data.id)
      return ctx.editMessageText('❌ Produk tidak ditemukan.');

    const randomLink = await client.sRandMember(`product_links:${id}`);
    ctx.session.lastProductLink = randomLink || null;

    const message = `🛍️ *${data.name}*\n💰 Harga: Rp${Number(data.price || 0).toLocaleString('id-ID')}\n📦 Stok: ${data.stock}\n📝 ${data.description || '-'}`;

    const buttons = [
      [{ text: await getBtn('BTN_OPEN_LINK'), callback_data: `OPEN_LINK_${id}` }],
      [{ text: await getBtn('BTN_BUY'), callback_data: `BUY_PRODUCT_${id}` }],
      [{ text: await getBtn('BTN_BACK'), callback_data: 'VIEW_PRODUCTS' }],
    ];

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  },

  /* ============================
        🎲 RANDOM LINK
  ============================ */
async openRandomLink(ctx) {
  if (!ctx.session) ctx.session = {};
  const client = getClient();
  const id = ctx.callbackQuery.data.replace('OPEN_LINK_', '');

  const randomLink = await client.sRandMember(`product_links:${id}`);
  if (!randomLink) {
    return ctx.answerCbQuery('❌ Tidak ada link untuk produk ini.');
  }

  const data = await client.hGetAll(`product:${id}`);
  const newText =
    `🛍️ *${data.name}*\n` +
    `💰 Harga: Rp${Number(data.price || 0).toLocaleString('id-ID')}\n` +
    `📦 Stok: ${data.stock}\n` +
    `📝 ${data.description || '-'}`;

  const buttons = [
    [
      {
        text: await getBtn('BTN_OPEN_LINK'),
        url: randomLink, // 🔥 langsung buka web
      },
    ],
    [
      {
        text: await getBtn('BTN_BACK'),
        callback_data: 'VIEW_PRODUCTS',
      },
    ],
  ];

  try {
    await ctx.editMessageText(newText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (e) {}

  // ❌ jangan pakai alert / popup
  await ctx.answerCbQuery();
},

  /* ============================
      🛒 ORDER / BUY PRODUCT
  ============================ */
  async buyProduct(ctx) {
    if (!ctx.session) ctx.session = {};
    const client = getClient();
    const id = ctx.callbackQuery.data.replace('BUY_PRODUCT_', '');
    const data = await client.hGetAll(`product:${id}`);

    if (!data || !data.id)
      return ctx.answerCbQuery('❌ Produk tidak ditemukan.');

    ctx.session.orderStep = 1;
    ctx.session.orderingProduct = data;
    ctx.session.orderData = {};

    await ctx.reply(
      `🧾 Kamu akan membeli *${data.name}* seharga Rp${Number(data.price).toLocaleString('id-ID')}.\n\nSilakan ketik *Nama Lengkap* kamu:`,
      { parse_mode: 'Markdown' }
    );
  },

  async handleOrderInput(ctx) {
    if (!ctx.session) ctx.session = {};
    if (!ctx.session.orderingProduct) return;

    const step = ctx.session.orderStep;
    const text = ctx.message.text?.trim();
    if (!text) return;

    switch (step) {
      case 1:
        ctx.session.orderData.name = text;
        ctx.session.orderStep = 2;
        return ctx.reply('📍 Sekarang ketik *Alamat Pengiriman* kamu:', { parse_mode: 'Markdown' });

      case 2:
        ctx.session.orderData.address = text;
        ctx.session.orderStep = 3;
        return ctx.reply('📞 Terakhir, ketik *Nomor HP* kamu:', { parse_mode: 'Markdown' });

      case 3: {
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

        const rekening =
          (await settingsService.getSetting('payment_info')) ||
          '🏦 *BANK BCA*\nNomor: `1234567890`\nA/N: PT Contoh Toko Makmur';

        await ctx.replyWithMarkdown(
          `✅ Pesanan berhasil dibuat!\n\n🧾 *Order ID:* ${orderId}\n📦 *Produk:* ${product.name}\n💰 *Harga:* Rp${Number(product.price).toLocaleString('id-ID')}\n📞 *Kontak:* ${phone}\n📍 *Alamat:* ${address}\n\nSilakan lakukan pembayaran:\n\n${rekening}\n\n📤 Setelah transfer, kirim *foto bukti pembayaran* kepada admin.`
        );

        for (const adminId of ADMIN_IDS) {
          await ctx.telegram.sendMessage(
            adminId,
            `📢 Pesanan Baru!\n🧾 ${orderId}\n👤 ${name}\n📦 ${product.name}\n💰 Rp${Number(product.price).toLocaleString('id-ID')}`
          );
        }

        ctx.session.orderStep = null;
        ctx.session.orderingProduct = null;
        ctx.session.orderData = null;
        return;
      }

      default:
        ctx.session.orderStep = null;
        ctx.session.orderingProduct = null;
        ctx.session.orderData = null;
        return ctx.reply('⚠️ Mulai ulang pembelian.');
    }
  },

  /* ============================
      🚚 TRACK ORDER
  ============================ */
  async trackOrder(ctx) {
    const orders = await orderService.listOrdersByUser(ctx.from.id);
    if (!orders.length) return ctx.reply('📭 Kamu belum memiliki pesanan.');

    for (const o of orders) {
      await ctx.reply(
        `🧾 *Order ID:* ${o.id}\n🛍️ *${o.productName}*\n💰 Rp${Number(o.price).toLocaleString('id-ID')}\n📦 Status: *${o.status}*\n🚚 Resi: ${o.trackingNumber || '-'}\n📅 ${new Date(o.date).toLocaleString('id-ID')}`,
        { parse_mode: 'Markdown' }
      );
    }
  },
};
