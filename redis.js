const { createClient } = require('redis');

async function main() {
  const redisUrl =
    process.env.REDIS_URL ||
    'rediss://default:Ae00000K+YGVhpO84qQ2z7xVxybbDgUnPCEM/frnvMY/hQf8dXKIQGMvYPupOBR0Z15ieur@db-pevk-gffc-178851.leapcell.cloud:6379';

  // Encode password jika perlu
  let safeUrl = redisUrl;
  if (redisUrl.includes('@')) {
    const parts = redisUrl.split('@');
    const auth = parts[0].replace('rediss://', '');
    const [user, pass] = auth.split(':');
    const encodedPass = encodeURIComponent(pass);
    safeUrl = `rediss://${user}:${encodedPass}@${parts[1]}`;
  }

  const client = createClient({
    url: safeUrl,
    socket: {
      tls: true,
      rejectUnauthorized: false,
    },
  });

  client.on('error', (err) => console.error('Redis error:', err));

  await client.connect();

  // 🔍 Cek tipe key
  const type = await client.type('products');
  console.log(`🔎 Type of key 'products':`, type);

  // Jika tipe adalah 'set', tampilkan isinya
  if (type === 'set') {
    const members = await client.sMembers('products');
    console.log('🧾 Members of products:', members);
  } else if (type === 'string') {
    const val = await client.get('products');
    console.log('🧾 Value of products (string):', val);
  } else if (type === 'hash') {
    const fields = await client.hGetAll('products');
    console.log('🧾 Fields of products (hash):', fields);
  } else {
    console.log(`ℹ️ No members to show for type: ${type}`);
  }

  await client.disconnect();
  console.log('✅ Done.');
}

main().catch((err) => console.error('❌ Error:', err));
