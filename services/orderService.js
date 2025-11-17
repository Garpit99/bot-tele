// services/orderService.js
const { getClient } = require('../db/database');

const ORDER_SET = 'orders';

function orderKey(id) {
  return `order:${id}`;
}

/**
 * 🧾 Buat order baru
 */
async function createOrder({
  id,
  userId,
  productId,
  productName,
  price,
  name,
  address,
  phone,
  status = 'pending',
  date = new Date().toISOString(),
}) {
  const client = getClient();
  if (!client) throw new Error('❌ Redis client belum terhubung!');

  const key = orderKey(id);
  await client.hSet(key, {
    id,
    userId: String(userId),
    productId: String(productId),
    productName: productName || '',
    price: String(price || 0),
    name: name || '',
    address: address || '',
    phone: phone || '',
    status,
    date,
  });

  await client.sAdd(ORDER_SET, id);
  return id;
}

/**
 * 📄 Ambil detail order
 */
async function getOrder(id) {
  const client = getClient();
  if (!client) throw new Error('❌ Redis client belum terhubung!');

  const data = await client.hGetAll(orderKey(id));
  return data && data.id ? data : null;
}

/**
 * 🔄 Update order
 */
async function updateOrder(id, patch) {
  const client = getClient();
  if (!client) throw new Error('❌ Redis client belum terhubung!');

  const flat = {};
  for (const key in patch) {
    flat[key] =
      typeof patch[key] === 'object' ? JSON.stringify(patch[key]) : String(patch[key]);
  }

  await client.hSet(orderKey(id), flat);
}

/**
 * 📋 Daftar semua order
 */
async function listOrders() {
  const client = getClient();
  if (!client) throw new Error('❌ Redis client belum terhubung!');

  const ids = await client.sMembers(ORDER_SET);
  const orders = [];
  for (const id of ids) {
    const data = await getOrder(id);
    if (data) orders.push(data);
  }
  return orders;
}

/**
 * 👤 Daftar order berdasarkan userId
 */
async function listOrdersByUser(userId) {
  const all = await listOrders();
  return all.filter((o) => String(o.userId) === String(userId));
}

module.exports = {
  createOrder,
  getOrder,
  updateOrder,
  listOrders,
  listOrdersByUser,
};
