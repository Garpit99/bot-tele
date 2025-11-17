const { getClient } = require('../db/database');
const BUTTON_KEY_PREFIX = "button_label:";

// Fungsi ini menerima objek BUTTONS dari adminHandler bila dibutuhkan
let DEFAULT_BUTTONS = {};

function setDefaultButtons(defaults) {
  DEFAULT_BUTTONS = defaults;
}

/* ===============================
   GET LABEL BUTTON (with fallback)
================================ */
async function getButtonLabel(key) {
  const client = await getClient();
  const value = await client.get(BUTTON_KEY_PREFIX + key);

  // jika belum ada di DB → pakai default dari adminHandler
  return value || DEFAULT_BUTTONS[key] || null;
}

/* ===============================
   SET LABEL BUTTON
================================ */
async function setButtonLabel(key, value) {
  const client = await getClient();
  await client.set(BUTTON_KEY_PREFIX + key, value);
  return true;
}

/* ===============================
   GET ALL SAVED CUSTOM BUTTONS ONLY
================================ */
async function getAllButtons() {
  const client = await getClient();
  const keys = await client.keys(BUTTON_KEY_PREFIX + "*");

  const result = {};
  for (const key of keys) {
    const originalKey = key.replace(BUTTON_KEY_PREFIX, "");
    result[originalKey] = await client.get(key);
  }

  return result;
}

/* ===============================
   GET ALL BUTTONS WITH DEFAULTS
   (custom + default)
================================ */
async function getAllButtonsWithDefaults() {
  const saved = await getAllButtons();
  const all = {};

  for (const key of Object.keys(DEFAULT_BUTTONS)) {
    all[key] = saved[key] || DEFAULT_BUTTONS[key];
  }

  return all;
}

module.exports = {
  setDefaultButtons,
  getButtonLabel,
  setButtonLabel,
  getAllButtons,
  getAllButtonsWithDefaults,
};
