import { DomainError } from "./errors.js";
import type { AccountRole, Milestone, Proposal, ProposalStatus, VoteChoice } from "./types.js";

export const VOTING_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const QUORUM_PERCENT = 50;
export const APPROVAL_PERCENT = 60;

export function assertRole(roles: AccountRole[], required: AccountRole): void {
  if (!roles.includes(required)) throw new DomainError("FORBIDDEN", `Account requires the ${required} role.`);
}

export function assertProposalTransition(from: ProposalStatus, to: ProposalStatus): void {
  const allowed: Record<ProposalStatus, ProposalStatus[]> = {
    DRAFT: ["SUBMITTED"], SUBMITTED: ["UNDER_REVIEW"], UNDER_REVIEW: ["DRAFT", "VOTING", "REJECTED"],
    VOTING: ["APPROVED", "REJECTED"], APPROVED: [], REJECTED: []
  };
  if (!allowed[from].includes(to)) throw new DomainError("INVALID_STATE_TRANSITION", `Cannot move proposal from ${from} to ${to}.`);
}

export function validateProposalInput(title: string, description: string, category: string, requestedAmount: number, milestones: Milestone[]): void {
  if (!title.trim() || !description.trim() || !category.trim()) throw new DomainError("VALIDATION_ERROR", "Title, description, and category are required.");
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) throw new DomainError("VALIDATION_ERROR", "Requested amount must be positive.");
  if (milestones.length === 0 || milestones.length > 10) throw new DomainError("VALIDATION_ERROR", "Provide between one and ten milestones.");
  if (milestones.some((milestone) => !milestone.title.trim() || milestone.amount <= 0)) throw new DomainError("VALIDATION_ERROR", "Milestones require a title and positive amount.");
  const total = milestones.reduce((sum, milestone) => sum + milestone.amount, 0);
  if (total !== requestedAmount) throw new DomainError("VALIDATION_ERROR", "Milestone amounts must equal the requested amount.");
}

export function assertVotingOpen(proposal: Proposal, now: Date): void {
  if (proposal.status !== "VOTING") throw new DomainError("INVALID_STATE_TRANSITION", "Proposal is not open for voting.");
  if (!proposal.votingEndsAt || now.getTime() >= Date.parse(proposal.votingEndsAt)) throw new DomainError("VOTING_CLOSED", "The voting period has ended.");
}

export function calculateVotingResult(votes: { choice: VoteChoice }[], eligibleVoters: number): "APPROVED" | "REJECTED" {
  const quorum = Math.ceil(eligibleVoters * QUORUM_PERCENT / 100);
  if (votes.length < quorum) throw new DomainError("QUORUM_NOT_REACHED", "The proposal did not reach quorum.");
  const support = votes.filter((vote) => vote.choice === "FOR").length;
  const approval = votes.length === 0 ? 0 : support * 100 / votes.length;
  return approval >= APPROVAL_PERCENT && support > votes.length - support ? "APPROVED" : "REJECTED";
}
