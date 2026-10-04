import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { z } from "zod";
import { DomainError } from "./domain/errors.js";
import type { VoteChoice } from "./domain/types.js";
import { DaoService } from "./services/dao-service.js";

const actor = (request: Request): string => request.header("x-simulation-account") ?? "";
const proposalInput = z.object({ title: z.string().min(1).max(120), description: z.string().min(1).max(5000), category: z.string().min(1).max(80), requestedAmount: z.number().positive(), milestones: z.array(z.object({ sequence: z.number().int().nonnegative(), title: z.string().min(1).max(160), amount: z.number().positive() })).min(1).max(10) });

export function createApp(service: DaoService): express.Express {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "256kb" }));
  app.use(express.static(path.resolve(process.cwd(), "frontend")));
  app.get("/api/health", (_request, response) => response.json({ ok: true, simulation: true, externalBlockchain: false }));
  app.get("/api/accounts", (_request, response) => response.json({ accounts: service.listAccounts() }));
  app.get("/api/proposals", (_request, response) => response.json({ proposals: service.listProposals() }));
  app.get("/api/proposals/:id", (request, response) => {
    const proposal = service.getProposal(request.params.id);
    response.json({ proposal, votes: service.getVotes(request.params.id), grant: service.getGrant(request.params.id), evidence: proposal.milestones.flatMap((milestone) => service.getEvidence(milestone.id)) });
  });
  app.get("/api/treasury", (_request, response) => response.json(service.getTreasury()));
  app.post("/api/simulation/advance", (request, response) => {
    const input = z.object({ milliseconds: z.number().int().min(1).max(1000 * 60 * 60 * 24 * 365) }).parse(request.body);
    const current = service.advanceTime(input.milliseconds);
    response.json({ ok: true, currentTime: current.toISOString(), advancedMilliseconds: input.milliseconds });
  });
  app.post("/api/proposals", (request, response) => { const input = proposalInput.parse(request.body); const transaction = service.submitProposal(actor(request), input); response.status(202).json({ transaction }); });
  app.post("/api/proposals/:id/review", (request, response) => { const input = z.object({ decision: z.enum(["ADVANCE_TO_VOTING", "REJECT"]), comment: z.string().max(2000).default("") }).parse(request.body); response.status(202).json({ transaction: service.reviewProposal(actor(request), request.params.id, input.decision, input.comment) }); });
  app.post("/api/proposals/:id/votes", (request, response) => { const input = z.object({ choice: z.enum(["FOR", "AGAINST"]) }).parse(request.body) as { choice: VoteChoice }; response.status(202).json({ transaction: service.castVote(actor(request), request.params.id, input.choice) }); });
  app.post("/api/proposals/:id/finalize", (request, response) => response.status(202).json({ transaction: service.finalizeVoting(actor(request), request.params.id) }));
  app.post("/api/proposals/:id/allocate", (request, response) => response.status(202).json({ transaction: service.allocateTreasury(actor(request), request.params.id) }));
  app.post("/api/proposals/:id/milestones/:milestoneId/evidence", (request, response) => {
    const input = z.object({ summary: z.string().min(1).max(2000) }).parse(request.body);
    response.status(202).json({ transaction: service.submitEvidence(actor(request), request.params.id, request.params.milestoneId, input.summary) });
  });
  app.post("/api/proposals/:id/milestones/:milestoneId/verify", (request, response) => {
    const input = z.object({ approved: z.boolean() }).parse(request.body);
    response.status(202).json({ transaction: service.verifyMilestone(actor(request), request.params.id, request.params.milestoneId, input.approved) });
  });
  app.post("/api/proposals/:id/milestones/:milestoneId/release", (request, response) => response.status(202).json({ transaction: service.releaseMilestone(actor(request), request.params.id, request.params.milestoneId) }));
  app.get("/api/transactions", (_request, response) => response.json({ transactions: service.listTransactions() }));
  app.get("/api/transactions/:hash", (request, response) => { const transaction = service.getTransaction(request.params.hash); if (!transaction) throw new DomainError("NOT_FOUND", "Transaction not found."); response.json({ transaction }); });
  app.get("/api/blocks", (_request, response) => response.json({ blocks: service.listBlocks() }));
  app.get("/api/events", (_request, response) => response.json({ events: service.listEvents() }));
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    void _next;
    if (error instanceof z.ZodError) return response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed.", details: error.flatten() } });
    if (error instanceof DomainError) { const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 422; return response.status(status).json({ error: { code: error.code, message: error.message } }); }
    console.error(error);
    return response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
  });
  return app;
}
