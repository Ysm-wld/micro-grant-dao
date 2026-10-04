import { BlockchainSimulator } from "./blockchain/simulator.js";
import { createApp } from "./http.js";
import { SqliteStore } from "./persistence/sqlite-store.js";
import { seedStore } from "./seed.js";
import { assertLocalSimulationRpc } from "./security.js";
import { DaoService } from "./services/dao-service.js";

assertLocalSimulationRpc(process.env.RPC_URL ?? "http://127.0.0.1:8545");

const store = new SqliteStore(process.env.SIMULATION_DB ?? "simulation.db");
seedStore(store);
const service = new DaoService(store, new BlockchainSimulator(store));
const port = Number(process.env.PORT ?? 3004);

createApp(service).listen(port, () => console.log(`Local DAO simulation listening on port ${port}`));
