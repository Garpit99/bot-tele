// config/editableTexts.js
module.exports = {
  greeting: "👋 Halo! Selamat datang di toko kami.",
  order_created: 
`✅ Pesanan kamu berhasil dibuat!

🧾 Order ID: {{orderId}}
📦 Produk: {{productName}}
💲 Harga: Rp{{price}}
📞 Kontak: {{contact}}
🏠 Alamat: {{address}}

Silakan lakukan pembayaran ke rekening berikut:

🏦 {{bankName}}
Nomor: {{bankNumber}}
A/N: {{bankOwner}}

📸 Setelah transfer, kirim bukti pembayaran ke sini.`,
  
  payment_instruction:
`🏦 Silakan lakukan pembayaran:

Bank: {{bankName}}
Nomor: {{bankNumber}}
A/N: {{bankOwner}}

Jika sudah bayar, kirim bukti transfer.`,
  
  admin_menu: "📋 Panel Admin — pilih aksi:",
  error: "❌ Terjadi kesalahan. Silakan coba lagi.",
  order_paid: "💰 Pembayaran sudah dikonfirmasi!",
  order_shipped: "🚚 Pesanan kamu sudah dikirim! Resi: {{resi}}",
  order_status_update: "🔄 Status order kamu: {{status}}",
};
