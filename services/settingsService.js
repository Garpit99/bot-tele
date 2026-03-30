// services/settingsService.js
const { getClient } = require('../db/database');

const SETTINGS_KEY = 'bot_settings';

/**
 * 🧩 Pastikan key 'bot_settings' bertipe hash agar tidak error WRONGTYPE
 */
async function ensureSettingsHash(client) {
  try {
    const type = await client.type(SETTINGS_KEY);
    if (type !== 'hash' && type !== 'none') {
      console.warn(`⚠️ Key '${SETTINGS_KEY}' bertipe ${type}, bukan hash — melakukan reset...`);
      await client.del(SETTINGS_KEY);
      console.log(`✅ Key '${SETTINGS_KEY}' direset sebagai hash`);
    }
  } catch (err) {
    console.error('❌ ensureSettingsHash() error:', err);
  }
}

/**
 * 🔍 Ambil setting dari Redis
 */
async function getSetting(key) {
  const client = getClient();
  if (!client) {
    console.error('❌ Redis client belum terhubung!');
    return null;
  }

  await ensureSettingsHash(client);
  const val = await client.hGet(SETTINGS_KEY, key);
  return val || null;
}

/**
 * 💾 Simpan atau update setting ke Redis
 */
async function setSetting(key, value) {
  const client = getClient();
  if (!client) {
    console.error('❌ Redis client belum terhubung!');
    return;
  }

  await ensureSettingsHash(client);
  // Fix Redis v4+ syntax: hSet accepts object or fieldValue pairs
  await client.hSet(SETTINGS_KEY, {
    [key]: String(value)
  });
  console.log(`✅ Setting '${key}' disimpan: ${value}`);
}

// ✅ Ekspor fungsi
module.exports = {
  getSetting,
  setSetting,
};
