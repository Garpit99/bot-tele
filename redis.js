const { createClient } = require("redis");

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error("❌ REDIS_URL belum diset");
  process.exit(1);
}

let client;

function getClient() {
  if (!client) {
    client = createClient({
      url: redisUrl,
      socket: {
        tls: true,
        rejectUnauthorized: false,
        keepAlive: 5000,
        reconnectStrategy: (retries) => {
          console.log("🔄 Redis reconnect ke-", retries);
          return Math.min(retries * 100, 3000);
        }
      }
    });

    client.on("error", (err) =>
      console.error("❌ Redis Error:", err.message)
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

    client.connect().catch(console.error);
  }

  return client;
}

module.exports = { getClient };
