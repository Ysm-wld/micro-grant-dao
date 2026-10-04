import type { SimulatedAccount } from "./domain/types.js";
import { SqliteStore } from "./persistence/sqlite-store.js";

export const seedAccounts: SimulatedAccount[] = [
  { address: "sim_applicant_1", displayName: "Applicant One", roles: ["APPLICANT", "RECIPIENT"], active: true },
  { address: "sim_member_1", displayName: "DAO Member One", roles: ["DAO_MEMBER"], active: true },
  { address: "sim_member_2", displayName: "DAO Member Two", roles: ["DAO_MEMBER"], active: true },
  { address: "sim_admin", displayName: "Simulation Administrator", roles: ["SIMULATION_ADMIN"], active: true },
  { address: "sim_observer", displayName: "Public Observer", roles: ["OBSERVER"], active: true }
];

export function seedStore(store: SqliteStore): void {
  for (const account of seedAccounts) store.saveAccount(account);
}
