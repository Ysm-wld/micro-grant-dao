export type TransactionStatus = "CREATED" | "PENDING" | "CONFIRMED" | "FAILED";

export type TransactionType =
  | "PROPOSAL_SUBMITTED"
  | "PROPOSAL_REVIEWED"
  | "VOTE_CAST"
  | "VOTING_FINALIZED"
  | "TREASURY_ALLOCATED"
  | "EVIDENCE_SUBMITTED"
  | "MILESTONE_VERIFIED"
  | "MILESTONE_PAYMENT_RELEASED";

export type EventType =
  | "ProposalSubmitted"
  | "ProposalReviewed"
  | "VoteCast"
  | "VotingFinalized"
  | "ProposalApproved"
  | "ProposalRejected"
  | "TreasuryAllocated"
  | "MilestoneEvidenceSubmitted"
  | "MilestoneVerified"
  | "MilestonePaymentReleased"
  | "GrantCompleted";

export interface SimulatedTransaction {
  id: string;
  hash: string;
  sender: string;
  recipient?: string;
  type: TransactionType;
  payload: unknown;
  status: TransactionStatus;
  createdAt: string;
  confirmedAt?: string;
  blockNumber?: number;
  confirmationCount: number;
  proposalId?: string;
  grantId?: string;
  eventIds: string[];
  errorCode?: string;
  errorMessage?: string;
}

export interface SimulatedBlock {
  number: number;
  hash: string;
  previousHash: string;
  transactionHashes: string[];
  eventIds: string[];
  timestamp: string;
}

export interface SimulatedEvent {
  id: string;
  type: EventType;
  aggregateType: "PROPOSAL" | "GRANT" | "TREASURY";
  aggregateId: string;
  transactionHash: string;
  blockNumber: number;
  actorAddress?: string;
  payload: unknown;
  timestamp: string;
}

export interface TransactionRequest {
  sender: string;
  type: TransactionType;
  payload: unknown;
  proposalId?: string;
  grantId?: string;
  recipient?: string;
  execute: () => ExecutionResult;
}

export interface ExecutionResult {
  events: Omit<SimulatedEvent, "id" | "transactionHash" | "blockNumber" | "timestamp">[];
}
