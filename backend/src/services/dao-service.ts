import { randomUUID } from "node:crypto";
import { BlockchainSimulator } from "../blockchain/simulator.js";
import { stableHash } from "../blockchain/hash.js";
import { DomainError } from "../domain/errors.js";
import { assertProposalTransition, assertRole, assertVotingOpen, calculateVotingResult, validateProposalInput, VOTING_DURATION_MS } from "../domain/rules.js";
import type { AccountRole, Evidence, Grant, Milestone, Proposal, SimulatedAccount, Vote, VoteChoice } from "../domain/types.js";
import { SqliteStore } from "../persistence/sqlite-store.js";

export class DaoService {
  private currentTime: Date;

  constructor(private readonly store: SqliteStore, private readonly chain: BlockchainSimulator, private readonly now: () => Date = () => new Date()) {
    this.currentTime = this.now();
    if (this.store.getTreasuryBalance() === undefined) this.store.saveTreasuryBalance(10_000);
  }

  advanceTime(milliseconds: number): Date {
    this.currentTime = new Date(this.currentTime.getTime() + milliseconds);
    return this.currentTime;
  }

  getCurrentTime(): Date { return this.currentTime; }

  listAccounts(): SimulatedAccount[] { return this.store.listAccounts(); }
  listProposals(): Proposal[] { return this.store.listProposals(); }
  getProposal(id: string): Proposal {
    const proposal = this.store.getProposal(id);
    if (!proposal) throw new DomainError("NOT_FOUND", "Proposal not found.");
    return proposal;
  }
  getVotes(proposalId: string): Vote[] { return this.store.listVotes(proposalId); }
  getTransaction(hash: string) { return this.store.getTransaction(hash); }
  listTransactions() { return this.store.listTransactions(); }
  listBlocks() { return this.store.listBlocks(); }
  listEvents() { return this.store.listEvents(); }
  getTreasury() {
    const totalBalance = this.store.getTreasuryBalance() ?? 0;
    const reserved = this.store.listTransactions().filter((tx) => tx.type === "TREASURY_ALLOCATED" && tx.status === "CONFIRMED").reduce((sum, tx) => sum + Number((tx.payload as { amount: number }).amount), 0)
      - this.store.listTransactions().filter((tx) => tx.type === "MILESTONE_PAYMENT_RELEASED" && tx.status === "CONFIRMED").reduce((sum, tx) => sum + Number((tx.payload as { amount: number }).amount), 0);
    return { totalBalance, availableBalance: totalBalance - Math.max(0, reserved), reservedBalance: Math.max(0, reserved) };
  }
  getGrant(proposalId: string) { return this.store.getGrantByProposal(proposalId); }
  getEvidence(milestoneId: string) { return this.store.listEvidence(milestoneId); }

  submitProposal(actorAddress: string, input: { title: string; description: string; category: string; requestedAmount: number; milestones: Omit<Milestone, "id" | "status">[] }) {
    const actor = this.requireAccount(actorAddress);
    assertRole(actor.roles, "APPLICANT");
    const proposalId = `proposal_${randomUUID()}`;
    const now = this.currentTime.toISOString();
    const milestones = input.milestones.map((milestone) => ({ ...milestone, id: `milestone_${randomUUID()}`, status: "PENDING" as const }));
    validateProposalInput(input.title, input.description, input.category, input.requestedAmount, milestones);
    const proposal: Proposal = { id: proposalId, applicantAddress: actorAddress, title: input.title.trim(), description: input.description.trim(), category: input.category.trim(), requestedAmount: input.requestedAmount, contentHash: stableHash({ title: input.title.trim(), description: input.description.trim(), category: input.category.trim(), requestedAmount: input.requestedAmount, milestones }), status: "UNDER_REVIEW", milestones, submittedAt: now, createdAt: now, updatedAt: now };
    return this.chain.execute({ sender: actorAddress, type: "PROPOSAL_SUBMITTED", payload: { proposalId }, proposalId, execute: () => { this.store.saveProposal(proposal); return { events: [{ type: "ProposalSubmitted", aggregateType: "PROPOSAL", aggregateId: proposalId, actorAddress, payload: { title: proposal.title } }] }; } });
  }

  reviewProposal(actorAddress: string, proposalId: string, decision: "ADVANCE_TO_VOTING" | "REJECT", comment: string) {
    const actor = this.requireRole(actorAddress, "DAO_MEMBER");
    const proposal = this.getProposal(proposalId);
    const next = decision === "ADVANCE_TO_VOTING" ? "VOTING" : "REJECTED";
    assertProposalTransition(proposal.status, next);
    const now = this.currentTime;
    proposal.status = next;
    proposal.updatedAt = now.toISOString();
    if (next === "VOTING") { proposal.votingStartsAt = now.toISOString(); proposal.votingEndsAt = new Date(now.getTime() + VOTING_DURATION_MS).toISOString(); }
    return this.chain.execute({ sender: actor.address, type: "PROPOSAL_REVIEWED", payload: { proposalId, decision, comment }, proposalId, execute: () => { this.store.saveProposal(proposal); return { events: [{ type: "ProposalReviewed", aggregateType: "PROPOSAL", aggregateId: proposalId, actorAddress, payload: { decision, comment } }] }; } });
  }

  castVote(actorAddress: string, proposalId: string, choice: VoteChoice) {
    const actor = this.requireRole(actorAddress, "DAO_MEMBER");
    const proposal = this.getProposal(proposalId);
    assertVotingOpen(proposal, this.currentTime);
    if (this.store.hasVote(proposalId, actorAddress)) throw new DomainError("ALREADY_VOTED", "This account has already voted on the proposal.");
    const voteId = `vote_${randomUUID()}`;
    const transaction = this.chain.execute({ sender: actor.address, type: "VOTE_CAST", payload: { proposalId, choice }, proposalId, execute: () => { const vote: Vote = { id: voteId, proposalId, voterAddress: actorAddress, choice, transactionHash: "pending", createdAt: this.currentTime.toISOString() }; this.store.saveVote(vote); return { events: [{ type: "VoteCast", aggregateType: "PROPOSAL", aggregateId: proposalId, actorAddress, payload: { choice } }] }; } });
    this.store.updateVoteTransactionHash(voteId, transaction.hash);
    return transaction;
  }

  finalizeVoting(actorAddress: string, proposalId: string) {
    const actor = this.requireRole(actorAddress, "DAO_MEMBER");
    const proposal = this.getProposal(proposalId);
    if (proposal.status !== "VOTING") throw new DomainError("INVALID_STATE_TRANSITION", "Proposal is not being voted on.");
    if (!proposal.votingEndsAt || this.currentTime.getTime() < Date.parse(proposal.votingEndsAt)) throw new DomainError("VOTING_CLOSED", "Voting is still open.");
    const result = calculateVotingResult(this.getVotes(proposalId), this.store.listAccounts().filter((account) => account.roles.includes("DAO_MEMBER")).length);
    proposal.status = result;
    proposal.updatedAt = this.currentTime.toISOString();
    return this.chain.execute({ sender: actor.address, type: "VOTING_FINALIZED", payload: { proposalId, result }, proposalId, execute: () => { this.store.saveProposal(proposal); return { events: [{ type: "VotingFinalized", aggregateType: "PROPOSAL", aggregateId: proposalId, actorAddress, payload: { result } }, { type: result === "APPROVED" ? "ProposalApproved" : "ProposalRejected", aggregateType: "PROPOSAL", aggregateId: proposalId, actorAddress, payload: {} }] }; } });
  }

  allocateTreasury(actorAddress: string, proposalId: string) {
    const actor = this.requireRole(actorAddress, "SIMULATION_ADMIN");
    const proposal = this.getProposal(proposalId);
    if (proposal.status !== "APPROVED") throw new DomainError("INVALID_STATE_TRANSITION", "Only approved proposals can receive funding.");
    if (this.store.getGrantByProposal(proposalId)) throw new DomainError("INVALID_STATE_TRANSITION", "This proposal has already been funded.");
    if (this.getTreasury().availableBalance < proposal.requestedAmount) throw new DomainError("INSUFFICIENT_TREASURY", "Treasury does not have enough available balance.");
    const grant: Grant = { id: `grant_${randomUUID()}`, proposalId, allocatedAmount: proposal.requestedAmount, reservedAmount: proposal.requestedAmount, releasedAmount: 0, status: "MILESTONE_IN_PROGRESS", createdAt: this.currentTime.toISOString(), updatedAt: this.currentTime.toISOString() };
    proposal.milestones[0].status = "IN_PROGRESS";
    return this.chain.execute({ sender: actor.address, type: "TREASURY_ALLOCATED", payload: { proposalId, amount: proposal.requestedAmount }, proposalId, grantId: grant.id, execute: () => { this.store.saveProposal(proposal); this.store.saveGrant(grant); return { events: [{ type: "TreasuryAllocated", aggregateType: "GRANT", aggregateId: grant.id, actorAddress, payload: { amount: grant.allocatedAmount } }] }; } });
  }

  submitEvidence(actorAddress: string, proposalId: string, milestoneId: string, summary: string) {
    const actor = this.requireRole(actorAddress, "RECIPIENT");
    const proposal = this.getProposal(proposalId);
    if (proposal.applicantAddress !== actorAddress) throw new DomainError("FORBIDDEN", "Only the grant recipient can submit evidence.");
    const grant = this.store.getGrantByProposal(proposalId);
    const milestone = proposal.milestones.find((item) => item.id === milestoneId);
    if (!grant || !milestone || milestone.status !== "IN_PROGRESS") throw new DomainError("INVALID_STATE_TRANSITION", "This milestone is not accepting evidence.");
    if (!summary.trim()) throw new DomainError("VALIDATION_ERROR", "Evidence summary is required.");
    const evidence: Evidence = { id: `evidence_${randomUUID()}`, milestoneId, submittedBy: actorAddress, summary: summary.trim(), contentHash: stableHash({ proposalId, milestoneId, summary: summary.trim() }), status: "SUBMITTED", createdAt: this.currentTime.toISOString() };
    milestone.status = "SUBMITTED";
    grant.status = "MILESTONE_VERIFICATION";
    grant.updatedAt = this.currentTime.toISOString();
    return this.chain.execute({ sender: actor.address, type: "EVIDENCE_SUBMITTED", payload: { proposalId, milestoneId, evidenceId: evidence.id }, proposalId, grantId: grant.id, execute: () => { this.store.saveEvidence(evidence); this.store.saveProposal(proposal); this.store.saveGrant(grant); return { events: [{ type: "MilestoneEvidenceSubmitted", aggregateType: "GRANT", aggregateId: grant.id, actorAddress, payload: { milestoneId, evidenceId: evidence.id, contentHash: evidence.contentHash } }] }; } });
  }

  verifyMilestone(actorAddress: string, proposalId: string, milestoneId: string, approved: boolean) {
    const actor = this.requireRole(actorAddress, "DAO_MEMBER");
    const proposal = this.getProposal(proposalId);
    const grant = this.store.getGrantByProposal(proposalId);
    const milestone = proposal.milestones.find((item) => item.id === milestoneId);
    const evidence = milestone ? this.store.listEvidence(milestone.id).at(-1) : undefined;
    if (!grant || !milestone || milestone.status !== "SUBMITTED" || !evidence) throw new DomainError("INVALID_STATE_TRANSITION", "Only submitted milestone evidence can be verified.");
    milestone.status = approved ? "VERIFIED" : "CHANGES_REQUESTED";
    grant.status = approved ? "MILESTONE_IN_PROGRESS" : "MILESTONE_VERIFICATION";
    grant.updatedAt = this.currentTime.toISOString();
    if (!approved) evidence.status = "CHANGES_REQUESTED";
    if (approved) evidence.status = "VERIFIED";
    return this.chain.execute({ sender: actor.address, type: "MILESTONE_VERIFIED", payload: { proposalId, milestoneId, approved }, proposalId, grantId: grant.id, execute: () => { this.store.saveEvidence(evidence); this.store.saveProposal(proposal); this.store.saveGrant(grant); return { events: [{ type: "MilestoneVerified", aggregateType: "GRANT", aggregateId: grant.id, actorAddress, payload: { milestoneId, approved } }] }; } });
  }

  releaseMilestone(actorAddress: string, proposalId: string, milestoneId: string) {
    const actor = this.requireRole(actorAddress, "SIMULATION_ADMIN");
    const proposal = this.getProposal(proposalId);
    const grant = this.store.getGrantByProposal(proposalId);
    const milestoneIndex = proposal.milestones.findIndex((item) => item.id === milestoneId);
    const milestone = proposal.milestones[milestoneIndex];
    if (!grant || !milestone || milestone.status !== "VERIFIED") throw new DomainError("INVALID_STATE_TRANSITION", "Only verified milestones can be paid.");
    if (this.getTreasury().totalBalance < milestone.amount) throw new DomainError("INSUFFICIENT_TREASURY", "Treasury does not have enough balance.");
    const next = proposal.milestones[milestoneIndex + 1];
    return this.chain.execute({ sender: actor.address, type: "MILESTONE_PAYMENT_RELEASED", payload: { proposalId, milestoneId, amount: milestone.amount }, proposalId, grantId: grant.id, recipient: proposal.applicantAddress, execute: () => { milestone.status = "PAID"; grant.reservedAmount -= milestone.amount; grant.releasedAmount += milestone.amount; grant.status = next ? "MILESTONE_IN_PROGRESS" : "COMPLETED"; if (next) next.status = "IN_PROGRESS"; else { milestone.status = "COMPLETED"; } grant.updatedAt = this.currentTime.toISOString(); this.store.saveProposal(proposal); this.store.saveGrant(grant); this.store.saveTreasuryBalance((this.store.getTreasuryBalance() ?? 0) - milestone.amount); return { events: [{ type: "MilestonePaymentReleased", aggregateType: "GRANT", aggregateId: grant.id, actorAddress, payload: { milestoneId, amount: milestone.amount, recipient: proposal.applicantAddress } }, ...(next ? [] : [{ type: "GrantCompleted" as const, aggregateType: "GRANT" as const, aggregateId: grant.id, actorAddress, payload: {} }]) ] }; } });
  }

  private requireAccount(address: string): SimulatedAccount { const account = this.store.getAccount(address); if (!account || !account.active) throw new DomainError("FORBIDDEN", "Unknown or inactive simulation account."); return account; }
  private requireRole(address: string, role: AccountRole): SimulatedAccount { const account = this.requireAccount(address); assertRole(account.roles, role); return account; }
}
