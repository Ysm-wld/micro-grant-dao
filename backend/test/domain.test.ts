import { describe, expect, it } from "vitest";
import { BlockchainSimulator } from "../src/blockchain/simulator.js";
import { DomainError } from "../src/domain/errors.js";
import { calculateVotingResult, validateProposalInput } from "../src/domain/rules.js";
import { SqliteStore } from "../src/persistence/sqlite-store.js";
import { seedStore } from "../src/seed.js";
import { DaoService } from "../src/services/dao-service.js";

describe("governance rules", () => {
  it("requires milestone totals to equal the proposal amount", () => {
    expect(() => validateProposalInput("A", "B", "C", 10, [{ id: "m", sequence: 0, title: "One", amount: 9, status: "PENDING" }])).toThrow(DomainError);
  });

  it("requires quorum and an approval majority", () => {
    expect(calculateVotingResult([{ choice: "FOR" }, { choice: "FOR" }], 2)).toBe("APPROVED");
    expect(() => calculateVotingResult([{ choice: "FOR" }], 3)).toThrow("quorum");
  });
});

describe("local blockchain simulation", () => {
  function createService() { const store = new SqliteStore(); seedStore(store); return { store, service: new DaoService(store, new BlockchainSimulator(store)) }; }

  it("creates linked transactions, blocks, and events", () => {
    const { service, store } = createService();
    const transaction = service.submitProposal("sim_applicant_1", { title: "Lab", description: "A local project", category: "Education", requestedAmount: 100, milestones: [{ sequence: 0, title: "Prototype", amount: 100 }] });
    expect(transaction.status).toBe("CONFIRMED");
    expect(transaction.blockNumber).toBe(1);
    expect(store.listBlocks()[0].transactionHashes).toContain(transaction.hash);
    expect(store.listEvents()[0].transactionHash).toBe(transaction.hash);
  });

  it("prevents unauthorized and duplicate votes", () => {
    const { service } = createService();
    service.submitProposal("sim_applicant_1", { title: "Lab", description: "A local project", category: "Education", requestedAmount: 100, milestones: [{ sequence: 0, title: "Prototype", amount: 100 }] });
    const proposal = service.listProposals()[0];
    service.reviewProposal("sim_member_1", proposal.id, "ADVANCE_TO_VOTING", "Complete");
    const voteTransaction = service.castVote("sim_member_1", proposal.id, "FOR");
    expect(service.getVotes(proposal.id)[0].transactionHash).toBe(voteTransaction.hash);
    expect(() => service.castVote("sim_member_1", proposal.id, "FOR")).toThrow("already voted");
    expect(() => service.castVote("sim_observer", proposal.id, "FOR")).toThrow("DAO_MEMBER");
  });
});
