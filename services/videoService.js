const { getClient } = require('../db/database');

const VIDEO_SET = 'videos';

/* ============================================================
   🧩 Pastikan SET valid
============================================================ */
async function ensureValidSet(client) {
  const type = await client.type(VIDEO_SET);

  if (type !== 'set' && type !== 'none') {
    await client.del(VIDEO_SET);
    await client.sAdd(VIDEO_SET, 'TMP');
    await client.sRem(VIDEO_SET, 'TMP');
  }
}

/* ============================================================
   🔧 Normalisasi video
============================================================ */
function normalizeVideo(data) {
  let links = [];

  if (Array.isArray(data.links)) {
    links = data.links;
  } else if (typeof data.links === 'string') {
    try {
      const parsed = JSON.parse(data.links);
      links = Array.isArray(parsed) ? parsed : [data.links];
    } catch {
      links = data.links ? [data.links] : [];
    }
  }

  return {
    id: data.id,
    title: data.title,
    description: data.description || "",
    duration: Number(data.duration || 0),
    categoryId: data.categoryId || null,
    links,
  };
}

/* ============================================================
   ➕ Tambah Video ke dalam Category
============================================================ */
async function createVideo({ id, title, description = "", duration = 0, categoryId, links = [] }) {
  const client = getClient();
  await ensureValidSet(client);

  const key = `video:${id}`;
  const linksKey = `video_links:${id}`;

  const exists = await client.sIsMember(VIDEO_SET, id.toString());
  if (exists) return false;

  await client.hSet(key, {
    id: id.toString(),
    title,
    description,
    duration: Number(duration),
    categoryId: categoryId?.toString() || "",
    links: JSON.stringify(links),
  });

  if (links.length > 0) {
    await client.del(linksKey);
    await client.sAdd(linksKey, links);
  }

  await client.sAdd(VIDEO_SET, id.toString());

  // Tambahkan video ke kategori
  if (categoryId) {
    await client.sAdd(`category_videos:${categoryId}`, id.toString());
  }

  return true;
}

/* ============================================================
   🗑 Hapus Video
============================================================ */
async function deleteVideo(id) {
  const client = getClient();

  const data = await client.hGetAll(`video:${id}`);
  if (data.categoryId) {
    await client.sRem(`category_videos:${data.categoryId}`, id.toString());
  }

  await client.del(`video:${id}`);
  await client.del(`video_links:${id}`);
  await client.sRem(VIDEO_SET, id.toString());
}

/* ============================================================
   📦 Ambil Semua Video
============================================================ */
async function listVideos() {
  const client = getClient();
  await ensureValidSet(client);

  const ids = await client.sMembers(VIDEO_SET);
  const result = [];

  for (const id of ids) {
    const data = await client.hGetAll(`video:${id}`);
    if (data.id) result.push(normalizeVideo(data));
  }

  return result;
}

/* ============================================================
   📦 Ambil Semua Video berdasarkan Category
============================================================ */
async function listVideosByCategory(categoryId) {
  const client = getClient();

  const ids = await client.sMembers(`category_videos:${categoryId}`);
  const result = [];

  for (const id of ids) {
    const data = await client.hGetAll(`video:${id}`);
    if (data.id) result.push(normalizeVideo(data));
  }

  return result;
}

/* ============================================================
   🔍 Ambil 1 Video
============================================================ */
async function getVideo(id) {
  const client = getClient();

  const data = await client.hGetAll(`video:${id}`);
  if (!data.id) return null;

  const video = normalizeVideo(data);
  const randomLink = await client.sRandMember(`video_links:${id}`);

  return {
    ...video,
    link: randomLink || null,
  };
}

/* ============================================================
   🔍 Ambil lengkap (editing)
============================================================ */
async function getVideoById(id) {
  const client = getClient();

  const data = await client.hGetAll(`video:${id}`);
  if (!data.id) return null;

  const video = normalizeVideo(data);
  video.links = await client.sMembers(`video_links:${id}`);

  return video;
}

/* ============================================================
   ✏️ Update Video
============================================================ */
async function updateVideo(id, data) {
  const client = getClient();

  const key = `video:${id}`;
  const exists = await client.exists(key);

  if (!exists) return false;

  const old = await client.hGetAll(key);
  const oldCategory = old.categoryId;

  let newLinks = [];
  if (Array.isArray(data.links)) {
    newLinks = data.links;
  } else if (typeof data.links === "string") {
    newLinks = data.links.split(',').map(v => v.trim()).filter(Boolean);
  }

  const newCategory = data.categoryId?.toString() || "";

  await client.hSet(key, {
    id: id.toString(),
    title: data.title || "",
    description: data.description || "",
    duration: Number(data.duration || 0),
    categoryId: newCategory,
    links: JSON.stringify(newLinks),
  });

  // Update link SET
  await client.del(`video_links:${id}`);
  if (newLinks.length > 0) await client.sAdd(`video_links:${id}`, newLinks);

  // Update kategori
  if (oldCategory && oldCategory !== newCategory) {
    await client.sRem(`category_videos:${oldCategory}`, id.toString());
  }
  if (newCategory) {
    await client.sAdd(`category_videos:${newCategory}`, id.toString());
  }

  return true;
}

module.exports = {
  createVideo,
  deleteVideo,
  listVideos,
  listVideosByCategory,
  getVideo,
  getVideoById,
  updateVideo,
};
