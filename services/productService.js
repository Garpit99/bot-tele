const { getClient } = require('../db/database');
const PRODUCT_SET = 'products';

/* ============================================================
   🧩 Pastikan SET valid
============================================================ */
async function ensureValidSet(client) {
  const type = await client.type(PRODUCT_SET);
  if (type !== 'set' && type !== 'none') {
    await client.del(PRODUCT_SET);
    await client.sAdd(PRODUCT_SET, 'TMP');
    await client.sRem(PRODUCT_SET, 'TMP');
  }
}

/* ============================================================
   🔧 Normalisasi produk agar aman dipakai bot
============================================================ */
function normalizeProduct(data) {
  if (!data) return null;

  let links = [];

  // links bisa berupa string, array, JSON, atau null
  if (Array.isArray(data.links)) {
    links = data.links;
  } else if (typeof data.links === 'string') {
    try {
      links = JSON.parse(data.links);
      if (!Array.isArray(links)) links = [data.links];
    } catch {
      links = data.links ? [data.links] : [];
    }
  }

  return {
    id: data.id,
    name: data.name,
    price: Number(data.price || 0),
    stock: Number(data.stock || 0),
    description: data.description || '',
    links,
  };
}

/* ============================================================
   ➕ Tambah Produk
============================================================ */
async function createProduct({ id, name, price, stock = 0, description = '', links = [] }) {
  const client = getClient();
  await ensureValidSet(client);

  const key = `product:${id}`;
  const linksKey = `product_links:${id}`;

  // Cek dulu apakah ID sudah dipakai
  const exists = await client.sIsMember(PRODUCT_SET, id.toString());
  if (exists) return false;

  await client.hSet(key, {
    id: id.toString(),
    name,
    price,
    stock,
    description,
    links: JSON.stringify(links),
  });

  await client.del(linksKey);
  if (links.length > 0) await client.sAdd(linksKey, links);

  await client.sAdd(PRODUCT_SET, id.toString());

  return true;   // ← FIX UTAMA
}

/* ============================================================
   🗑 Hapus Produk
============================================================ */
async function deleteProduct(id) {
  const client = getClient();
  await client.del(`product:${id}`);
  await client.del(`product_links:${id}`);
  await client.sRem(PRODUCT_SET, id.toString());
}

/* ============================================================
   📦 Ambil Semua Produk
============================================================ */
async function listProducts() {
  const client = getClient();
  await ensureValidSet(client);

  const ids = await client.sMembers(PRODUCT_SET);
  if (!ids.length) return [];

  const result = [];

  for (const id of ids) {
    const data = await client.hGetAll(`product:${id}`);
    if (!data.id) continue;

    result.push(normalizeProduct(data));
  }

  return result;
}

/* ============================================================
   🔍 Ambil Produk (untuk User)
============================================================ */
async function getProduct(id) {
  const client = getClient();
  const data = await client.hGetAll(`product:${id}`);
  if (!data.id) return null;

  const product = normalizeProduct(data);

  const randomLink = await client.sRandMember(`product_links:${id}`);
  return {
    ...product,
    link: randomLink || null,
  };
}

/* ============================================================
   🔍 Ambil Produk Lengkap (untuk Edit)
============================================================ */
async function getProductById(id) {
  const client = getClient();
  const data = await client.hGetAll(`product:${id}`);
  if (!data.id) return null;

  const product = normalizeProduct(data);
  const links = await client.sMembers(`product_links:${id}`);

  product.links = links;

  return product;
}

/* ============================================================
   ✏️ Update Produk
============================================================ */
async function updateProduct(id, data) {
  const client = getClient();
  await ensureValidSet(client);

  id = id.toString();
  const key = `product:${id}`;
  const linksKey = `product_links:${id}`;

  // Cek keberadaan produk lewat hash dan SET
  const hashExists = await client.exists(key);
  const setExists = await client.sIsMember(PRODUCT_SET, id);

  if (!hashExists && !setExists) {
    console.log("❌ PRODUK TIDAK DITEMUKAN:", id);
    return false;
  }

  // Normalisasi links
  let newLinks = [];
  if (Array.isArray(data.links)) {
    newLinks = data.links;
  } else if (typeof data.links === "string") {
    newLinks = data.links.split(",").map(v => v.trim()).filter(v => v.length);
  }

  // Update HASH
  await client.hSet(key, {
    id,
    name: data.name || "",
    price: Number(data.price || 0),
    stock: Number(data.stock || 0),
    description: data.description || "",
    links: JSON.stringify(newLinks),
  });

  // Update SET links
  await client.del(linksKey);
  if (newLinks.length > 0) await client.sAdd(linksKey, newLinks);

  // Pastikan ID ada di SET products
  await client.sAdd(PRODUCT_SET, id);

  return true;
}

/* ============================================================
   🔗 Update link saja
============================================================ */
async function setProductLinks(id, links) {
  const client = getClient();

  await client.del(`product_links:${id}`);
  if (links.length > 0) await client.sAdd(`product_links:${id}`, links);

  await client.hSet(`product:${id}`, {
    links: JSON.stringify(links),
  });
}

module.exports = {
  createProduct,
  deleteProduct,
  listProducts,
  getProduct,
  getProductById,
  updateProduct,
  setProductLinks,
};
