const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error("❌ REDIS_URL belum diset di .env");
  process.exit(1);
}

const client = createClient({
  url: redisUrl,
  socket: redisUrl.startsWith('rediss://')
    ? {
        tls: true,
        rejectUnauthorized: false,
      }
    : undefined,
});

client.on('error', (err) =>
  console.error('❌ Redis Client Error:', err)
);

client.on('connect', () =>
  console.log('✅ Redis connected')
);

client.on('ready', () =>
  console.log('🚀 Redis ready')
);

client.on('end', () =>
  console.log('⚠️ Redis disconnected')
);

(async () => {
  try {
    await client.connect();

    const type = await client.type('products');
    console.log(`🔎 Type of key 'products':`, type);

    if (type === 'set') {
      const members = await client.sMembers('products');
      console.log('🧾 Members of products:', members);
    } else if (type === 'string') {
      const val = await client.get('products');
      console.log('🧾 Value:', val);
    } else if (type === 'hash') {
      const fields = await client.hGetAll('products');
      console.log('🧾 Fields:', fields);
    } else {
      console.log(`ℹ️ No data found`);
    }

    await client.disconnect();
    console.log('✅ Done.');
  } catch (err) {
    console.error('❌ Error:', err);
  }
})();
