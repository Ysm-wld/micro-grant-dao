export type AccountRole =
  | "APPLICANT"
  | "RECIPIENT"
  | "DAO_MEMBER"
  | "SIMULATION_ADMIN"
  | "OBSERVER";

export type ProposalStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "VOTING"
  | "APPROVED"
  | "REJECTED";

export type GrantStatus =
  | "FUNDED"
  | "MILESTONE_IN_PROGRESS"
  | "MILESTONE_VERIFICATION"
  | "COMPLETED";

export type MilestoneStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "VERIFIED"
  | "CHANGES_REQUESTED"
  | "PAID"
  | "COMPLETED";

export type VoteChoice = "FOR" | "AGAINST";

export interface SimulatedAccount {
  address: string;
  displayName: string;
  roles: AccountRole[];
  active: boolean;
}

export interface Milestone {
  id: string;
  sequence: number;
  title: string;
  amount: number;
  status: MilestoneStatus;
}

export interface Proposal {
  id: string;
  applicantAddress: string;
  title: string;
  description: string;
  category: string;
  requestedAmount: number;
  contentHash: string;
  status: ProposalStatus;
  milestones: Milestone[];
  submittedAt: string;
  votingStartsAt?: string;
  votingEndsAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vote {
  id: string;
  proposalId: string;
  voterAddress: string;
  choice: VoteChoice;
  transactionHash: string;
  createdAt: string;
}

export interface Grant {
  id: string;
  proposalId: string;
  allocatedAmount: number;
  reservedAmount: number;
  releasedAmount: number;
  status: GrantStatus;
  createdAt: string;
  updatedAt: string;
}

export type EvidenceStatus = "SUBMITTED" | "VERIFIED" | "CHANGES_REQUESTED";

export interface Evidence {
  id: string;
  milestoneId: string;
  submittedBy: string;
  summary: string;
  contentHash: string;
  status: EvidenceStatus;
  createdAt: string;
}
