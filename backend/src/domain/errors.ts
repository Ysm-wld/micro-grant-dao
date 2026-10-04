export type DomainErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_STATE_TRANSITION"
  | "ALREADY_VOTED"
  | "VOTING_CLOSED"
  | "QUORUM_NOT_REACHED"
  | "INSUFFICIENT_TREASURY"
  | "TRANSACTION_FAILED";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DomainError";
  }
}
