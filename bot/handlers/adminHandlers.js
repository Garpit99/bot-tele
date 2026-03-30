const productService = require('../../services/productService')
const orderService = require('../../services/orderService')
const settingsService = require('../../services/settingsService')
const buttonService = require('../../services/buttonService')
const { Markup } = require('telegraf')

/* =================================================
UTILS
================================================= */

function ensureSession(ctx){
  if(!ctx.session) ctx.session={}
}

function chunk(arr,size){
  const res=[]
  for(let i=0;i<arr.length;i+=size)
    res.push(arr.slice(i,i+size))
  return res
}

function parseKeyValue(text){

  const lines=text.split(/\n/).map(x=>x.trim())
  const obj={}

  for(const line of lines){

    const i=line.indexOf(":")
    if(i===-1) continue

    const k=line.slice(0,i).trim().toLowerCase()
    const v=line.slice(i+1).trim()

    obj[k]=v
  }

  return obj
}

function sanitizeId(data){
  return data.replace(/[^\w\-]/g,"")
}

/* =================================================
BUTTON DEFAULT
================================================= */

const BUTTONS={

BTN_ADMIN_ADD_PRODUCT:"➕ Tambah Produk",
BTN_ADMIN_EDIT_PRODUCT:"✏️ Edit Produk",
BTN_ADMIN_DELETE_PRODUCT:"🗑 Hapus Produk",

BTN_ADMIN_LIST_ORDERS:"📦 List Order",
BTN_ADMIN_CONFIRM_PAYMENT:"💳 Konfirmasi Pembayaran",

BTN_ADMIN_SET_RESI:"🚚 Input Resi",
BTN_ADMIN_SET_STATUS:"🔄 Ubah Status",

BTN_ADMIN_SET_GREETING:"💬 Ubah Greeting",
BTN_ADMIN_SET_PAYMENT:"💳 Ubah Pembayaran",

BTN_ADMIN_SET_CHAT_TEXT:"💬 Text Chat Admin",
BTN_ADMIN_SET_VIDEO_TEXT:"🎥 Caption Video",

BTN_ADMIN_UPLOAD_CHECKOUT_VIDEO:"🎬 Upload Video",
BTN_ADMIN_DELETE_CHECKOUT_VIDEO:"🗑 Hapus Video"

}

try{
buttonService.setDefaultButtons(BUTTONS)
}catch(e){}

/* =================================================
ADMIN MENU
================================================= */

async function showAdminMenu(ctx){

const buttons=Object.keys(BUTTONS).map(k=>
Markup.button.callback(BUTTONS[k],k.replace("BTN_",""))
)

const keyboard=chunk(buttons,3)

await ctx.reply(
"📋 Panel Admin",
{reply_markup:{inline_keyboard:keyboard}}
)

}

/* =================================================
ADD PRODUCT
================================================= */

async function addProduct(ctx){
  ensureSession(ctx)
  resetSession(ctx) // ✅ TAMBAHKAN

  ctx.session.awaitingAddProduct = true

await ctx.reply(
`Kirim data produk:

id:
nama:
harga:
stock:
deskripsi:
link1:
link2:
link3:`
)

}

async function handleAddProduct(ctx){

if(!ctx.session.awaitingAddProduct) return

try{

const obj=parseKeyValue(ctx.message.text)

const product={

id:obj.id,
name:obj.nama,
price:Number(obj.harga),
stock:Number(obj.stock),
description:obj.deskripsi||"",
links:[]

}

for(const k of ["link1","link2","link3"])
if(obj[k]) product.links.push(obj[k])

await productService.createProduct(product)

await ctx.reply("✅ Produk berhasil ditambahkan")

}catch(err){

console.log(err)
await ctx.reply("❌ gagal tambah produk")

}

ctx.session.awaitingAddProduct=false

}

/* =================================================
EDIT PRODUCT
================================================= */

async function showEditProductMenu(ctx){

const products=await productService.listProducts()

if(!products.length)
return ctx.reply("Produk kosong")

for(const p of products){

const msg=
`📦 ${p.id}
Nama: ${p.name}
Harga: ${p.price}
Stock: ${p.stock}`

const keyboard=[[
Markup.button.callback("✏️ Edit",`EDIT_PROD_${p.id}`),
Markup.button.callback("🗑 Hapus",`DEL_PROD_${p.id}`)
]]

await ctx.reply(msg,{reply_markup:{inline_keyboard:keyboard}})

}

}

async function handleSelectProductToEdit(ctx){

ensureSession(ctx)

const id=sanitizeId(ctx.callbackQuery.data.replace("EDIT_PROD_",""))

ctx.session.awaitingEditProduct=id

await ctx.reply("Kirim data baru produk")

}

async function handleEditProduct(ctx){

const id=ctx.session.awaitingEditProduct
if(!id) return

try{

const obj=parseKeyValue(ctx.message.text)

await productService.updateProduct(id,obj)

await ctx.reply("✅ produk diupdate")

}catch(e){

ctx.reply("❌ gagal update")

}

ctx.session.awaitingEditProduct=false

}

/* =================================================
DELETE PRODUCT
================================================= */

async function showDeleteProductMenu(ctx){

const products=await productService.listProducts()

for(const p of products){

const kb=[[
Markup.button.callback("Hapus",`CONFIRM_DEL_${p.id}`)
]]

await ctx.reply(
`Hapus produk ${p.id}?`,
{reply_markup:{inline_keyboard:kb}}
)

}

}

async function handleConfirmDeleteProduct(ctx){

const id=sanitizeId(ctx.callbackQuery.data.replace("CONFIRM_DEL_",""))

await productService.deleteProduct(id)

await ctx.reply("🗑 produk dihapus")

}

/* =================================================
ORDERS
================================================= */

async function listOrders(ctx){

const orders=await orderService.listOrders()

if(!orders.length)
return ctx.reply("Belum ada order")

let msg="📦 LIST ORDER\n\n"

for(const o of orders)
msg+=`${o.id} | ${o.status}\n`

await ctx.reply(msg)

}

async function confirmPayment(ctx){

ensureSession(ctx)
ctx.session.awaitingConfirmOrder=true

ctx.reply("Kirim ID order")

}

async function handleConfirmPayment(ctx){

if(!ctx.session.awaitingConfirmOrder) return

const id=ctx.message.text

await orderService.confirmPayment(id)

ctx.session.awaitingConfirmOrder=false

ctx.reply("✅ pembayaran dikonfirmasi")

}

/* =================================================
SETTINGS
================================================= */

async function setGreeting(ctx){
  ensureSession(ctx)
  resetSession(ctx) // ✅ TAMBAHKAN

  ctx.session.awaitingSetGreeting = true

  ctx.reply("Kirim greeting baru")
}

}

async function handleSetGreetingText(ctx){

if(!ctx.session.awaitingSetGreeting) return

await settingsService.setSetting("greeting",ctx.message.text)

ctx.session.awaitingSetGreeting=false

ctx.reply("✅ greeting diupdate")

}

async function setChatAdminText(ctx){
  ensureSession(ctx)
  resetSession(ctx) // ✅ TAMBAHKAN INI

  ctx.session.awaitingChatText = true

  await ctx.reply("✍️ Kirim text chat admin")
}

async function handleSetChatAdminText(ctx){

if(!ctx.session.awaitingChatText) return

await settingsService.setSetting(
"help_chat_text",
ctx.message.text
)

ctx.session.awaitingChatText=false

ctx.reply("✅ text chat admin diupdate")

}

/* =================================================
VIDEO
================================================= */

async function uploadCheckoutVideo(ctx){

ensureSession(ctx)
ctx.session.awaitingCheckoutVideo=true

ctx.reply("Kirim video")

}

async function handleUploadCheckoutVideo(ctx){

if(!ctx.session.awaitingCheckoutVideo) return

const fileId=ctx.message.video.file_id

await settingsService.setSetting(
"help_checkout_video",
fileId
)

ctx.session.awaitingCheckoutVideo=false

ctx.reply("✅ video tersimpan")

}


// ================= DELETE VIDEO =================
async function deleteCheckoutVideo(ctx){
  try{
    const videoData = await settingsService.getSetting("help_checkout_video");

    if (!videoData)
      return ctx.reply("❌ Tidak ada video.");

    await ctx.replyWithVideo(videoData,{
      caption:"⚠️ Yakin hapus video?",
      reply_markup:{
        inline_keyboard:[[
          {text:"✅ Ya",callback_data:"CONFIRM_DELETE_VIDEO"},
          {text:"❌ Batal",callback_data:"CANCEL_DELETE_VIDEO"}
        ]]
      }
    });

  }catch(e){
    console.log(e)
    ctx.reply("❌ error preview")
  }
}

async function handleConfirmDeleteVideo(ctx){
  await settingsService.setSetting("help_checkout_video","")
  await ctx.editMessageCaption("🗑 Video dihapus")
}

async function handleCancelDeleteVideo(ctx){
  await ctx.editMessageCaption("❌ Dibatalkan")
}

// ===== TAMBAHAN AGAR INDEX TIDAK ERROR =====
function notImplemented(ctx){
  return ctx.reply("⚠️ Fitur belum tersedia")
}

async function setHelpIntro(ctx){ return notImplemented(ctx) }
async function setCheckoutVideoCaption(ctx){ return notImplemented(ctx) }
async function handleCancelDeleteProduct(ctx){ return notImplemented(ctx) }
async function setResi(ctx){ return notImplemented(ctx) }
async function setStatus(ctx){ return notImplemented(ctx) }
async function setPaymentInfo(ctx){ return notImplemented(ctx) }
async function showSetButtonsMenu(ctx){ return notImplemented(ctx) }
async function handleSelectButtonToEdit(ctx){ return notImplemented(ctx) }
async function handleSelectDeleteProduct(ctx){ return notImplemented(ctx) }

/*===== Reset Session=====*/

function resetSession(ctx){
  ctx.session.awaitingAddProduct = false
  ctx.session.awaitingEditProduct = false
  ctx.session.awaitingConfirmOrder = false
  ctx.session.awaitingSetGreeting = false
  ctx.session.awaitingChatText = false
  ctx.session.awaitingCheckoutVideo = false
}

/* =================================================
EXPORT
================================================= */

module.exports = {

BUTTONS,

showAdminMenu,

addProduct,
handleAddProduct,

showEditProductMenu,
handleSelectProductToEdit,
handleEditProduct,
  handleCancelDeleteProduct,

showDeleteProductMenu,
handleConfirmDeleteProduct,

listOrders,
confirmPayment,
handleConfirmPayment,

setGreeting,
handleSetGreetingText,
  setHelpIntro,
  setChatAdminText,
  handleSetChatAdminText,


setCheckoutVideoCaption,
uploadCheckoutVideo,
handleUploadCheckoutVideo,

deleteCheckoutVideo,
handleConfirmDeleteVideo,
handleCancelDeleteVideo

  
};
