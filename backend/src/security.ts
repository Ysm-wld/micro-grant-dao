export function assertLocalSimulationRpc(rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545"): void {
  const normalized = rpcUrl.trim();
  const isAllowedLocalEndpoint = /^(https?:\/\/)?(127\.0\.0\.1|localhost|0\.0\.0\.0|chain)(:\d+)?(\/.*)?$/i.test(normalized);

  if (!isAllowedLocalEndpoint) {
    throw new Error("This project is a local simulation only and rejects external RPC endpoints.");
  }
}
