// services/settingsService.js
const { getClient } = require('../db/database');

const SETTINGS_KEY = 'bot_settings';
let isChecked = false;
let cache = {};
/**
 * 🧩 Pastikan key 'bot_settings' bertipe hash agar tidak error WRONGTYPE
 */

async function ensureSettingsHash(client) {
  if (isChecked) return;

  try {
    const type = await client.type(SETTINGS_KEY);

    if (type !== 'hash' && type !== 'none') {
      console.warn(`⚠️ Key '${SETTINGS_KEY}' salah tipe (${type}), reset...`);
      await client.del(SETTINGS_KEY);
    }

    isChecked = true;
    console.log("✅ Settings hash ready");
  } catch (err) {
    console.error('❌ ensureSettingsHash() error:', err.message);
  }
}
/**
 * 🔍 Ambil setting dari Redis
 */
async function getSetting(key) {
  try {
    if (cache[key] !== undefined) return cache[key];

    const client = getClient();
    if (!client) return null;

    await ensureSettingsHash(client);

    const val = await client.hGet(SETTINGS_KEY, key);
    cache[key] = val;

    return val;

  } catch (err) {
    console.error("❌ getSetting error:", err.message);
    return null;
  }
}
/**
 * 💾 Simpan/update setting + update cache
 */
async function setSetting(key, value) {
  try {
    const client = getClient();
    if (!client) return;

    await ensureSettingsHash(client);

    const stringValue = String(value);

    await client.hSet(SETTINGS_KEY, {
      [key]: stringValue
    });

    cache[key] = stringValue; // ✅ sync cache

    console.log(`✅ Setting '${key}' disimpan`);

  } catch (err) {
    console.error("❌ setSetting error:", err.message);
  }
}

module.exports = {
  getSetting,
  setSetting,
};
