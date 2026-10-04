console.warn("Warning: legacy root server.js is deprecated. This repository uses the local SQLite simulation in backend/src/server.ts.");

const rawRpc = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const allowedLocal = /^(https?:\/\/)?(127\.0\.0\.1|localhost|0\.0\.0\.0|chain)(:\d+)?(\/.*)?$/i.test(rawRpc);

if (!allowedLocal) {
  throw new Error("This project is a local simulation only and rejects external RPC endpoints.");
}

console.log("Legacy blockchain server disabled: run the local simulation backend instead.");
process.exit(0);

