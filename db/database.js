const { createClient } = require('redis');

let client;

async function connect() {
  if (client) return client;

  console.log('🟡 Redis connecting...');

  const redisUrl = process.env.REDIS_URL;

  client = createClient({
    url: redisUrl,

    socket: {
      // 🔥 WAJIB untuk cloud Redis
      tls: redisUrl.startsWith('rediss://'),

      // 🔥 RECONNECT AGRESIF
      reconnectStrategy: (retries) => {
        console.log(`🔁 Reconnect Redis #${retries}`);
        return Math.min(retries * 300, 2000);
      },

      // 🔥 JAGA KONEKSI TETAP HIDUP
      keepAlive: 10000,
      connectTimeout: 10000,
    },
  });

  // ===== EVENTS =====
  client.on('error', (err) => {
    console.error('❌ Redis Error:', err.message);
  });

  client.on('ready', () => {
    console.log('✅ Redis ready');
  });

  client.on('end', () => {
    console.log('🔴 Redis disconnected');
    client = null;
  });

  client.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
  });

  await client.connect();

  return client;
}

function getClient() {
  return client;
}

module.exports = { connect, getClient };
