const { createClient } = require('redis');

let client;

async function connect() {
  if (client) return client;

  console.log('🟡 Redis connecting...');

  let redisUrl =
    process.env.REDIS_URL ||
    'rediss://default:YOUR_PASSWORD@YOUR_HOST.leapcell.cloud:6379';

  // encode password aman
  if (redisUrl.includes('@')) {
    const parts = redisUrl.split('@');
    const auth = parts[0].replace('rediss://', '');
    const [user, pass] = auth.split(':');
    const encodedPass = encodeURIComponent(pass);
    redisUrl = `rediss://${user}:${encodedPass}@${parts[1]}`;
  }

  const isSecure = redisUrl.startsWith('rediss://');

  client = createClient({
    url: redisUrl,

    socket: {
      tls: isSecure,
      rejectUnauthorized: false,

      // 🔥 AUTO RECONNECT (INI KUNCI)
      reconnectStrategy: (retries) => {
        console.log(`🔁 Redis reconnect attempt ${retries}`);
        return Math.min(retries * 200, 3000); // max delay 3 detik
      },

      keepAlive: 5000,
    },
  });

  // ===== EVENTS =====
  client.on('error', (err) => {
    console.error('❌ Redis Error:', err.message);
  });

  client.on('connect', () => {
    console.log('🟡 Redis connecting...');
  });

  client.on('ready', () => {
    console.log('✅ Redis ready!');
  });

  client.on('end', () => {
    console.log('🔴 Redis disconnected');
    client = null; // 🔥 reset supaya bisa reconnect
  });

  await client.connect();

  return client;
}

// 🔥 JANGAN CRASH BOT
function getClient() {
  if (!client) {
    console.warn('⚠️ Redis belum connect, mencoba reconnect...');
    return null;
  }
  return client;
}

module.exports = { connect, getClient };
