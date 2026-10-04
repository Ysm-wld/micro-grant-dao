import Database from "better-sqlite3";
import type { Evidence, Proposal, Vote, Grant, SimulatedAccount } from "../domain/types.js";
import type { SimulatedBlock, SimulatedEvent, SimulatedTransaction } from "../blockchain/models.js";

export class SqliteStore {
  private readonly db: Database.Database;

  constructor(filename = ":memory:") {
    this.db = new Database(filename);
    this.db.pragma("foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (address TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS votes (id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL, voter_address TEXT NOT NULL, value TEXT NOT NULL, UNIQUE(proposal_id, voter_address));
      CREATE TABLE IF NOT EXISTS grants (id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, milestone_id TEXT NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS treasury (id TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS transactions (hash TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS blocks (number INTEGER PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, transaction_hash TEXT NOT NULL, value TEXT NOT NULL);
    `);
  }

  close(): void { this.db.close(); }

  saveAccount(account: SimulatedAccount): void { this.save("accounts", account.address, account); }
  getAccount(address: string): SimulatedAccount | undefined { return this.get("accounts", address); }
  listAccounts(): SimulatedAccount[] { return this.list("accounts"); }

  saveProposal(proposal: Proposal): void { this.save("proposals", proposal.id, proposal); }
  getProposal(id: string): Proposal | undefined { return this.get("proposals", id); }
  listProposals(): Proposal[] { return this.list("proposals"); }

  saveVote(vote: Vote): void {
    this.db.prepare("INSERT INTO votes (id, proposal_id, voter_address, value) VALUES (?, ?, ?, ?)" )
      .run(vote.id, vote.proposalId, vote.voterAddress, JSON.stringify(vote));
  }
  updateVoteTransactionHash(voteId: string, transactionHash: string): void {
    const row = this.db.prepare("SELECT value FROM votes WHERE id = ?").get(voteId) as { value: string } | undefined;
    if (!row) return;
    const vote = JSON.parse(row.value) as Vote;
    vote.transactionHash = transactionHash;
    this.db.prepare("UPDATE votes SET value = ? WHERE id = ?").run(JSON.stringify(vote), voteId);
  }
  hasVote(proposalId: string, voterAddress: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM votes WHERE proposal_id = ? AND voter_address = ?")
      .get(proposalId, voterAddress));
  }
  listVotes(proposalId: string): Vote[] {
    return this.db.prepare("SELECT value FROM votes WHERE proposal_id = ? ORDER BY id")
      .all(proposalId).map((row) => JSON.parse((row as { value: string }).value) as Vote);
  }

  saveGrant(grant: Grant): void {
    this.db.prepare("INSERT INTO grants (id, proposal_id, value) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET proposal_id = excluded.proposal_id, value = excluded.value")
      .run(grant.id, grant.proposalId, JSON.stringify(grant));
  }
  getGrantByProposal(proposalId: string): Grant | undefined {
    const row = this.db.prepare("SELECT value FROM grants WHERE proposal_id = ?").get(proposalId) as { value: string } | undefined;
    return row ? JSON.parse(row.value) as Grant : undefined;
  }

  saveEvidence(evidence: Evidence): void {
    this.db.prepare("INSERT INTO evidence (id, milestone_id, value) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET milestone_id = excluded.milestone_id, value = excluded.value")
      .run(evidence.id, evidence.milestoneId, JSON.stringify(evidence));
  }
  listEvidence(milestoneId: string): Evidence[] {
    return this.db.prepare("SELECT value FROM evidence WHERE milestone_id = ? ORDER BY rowid")
      .all(milestoneId).map((row) => JSON.parse((row as { value: string }).value) as Evidence);
  }

  getTreasuryBalance(): number | undefined {
    const row = this.db.prepare("SELECT value FROM treasury WHERE id = 'primary'").get() as { value: string } | undefined;
    return row ? Number(row.value) : undefined;
  }
  saveTreasuryBalance(balance: number): void {
    this.db.prepare("INSERT INTO treasury (id, value) VALUES ('primary', ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value").run(String(balance));
  }

  saveTransaction(transaction: SimulatedTransaction): void { this.save("transactions", transaction.hash, transaction); }
  getTransaction(hash: string): SimulatedTransaction | undefined { return this.get("transactions", hash); }
  listTransactions(): SimulatedTransaction[] { return this.list("transactions"); }

  saveBlock(block: SimulatedBlock): void { this.save("blocks", String(block.number), block); }
  getLatestBlock(): SimulatedBlock | undefined {
    const row = this.db.prepare("SELECT value FROM blocks ORDER BY number DESC LIMIT 1").get() as { value: string } | undefined;
    return row ? JSON.parse(row.value) as SimulatedBlock : undefined;
  }
  listBlocks(): SimulatedBlock[] { return this.list("blocks"); }

  saveEvent(event: SimulatedEvent): void {
    this.db.prepare("INSERT INTO events (id, transaction_hash, value) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET transaction_hash = excluded.transaction_hash, value = excluded.value")
      .run(event.id, event.transactionHash, JSON.stringify(event));
  }
  getEvent(id: string): SimulatedEvent | undefined { return this.get("events", id); }
  listEvents(): SimulatedEvent[] { return this.list("events"); }

  private save(table: string, id: string, value: unknown): void {
    const key = table === "accounts" ? "address" : table === "blocks" ? "number" : table === "transactions" ? "hash" : "id";
    this.db.prepare(`INSERT INTO ${table} (value, ${key}) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value`)
      .run(JSON.stringify(value), id);
  }

  private get<T>(table: string, id: string): T | undefined {
    const key = table === "accounts" ? "address" : table === "blocks" ? "number" : table === "transactions" ? "hash" : "id";
    const row = this.db.prepare(`SELECT value FROM ${table} WHERE ${key} = ?`).get(id) as { value: string } | undefined;
    return row ? JSON.parse(row.value) as T : undefined;
  }

  private list<T>(table: string): T[] {
    return this.db.prepare(`SELECT value FROM ${table} ORDER BY rowid`).all()
      .map((row) => JSON.parse((row as { value: string }).value) as T);
  }
}
