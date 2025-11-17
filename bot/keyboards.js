function mainMenu(isAdmin = false) {
  const base = [
    [{ text: 'Lihat Produk', callback_data: 'VIEW_PRODUCTS' }],
    [{ text: 'Tracking Order', callback_data: 'TRACK_ORDER' }]
  ];
  if (isAdmin) base.unshift([{ text: 'Admin Panel', callback_data: 'ADMIN_PANEL' }]);
  return { reply_markup: { inline_keyboard: base } };
}

module.exports = { mainMenu };
