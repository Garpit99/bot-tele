// bot/handlers/uploadHandler.js
const orderService = require('../../services/orderService');

async function handleUpload(ctx) {
  try {
    const caption = ctx.message.caption || '';
    const found = caption.match(/(ORD-\d+)/);

    if (!found) {
      return ctx.reply('⚠️ Mohon sertakan *ID order* di caption foto, contoh:\n`ORD-123456`', { parse_mode: 'Markdown' });
    }

    const orderId = found[1];
    const fileId = ctx.message.photo
      ? ctx.message.photo.slice(-1)[0].file_id
      : ctx.message.document?.file_id;

    if (!fileId) return ctx.reply('⚠️ File tidak ditemukan.');

    // Simpan ke database
    await orderService.updateOrder(orderId, {
      paymentProofFileId: fileId,
      status: 'waiting_confirmation',
    });

    // Kirim balasan ke user
    await ctx.reply(`✅ Bukti pembayaran diterima untuk order *${orderId}*.\nAdmin akan memverifikasi dalam waktu dekat.`, {
      parse_mode: 'Markdown',
    });

    // 🔔 Kirim notifikasi & forward foto ke admin
    const ADMIN_IDS = (process.env.ADMIN_IDS || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

    for (const adminId of ADMIN_IDS) {
      // Kirim pesan notifikasi
      await ctx.telegram.sendMessage(
        adminId,
        `📢 Bukti pembayaran baru diterima!\n\n🧾 Order ID: ${orderId}\n👤 Dari pengguna: ${ctx.from.first_name || 'User'} (${ctx.from.id})\n\nSilakan verifikasi di panel admin.`
      );

      // Forward bukti transfer
      if (ctx.message.photo) {
        await ctx.telegram.sendPhoto(adminId, fileId, {
          caption: `🧾 Bukti transfer dari user untuk order ${orderId}`,
        });
      } else if (ctx.message.document) {
        await ctx.telegram.sendDocument(adminId, fileId, {
          caption: `🧾 Bukti transfer dari user untuk order ${orderId}`,
        });
      }
    }
  } catch (err) {
    console.error('❌ UploadHandler error:', err);
    await ctx.reply('⚠️ Gagal memproses bukti pembayaran. Coba lagi nanti.');
  }
}

module.exports = { handleUpload };
