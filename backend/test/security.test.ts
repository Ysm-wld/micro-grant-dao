import { describe, expect, it } from "vitest";
import { assertLocalSimulationRpc } from "../src/security.js";

describe("security boundary", () => {
  it("allows local simulation RPC endpoints", () => {
    expect(() => assertLocalSimulationRpc("http://localhost:8545")).not.toThrow();
    expect(() => assertLocalSimulationRpc("http://chain:8545")).not.toThrow();
  });

  it("rejects external blockchain endpoints", () => {
    expect(() => assertLocalSimulationRpc("https://mainnet.infura.io/v3/demo")).toThrow("local simulation only");
    expect(() => assertLocalSimulationRpc("https://rpc.flashbots.net")).toThrow("local simulation only");
  });
});
