import { afterEach, describe, expect, it } from "vitest";
import { BlockchainSimulator } from "../src/blockchain/simulator.js";
import { createApp } from "../src/http.js";
import { SqliteStore } from "../src/persistence/sqlite-store.js";
import { seedStore } from "../src/seed.js";
import { DaoService } from "../src/services/dao-service.js";

type ApiBody = {
  error?: { code?: string; message?: string };
  grant?: { status?: string };
  proposal?: { milestones?: Array<{ status?: string }> };
  evidence?: Array<{ status?: string }>;
  transaction?: { proposalId?: string; status?: string };
  [key: string]: unknown;
};

const servers: ReturnType<ReturnType<typeof createApp>["listen"]>[] = [];

async function startScenario() {
  const store = new SqliteStore();
  seedStore(store);
  let current = new Date("2026-01-01T00:00:00.000Z");
  const service = new DaoService(store, new BlockchainSimulator(store, () => current), () => current);
  const server = createApp(service).listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a port.");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const call = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const body = await response.json() as ApiBody;
    return { response, body };
  };
  return { call, store, service, advance: (milliseconds: number) => { current = new Date(current.getTime() + milliseconds); service.advanceTime(milliseconds); } };
}

afterEach(() => {
  for (const server of servers) server.close();
  servers.length = 0;
});

describe("full-stack grant lifecycle", () => {
  it("persists and audits submission through milestone completion", async () => {
    const scenario = await startScenario();
    const submit = await scenario.call("/api/proposals", {
      method: "POST",
      headers: { "x-simulation-account": "sim_applicant_1" },
      body: JSON.stringify({ title: "Community lab", description: "Build a repair lab.", category: "Community", requestedAmount: 100, milestones: [{ sequence: 0, title: "Prototype", amount: 100 }] })
    });
    expect(submit.response.status).toBe(202);
    const proposalId = scenario.service.listProposals()[0].id;
    const milestoneId = scenario.service.getProposal(proposalId).milestones[0].id;

    const review = await scenario.call(`/api/proposals/${proposalId}/review`, { method: "POST", headers: { "x-simulation-account": "sim_member_1" }, body: JSON.stringify({ decision: "ADVANCE_TO_VOTING", comment: "Complete." }) });
    expect(review.response.status).toBe(202);
    await scenario.call(`/api/proposals/${proposalId}/votes`, { method: "POST", headers: { "x-simulation-account": "sim_member_1" }, body: JSON.stringify({ choice: "FOR" }) });
    const duplicate = await scenario.call(`/api/proposals/${proposalId}/votes`, { method: "POST", headers: { "x-simulation-account": "sim_member_1" }, body: JSON.stringify({ choice: "FOR" }) });
    expect(duplicate.response.status).toBe(422);
    expect(duplicate.body.error!.code).toBe("ALREADY_VOTED");
    await scenario.call(`/api/proposals/${proposalId}/votes`, { method: "POST", headers: { "x-simulation-account": "sim_member_2" }, body: JSON.stringify({ choice: "FOR" }) });

    scenario.advance(8 * 24 * 60 * 60 * 1000);
    const decision = await scenario.call(`/api/proposals/${proposalId}/finalize`, { method: "POST", headers: { "x-simulation-account": "sim_member_1" } });
    expect(decision.response.status).toBe(202);
    expect(scenario.service.getProposal(proposalId).status).toBe("APPROVED");

    const funding = await scenario.call(`/api/proposals/${proposalId}/allocate`, { method: "POST", headers: { "x-simulation-account": "sim_admin" } });
    expect(funding.response.status).toBe(202);
    const evidence = await scenario.call(`/api/proposals/${proposalId}/milestones/${milestoneId}/evidence`, { method: "POST", headers: { "x-simulation-account": "sim_applicant_1" }, body: JSON.stringify({ summary: "Prototype is ready for review." }) });
    expect(evidence.response.status).toBe(202);
    const verification = await scenario.call(`/api/proposals/${proposalId}/milestones/${milestoneId}/verify`, { method: "POST", headers: { "x-simulation-account": "sim_member_1" }, body: JSON.stringify({ approved: true }) });
    expect(verification.response.status).toBe(202);
    const release = await scenario.call(`/api/proposals/${proposalId}/milestones/${milestoneId}/release`, { method: "POST", headers: { "x-simulation-account": "sim_admin" } });
    expect(release.response.status).toBe(202);

    const detail = await scenario.call(`/api/proposals/${proposalId}`);
    expect(detail.body.grant!.status).toBe("COMPLETED");
    expect(detail.body.proposal!.milestones![0].status).toBe("COMPLETED");
    expect(detail.body.evidence![0].status).toBe("VERIFIED");
    expect(scenario.store.listTransactions()).toHaveLength(9);
    expect(scenario.store.listBlocks()).toHaveLength(9);
    expect(scenario.store.listEvents().map((event) => event.type)).toEqual(expect.arrayContaining(["ProposalSubmitted", "ProposalReviewed", "VoteCast", "VotingFinalized", "ProposalApproved", "TreasuryAllocated", "MilestoneEvidenceSubmitted", "MilestoneVerified", "MilestonePaymentReleased", "GrantCompleted"]));
    expect(scenario.store.listTransactions().every((transaction) => transaction.status === "CONFIRMED")).toBe(true);
  });

  it("supports the demo workflow by advancing simulated time before finalization", async () => {
    const scenario = await startScenario();
    const submit = await scenario.call("/api/proposals", {
      method: "POST",
      headers: { "x-simulation-account": "sim_applicant_1" },
      body: JSON.stringify({ title: "Demo vote window", description: "Relates to time progression.", category: "Community", requestedAmount: 100, milestones: [{ sequence: 0, title: "Prototype", amount: 100 }] })
    });
    expect(submit.response.status).toBe(202);
    const proposalId = submit.body.transaction!.proposalId as string;
    await scenario.call(`/api/proposals/${proposalId}/review`, { method: "POST", headers: { "x-simulation-account": "sim_member_1" }, body: JSON.stringify({ decision: "ADVANCE_TO_VOTING", comment: "Proceed" }) });
    await scenario.call(`/api/proposals/${proposalId}/votes`, { method: "POST", headers: { "x-simulation-account": "sim_member_1" }, body: JSON.stringify({ choice: "FOR" }) });
    await scenario.call(`/api/proposals/${proposalId}/votes`, { method: "POST", headers: { "x-simulation-account": "sim_member_2" }, body: JSON.stringify({ choice: "FOR" }) });
    const advanced = await scenario.call("/api/simulation/advance", { method: "POST", body: JSON.stringify({ milliseconds: 8 * 24 * 60 * 60 * 1000 }) });
    expect(advanced.response.status).toBe(200);
    const finalize = await scenario.call(`/api/proposals/${proposalId}/finalize`, { method: "POST", headers: { "x-simulation-account": "sim_member_1" } });
    expect(finalize.response.status).toBe(202);
    expect(finalize.body.transaction!.proposalId).toBe(proposalId);
    expect(finalize.body.transaction!.status).toBe("CONFIRMED");
  });

  it("returns authorization, validation, and invalid-state failures through the API", async () => {
    const scenario = await startScenario();
    const unauthorized = await scenario.call("/api/proposals", { method: "POST", headers: { "x-simulation-account": "sim_observer" }, body: JSON.stringify({ title: "No", description: "No", category: "No", requestedAmount: 1, milestones: [{ sequence: 0, title: "One", amount: 1 }] }) });
    expect(unauthorized.response.status).toBe(403);
    const invalid = await scenario.call("/api/proposals", { method: "POST", headers: { "x-simulation-account": "sim_applicant_1" }, body: JSON.stringify({ title: "Broken", description: "Broken", category: "Test", requestedAmount: 10, milestones: [{ sequence: 0, title: "One", amount: 9 }] }) });
    expect(invalid.response.status).toBe(422);
    expect(invalid.body.error!.code).toBe("VALIDATION_ERROR");
  });
});
