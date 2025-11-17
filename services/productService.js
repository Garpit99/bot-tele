// services/productService.js
const { link } = require('telegraf/format');
const { getClient } = require('../db/database');
const PRODUCT_SET = 'products';

/**
 * 🧩 Pastikan key 'products' adalah set
 */
async function ensureValidSet(client) {
  const type = await client.type(PRODUCT_SET);
  if (type !== 'set' && type !== 'none') {
    console.warn(`⚠️ Key '${PRODUCT_SET}' invalid type: ${type}. Direset...`);
    await client.del(PRODUCT_SET);
    await client.sAdd(PRODUCT_SET, 'TEMP_FIX');
    await client.sRem(PRODUCT_SET, 'TEMP_FIX');
    console.log(`✅ '${PRODUCT_SET}' diinisialisasi ulang sebagai SET`);
  }
}

/**
 * 🧱 Tambah produk baru (dengan multi-link)
 */
async function createProduct({ id, name, price, stock = 0, description = '', links = [] }) {
  const client = getClient();
  if (!client) throw new Error('❌ Redis client belum terhubung');

  await ensureValidSet(client);

  const key = `product:${id}`;
  const linksKey = `product_links:${id}`;
  const type = await client.type(key);

  // Hapus kalau bukan hash
  if (type && type !== 'none' && type !== 'hash') {
    console.warn(`⚠️ ${key} tipe ${type} bukan hash — dihapus otomatis`);
    await client.del(key);
  }

  // Simpan data produk utama
  await client.hSet(key, {
    id: String(id),
    name: String(name),
    price: String(price),
    stock: String(stock),
    description: String(description),
    links: String(links),
  });

  // Simpan link ke set terpisah
  if (Array.isArray(links) && links.length > 0) {
    await client.del(linksKey); // reset dulu
    await client.sAdd(linksKey, links);
    console.log(`🔗 ${links.length} link disimpan untuk ${id}`);
  }

  await client.sAdd(PRODUCT_SET, id);
  console.log(`✅ Produk ${id} disimpan`);
}

/**
 * ❌ Hapus produk
 */
async function deleteProduct(id) {
  const client = getClient();
  if (!client) throw new Error('❌ Redis client belum terhubung');

  await client.del(`product:${id}`);
  await client.del(`product_links:${id}`);
  await client.sRem(PRODUCT_SET, id);
  console.log(`🗑 Produk ${id} dihapus`);
}

/**
 * 📦 Ambil semua produk (tanpa link)
 */
async function listProducts() {
  const client = getClient();
  if (!client) throw new Error('❌ Redis client belum terhubung');

  await ensureValidSet(client);
  const ids = await client.sMembers(PRODUCT_SET);
  if (!ids || ids.length === 0) return [];

  const result = [];
  for (const id of ids) {
    const key = `product:${id}`;
    const type = await client.type(key);

    if (type !== 'hash') {
      await client.del(key);
      await client.sRem(PRODUCT_SET, id);
      continue;
    }

    const data = await client.hGetAll(key);
    if (!data || !data.id) continue;

    result.push({
      id: data.id,
      name: data.name,
      price: Number(data.price || 0),
      stock: Number(data.stock || 0),
      description: data.description || '',
      links: data.links || '',
    });
  }

  return result;
}

/**
 * 🔍 Ambil produk by ID + satu link acak
 */
async function getProduct(id) {
  const client = getClient();
  if (!client) throw new Error('❌ Redis client belum terhubung');

  const key = `product:${id}`;
  const type = await client.type(key);

  if (type !== 'hash') {
    await client.del(key);
    return null;
  }

  const data = await client.hGetAll(key);
  if (!data || !data.id) return null;

  // Ambil satu link acak
  const randomLink = await client.sRandMember(`product_links:${id}`);

  return {
    id: data.id,
    name: data.name,
    price: Number(data.price || 0),
    stock: Number(data.stock || 0),
    description: data.description || '',
    link: randomLink || null,
  };
}

  /**
 * Update product (mengganti data hash + set links)
 * Mengembalikan true jika berhasil, false jika produk tidak ditemukan.
 */
async function updateProduct(id, data) {
  const client = getClient();

  // Pastikan set
  await ensureValidSet(client);

  const exists = await client.sIsMember(PRODUCT_SET, id.toString());
  if (!exists) return false;

  const key = `product:${id}`;

  await client.hSet(key, {
    name: data.name,
    price: data.price,
    stock: data.stock,
    description: data.description,
    links: JSON.stringify(data.links || [])
  });

  return true;
}


module.exports = {
  createProduct,
  deleteProduct,
  listProducts,
  getProduct,
  updateProduct,
};
