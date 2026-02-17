const { createClient } = require("redis");

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error("❌ REDIS_URL belum diset");
  process.exit(1);
}

const client = createClient({
  url: redisUrl,
  socket: {
    tls: true,
    rejectUnauthorized: false,
  },
});

client.on("error", (err) =>
  console.error("❌ Redis Client Error:", err)
);

client.on("connect", () =>
  console.log("✅ Redis connected")
);

client.on("ready", () =>
  console.log("🚀 Redis ready")
);

client.on("end", () =>
  console.log("⚠️ Redis disconnected")
);

(async () => {
  try {
    await client.connect();
    console.log("🎉 Redis test connection success!");
    await client.disconnect();
  } catch (err) {
    console.error("❌ Connection failed:", err);
  }
})();
