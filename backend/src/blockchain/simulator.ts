import { randomUUID } from "node:crypto";
import { DomainError } from "../domain/errors.js";
import { stableHash } from "./hash.js";
import type { SimulatedBlock, SimulatedEvent, SimulatedTransaction, TransactionRequest } from "./models.js";
import { SqliteStore } from "../persistence/sqlite-store.js";

export class BlockchainSimulator {
  constructor(private readonly store: SqliteStore, private readonly now: () => Date = () => new Date()) {}

  execute(request: TransactionRequest): SimulatedTransaction {
    const createdAt = this.now().toISOString();
    const id = randomUUID();
    const hash = stableHash({ id, sender: request.sender, type: request.type, payload: request.payload, createdAt });
    const transaction: SimulatedTransaction = {
      id, hash, sender: request.sender, recipient: request.recipient, type: request.type,
      payload: request.payload, status: "PENDING", createdAt, confirmationCount: 0,
      proposalId: request.proposalId, grantId: request.grantId, eventIds: []
    };
    this.store.saveTransaction(transaction);

    try {
      const result = request.execute();
      const previous = this.store.getLatestBlock();
      const number = (previous?.number ?? 0) + 1;
      const timestamp = this.now().toISOString();
      const events: SimulatedEvent[] = result.events.map((event, index) => ({
        ...event, id: `${hash.slice(0, 16)}-event-${index + 1}`, transactionHash: hash,
        blockNumber: number, timestamp
      }));
      const block: SimulatedBlock = {
        number, previousHash: previous?.hash ?? "0".repeat(64),
        transactionHashes: [hash], eventIds: events.map((event) => event.id), timestamp,
        hash: stableHash({ number, previousHash: previous?.hash ?? "0".repeat(64), transactionHashes: [hash], eventIds: events.map((event) => event.id), timestamp })
      };
      for (const event of events) this.store.saveEvent(event);
      this.store.saveBlock(block);
      transaction.status = "CONFIRMED";
      transaction.confirmedAt = timestamp;
      transaction.blockNumber = number;
      transaction.confirmationCount = 1;
      transaction.eventIds = events.map((event) => event.id);
      this.store.saveTransaction(transaction);
      return transaction;
    } catch (error) {
      transaction.status = "FAILED";
      transaction.errorCode = error instanceof DomainError ? error.code : "TRANSACTION_FAILED";
      transaction.errorMessage = error instanceof Error ? error.message : "Transaction failed.";
      this.store.saveTransaction(transaction);
      throw error;
    }
  }

  advanceConfirmations(): void {
    for (const transaction of this.store.listTransactions()) {
      if (transaction.status !== "CONFIRMED") continue;
      transaction.confirmationCount += 1;
      this.store.saveTransaction(transaction);
    }
  }
}
