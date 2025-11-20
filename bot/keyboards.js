const buttonService = require("../services/buttonService");

/* ============================
   GET BUTTON LABEL
============================ */
async function getBtn(key) {
  const defaults = {
    BTN_VIEW_PRODUCTS: "🛍️ Lihat Produk",
    BTN_TRACK_ORDER: "📦 Tracking Order",
    BTN_HELP: "❓ Bantuan",
    BTN_ADMIN_PANEL: "⚙️ Admin Panel",
  };

  const saved = await buttonService.getButtonLabel(key);
  return saved || defaults[key];
}

/* ============================
        MAIN MENU
============================ */
async function mainMenu(isAdmin = false) {
  const btnView = await getBtn("BTN_VIEW_PRODUCTS");
  const btnTrack = await getBtn("BTN_TRACK_ORDER");
  const btnHelp = await getBtn("BTN_HELP");

  const keyboard = [
    [{ text: btnView, callback_data: "VIEW_PRODUCTS" }],
    [{ text: btnTrack, callback_data: "TRACK_ORDER" }],
    [{ text: btnHelp, callback_data: "HELP_MENU" }],
  ];

  if (isAdmin) {
    keyboard.unshift([
      { text: await getBtn("BTN_ADMIN_PANEL"), callback_data: "ADMIN_PANEL" },
    ]);
  }

  return {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  };
}

module.exports = { mainMenu };
