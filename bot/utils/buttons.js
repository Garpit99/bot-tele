// bot/utils/buttons.js
const buttonService = require('../../services/buttonService');

const DEFAULT_BUTTONS = {
  view_products: "🛍️ Lihat Produk",
  open_link: "🌐 Buka Link Acak",
  back: "⬅️ Kembali",
  buy: "🛒 Beli Produk Ini",

  // ADMIN
  admin_add_product: "➕ Tambah Produk",
  admin_edit_product: "✏️ Edit Produk",
  admin_delete_product: "❌ Hapus Produk",
  admin_list_orders: "📦 Daftar Order",
  admin_confirm_payment: "💳 Konfirmasi Pembayaran",
  admin_set_resi: "🚚 Input Resi",
  admin_set_status: "🔄 Ubah Status Order",
  admin_set_greeting: "💬 Ubah Greeting",
  admin_set_payment: "💳 Ubah Rekening Pembayaran",
  admin_set_help: "❓ Ubah Text Bantuan",
  admin_upload_video: "🎥 Upload Video Bantuan",
};

/**
 * Return merged buttons object (defaults overridden by saved labels in Redis)
 * usage: const buttons = await getButtons();
 */
async function getButtons() {
  const result = { ...DEFAULT_BUTTONS };

  const keys = Object.keys(DEFAULT_BUTTONS);

  for (const key of keys) {
    try {
      const savedLabel = await buttonService.getButtonLabel(key);
      if (savedLabel) {
        result[key] = savedLabel; // Override default
      }
    } catch (e) {
      console.error("Failed to load button label:", key, e);
    }
  }

  return result;
}

module.exports = {
  DEFAULT_BUTTONS,
  getButtons,
};
