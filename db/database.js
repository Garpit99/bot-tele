// db/database.js
const { createClient } = require('redis');

let client;

async function connect() {
  if (client) return client;

  console.log('✅ Redis connecting...');

  // Ambil URL Redis dari environment atau fallback default
  let redisUrl =
    process.env.REDIS_URL ||
    'rediss://default:YOUR_PASSWORD@YOUR_HOST.leapcell.cloud:6379';

  // Encode password agar simbol tidak merusak URL
  if (redisUrl.includes('@')) {
    const parts = redisUrl.split('@');
    const auth = parts[0].replace('rediss://', '');
    const [user, pass] = auth.split(':');
    const encodedPass = encodeURIComponent(pass);
    redisUrl = `rediss://${user}:${encodedPass}@${parts[1]}`;
  }

  const isSecure = redisUrl.startsWith('rediss://');

  try {
    client = createClient({
      url: redisUrl,
      socket: isSecure
        ? { tls: true, rejectUnauthorized: false }
        : {},
    });

    client.on('error', (err) => console.error('❌ Redis Client Error:', err));
    client.on('ready', () => console.log('✅ Redis ready!'));

    await client.connect();
    console.log('🚀 Redis connected successfully');

    return client;
  } catch (err) {
    console.error('❌ Initialization failed:', err);
    throw err;
  }
}

function getClient() {
  if (!client) throw new Error('❌ Redis client belum terhubung! Panggil connect() dulu.');
  return client;
}

module.exports = { connect, getClient };
