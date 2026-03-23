const productService = require('../../services/productService');
const orderService = require('../../services/orderService');
const settingsService = require('../../services/settingsService');
const buttonService = require('../../services/buttonService');
const { Markup } = require('telegraf');


/* =================================================
   UTILS
================================================= */

function ensureSession(ctx) {
  if (!ctx.session) ctx.session = {};
}

function chunkArray(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

function parseKeyValueText(text) {
  const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const obj = {};

  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    obj[key] = val;
  }

  return obj;
}

function sanitizeId(raw) {
  if (!raw) return '';
  raw = raw.replace(/^(EDIT_PROD_|DEL_PROD_|CONFIRM_DEL_|CANCEL_DEL_)/i, '');
  return raw.replace(/[^\w-]/g, '');
}


/* =================================================
   BUTTON DEFAULT
================================================= */

const BUTTONS = {

  BTN_VIEW_PRODUCTS: "🛍️ Lihat Produk",
  BTN_OPEN_LINK: "🌐 Buka Link Acak",
  BTN_BACK: "⬅️ Kembali",
  BTN_BUY: "🛒 Beli Produk Ini",

  BTN_HELP: "❓ Bantuan",
  BTN_HELP_TEXT: "📄 Bantuan (Teks)",
  BTN_HELP_VIDEO: "▶ Tonton Video Bantuan",

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

  BTN_ADMIN_SET_BUTTONS: "🔧 Ubah Nama Tombol",

  BTN_ADMIN_SET_CHAT_TEXT: "💬 Ubah Text Chat Admin",
  BTN_ADMIN_SET_VIDEO_TEXT: "🎥 Ubah Caption Video Checkout",

  BTN_ADMIN_UPLOAD_CHECKOUT_VIDEO: "🎬 Upload Video Checkout",
  BTN_ADMIN_DELETE_CHECKOUT_VIDEO: "🗑 Hapus Video Checkout",

};

try {
  buttonService.setDefaultButtons(BUTTONS);
} catch (err) {
  console.error("setDefaultButtons error", err);
}

async function getBtn(key) {
  try {
    return (await buttonService.getButtonLabel(key)) || BUTTONS[key];
  } catch {
    return BUTTONS[key];
  }
}


/* =================================================
   ADMIN MENU
================================================= */

async function showAdminMenu(ctx) {

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

    "BTN_ADMIN_SET_BUTTONS",
    "BTN_ADMIN_SET_CHAT_TEXT",

    "BTN_ADMIN_SET_VIDEO_TEXT",
    "BTN_ADMIN_UPLOAD_CHECKOUT_VIDEO",
    "BTN_ADMIN_DELETE_CHECKOUT_VIDEO",

  ];

  const buttons = await Promise.all(
    keys.map(async key =>
      Markup.button.callback(
        await getBtn(key),
        key.replace("BTN_", "")
      )
    )
  );

  const keyboard = chunkArray(buttons, 3);

  await ctx.reply("📋 *Panel Admin*", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard }
  });

}


/* =================================================
   ADD PRODUCT
================================================= */

async function addProduct(ctx) {

  ensureSession(ctx);
  ctx.session.awaitingAddProduct = true;

  await ctx.reply(
`🧾 Kirim data produk:

id:
nama:
harga:
stock:
deskripsi:
link1:
link2:
link3:`
  );

}

async function handleAddProduct(ctx) {

  ensureSession(ctx);

  if (!ctx.session.awaitingAddProduct) return;

  try {

    const obj = parseKeyValueText(ctx.message.text);

    if (!obj.id || !obj.nama || !obj.harga || !obj.stock)
      return ctx.reply("❌ Format salah");

    const product = {

      id: obj.id,
      name: obj.nama,
      price: Number(obj.harga),
      stock: Number(obj.stock),
      description: obj.deskripsi || "",
      links: []

    };

    ["link1","link2","link3"].forEach(k=>{
      if(obj[k]) product.links.push(obj[k])
    });

    await productService.createProduct(product);

    await ctx.reply(`✅ Produk *${product.id}* ditambahkan`,{
      parse_mode:"Markdown"
    });

  } catch (err) {

    console.error(err);
    ctx.reply("❌ Error tambah produk");

  }

  ctx.session.awaitingAddProduct=false;

}


/* =================================================
   EDIT PRODUCT
================================================= */

async function showEditProductMenu(ctx){

  const products=await productService.listProducts();

  if(!products.length)
    return ctx.reply("📭 Tidak ada produk");

  for(const p of products){

    const msg=
`📦 *${p.id}*
Nama: ${p.name}
Harga: Rp${Number(p.price).toLocaleString('id-ID')}
Stock: ${p.stock}`;

    const keyboard=[[
      Markup.button.callback("✏️ Edit",`EDIT_PROD_${p.id}`),
      Markup.button.callback("🗑 Hapus",`DEL_PROD_${p.id}`)
    ]];

    await ctx.reply(msg,{
      parse_mode:"Markdown",
      reply_markup:{inline_keyboard:keyboard}
    });

  }

}

async function handleSelectProductToEdit(ctx){

  ensureSession(ctx)

  const id=sanitizeId(ctx.callbackQuery.data)

  ctx.session.awaitingEditProduct=id

  await ctx.reply(`✏️ Kirim data baru untuk ${id}`)

}


/* =================================================
   DELETE PRODUCT
================================================= */

async function handleConfirmDeleteProduct(ctx){

  const id=sanitizeId(ctx.callbackQuery.data)

  try{

    await productService.deleteProduct(id)

    await ctx.reply(`🗑 Produk *${id}* dihapus`,{
      parse_mode:"Markdown"
    })

  }catch(err){

    ctx.reply("❌ Gagal hapus produk")

  }

}


/* =================================================
   ORDER
================================================= */

async function listOrders(ctx){

  const orders=await orderService.listOrders()

  if(!orders.length)
    return ctx.reply("📭 Belum ada order")

  let msg="📦 *Daftar Order*\n\n"

  for(const o of orders){

    msg+=`📦 *${o.id}*\nStatus: ${o.status}\n\n`

  }

  await ctx.reply(msg,{parse_mode:"Markdown"})

}

async function confirmPayment(ctx){

  ensureSession(ctx)

  ctx.session.awaitingConfirmOrder=true

  ctx.reply("💳 Kirim ID order")

}

async function handleConfirmPayment(ctx){

  ensureSession(ctx)

  if(!ctx.session.awaitingConfirmOrder) return

  const id=ctx.message.text.trim()

  ctx.session.awaitingConfirmOrder=false

  await ctx.reply(`✅ Order *${id}* dikonfirmasi`,{
    parse_mode:"Markdown"
  })

}


/* =================================================
   SETTINGS
================================================= */

async function setGreeting(ctx){

  ensureSession(ctx)

  ctx.session.awaitingGreeting=true

  ctx.reply("Kirim greeting baru")

}

async function handleSetGreetingText(ctx){

  ensureSession(ctx)

  if(!ctx.session.awaitingGreeting) return

  await settingsService.setSetting("greeting",ctx.message.text)

  ctx.session.awaitingGreeting=false

  ctx.reply("✅ Greeting diupdate")

}


/* =================================================
   VIDEO CHECKOUT
================================================= */

async function uploadCheckoutVideo(ctx){

  ensureSession(ctx)

  ctx.session.awaitingVideo=true

  ctx.reply("Kirim video tutorial checkout")

}

async function handleUploadCheckoutVideo(ctx){

  ensureSession(ctx)

  if(!ctx.session.awaitingVideo) return

  if(!ctx.message.video)
    return ctx.reply("❌ kirim video")

  const fileId=ctx.message.video.file_id

  await settingsService.setSetting(
    "help_checkout_video",
    JSON.stringify({file_id:fileId})
  )

  ctx.session.awaitingVideo=false

  ctx.reply("✅ Video tersimpan")

}

async function deleteCheckoutVideo(ctx){

  await settingsService.setSetting(
    "help_checkout_video",
    JSON.stringify({})
  )

  ctx.reply("🗑 Video checkout dihapus")

}


/* =================================================
   EXPORT
================================================= */

module.exports={

  BUTTONS,

  showAdminMenu,

  addProduct,
  handleAddProduct,

  showEditProductMenu,
  handleSelectProductToEdit,
  handleConfirmDeleteProduct,

  listOrders,
  confirmPayment,
  handleConfirmPayment,

  setGreeting,
  handleSetGreetingText,

  uploadCheckoutVideo,
  handleUploadCheckoutVideo,
  deleteCheckoutVideo,

}
