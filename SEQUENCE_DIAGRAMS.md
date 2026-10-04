# Current Application Flows

These diagrams describe the TypeScript/Express/SQLite simulation in this repository. None of the flows calls a wallet, deployed contract, blockchain node, or external RPC provider.

---

## Governance and Time Advancement

```mermaid
sequenceDiagram
    actor Member
    participant UI as Browser UI
    participant API as Express API
    participant DAO as DaoService
    participant DB as SQLite Store
    participant Sim as BlockchainSimulator

    Member->>UI: Advance proposal to voting
    UI->>API: POST /api/proposals/:id/review
    API->>DAO: Check role and transition
    DAO->>DAO: Set seven-day deadline
    DAO->>Sim: Record review transaction/event/block
    Sim->>DB: Persist proposal and audit records

    Member->>UI: Cast vote
    UI->>API: POST /api/proposals/:id/votes
    API->>DAO: Check role, deadline, and duplicate vote
    DAO->>Sim: Record vote and persist vote row

    Member->>UI: Advance 7 days
    UI->>API: POST /api/simulation/advance
    API->>DAO: Move in-memory simulation clock
    API-->>UI: 200 + currentTime + advancedMilliseconds
    Note over DAO,DB: Clock is not persisted and creates no transaction/event.

    Member->>UI: Finalize proposal
    UI->>API: POST /api/proposals/:id/finalize
    API->>DAO: Check deadline, quorum, and approval threshold
    DAO->>Sim: Record finalization transaction/events/block
    Sim->>DB: Persist final proposal and audit records
    Sim-->>UI: Confirmed simulated transaction
```

---

## Proposal Submission

```mermaid
sequenceDiagram
    actor Applicant
    participant UI as Browser UI
    participant API as Express API
    participant DAO as DaoService
    participant Sim as BlockchainSimulator
    participant DB as SQLite Store

    Applicant->>UI: Submit proposal form
    UI->>API: POST /api/proposals + simulated account header
    API->>API: Validate request with Zod
    API->>DAO: submitProposal(actor, input)
    DAO->>DAO: Check role and proposal rules
    DAO->>Sim: Execute PROPOSAL_SUBMITTED
    Sim->>DB: Save pending transaction
    Sim->>DB: Persist proposal, event, block, confirmed transaction
    Sim-->>API: Confirmed simulated transaction
    API-->>UI: 202 response
    UI->>API: Reload proposal and audit state
    API-->>UI: Current SQLite-backed state
```

## Treasury and Milestone API Actions

Milestone actions exist as API routes; the browser currently has no dedicated controls for them.

```mermaid
sequenceDiagram
    actor Admin
    actor Recipient
    actor Member
    participant API as Express API
    participant DAO as DaoService
    participant Sim as BlockchainSimulator
    participant DB as SQLite Store

    Admin->>API: POST /api/proposals/:id/allocate
    API->>DAO: Check approved state and available balance
    DAO->>Sim: Record allocation transaction/event/block
    Sim->>DB: Persist grant and in-progress milestone

    Recipient->>API: POST /milestones/:id/evidence
    API->>DAO: Check recipient and milestone state
    DAO->>Sim: Record evidence transaction/event/block
    Sim->>DB: Persist evidence and submitted state

    Member->>API: POST /milestones/:id/verify
    API->>DAO: Check submitted evidence
    DAO->>Sim: Record verification transaction/event/block
    Sim->>DB: Persist verified state

    Admin->>API: POST /milestones/:id/release
    API->>DAO: Require verified milestone
    DAO->>Sim: Record release transaction/event/block
    Sim->>DB: Update treasury, grant, and milestone
```

---
