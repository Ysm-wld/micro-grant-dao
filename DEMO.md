# Demo run guide

This guide reflects the exact local workflow that was verified in the project. It is intentionally simple and uses the browser UI rather than a custom script.

## 1. Install dependencies

From the repository root:

```bash
npm install
```

## 2. Start the local simulation

```bash
npm run dev
```

You should see the backend log: `Local DAO simulation listening on port 3004`.

## 3. Open the app

Open this URL in the browser:

```text
http://localhost:3004
```

The app loads the local static frontend and reads all data from the backend API.

## 4. Create a proposal

1. In the UI, change the active account to `sim_applicant_1`.
2. Open the proposal form.
3. Enter a sample grant such as:
   - Title: `Community lab`
   - Category: `Community`
   - Description: `Build a community repair lab.`
   - Requested amount: `100`
   - Milestone title: `Prototype`
   - Milestone amount: `100`
4. Submit the proposal.

This creates a proposal in `UNDER_REVIEW` state.

## 5. Move it to voting

1. Switch the active actor to `sim_member_1`.
2. Open the proposal card from the grants list.
3. Click `Advance to voting`.

The proposal will move into the voting phase.

## 6. Cast votes and close the vote window

1. With `sim_member_1`, vote `FOR`.
2. Switch to `sim_member_2` and vote `FOR`.
3. Use the `Advance 7 days` action in the governance panel.
4. After the simulated clock advances, finalize the proposal using `sim_member_1`.

The proposal should become `APPROVED`.

## 7. Allocate treasury

1. Switch the active actor to `sim_admin`.
2. Click `Allocate treasury` on the approved proposal.

This creates the grant record and stores the funding transaction in the local audit trail.

## 8. Submit evidence, verify, and release through the API

The current browser interface does not expose milestone evidence, verification, or release controls. Use these PowerShell requests after allocating the treasury. Replace the title in the lookup if you used a different proposal name.

Find the proposal and its first milestone:

```powershell
$base = "http://localhost:3004"
$proposal = (Invoke-RestMethod "$base/api/proposals").proposals |
   Where-Object { $_.title -eq "Community lab" } |
   Select-Object -First 1
$detail = Invoke-RestMethod "$base/api/proposals/$($proposal.id)"
$milestoneId = $detail.proposal.milestones[0].id
```

Submit evidence as the recipient, verify as a DAO member, and release as the simulation administrator:

```powershell
$json = @{ summary = "Prototype is ready for review." } | ConvertTo-Json
Invoke-RestMethod -Method Post `
   -Uri "$base/api/proposals/$($proposal.id)/milestones/$milestoneId/evidence" `
   -Headers @{ "x-simulation-account" = "sim_applicant_1" } `
   -ContentType "application/json" -Body $json

$json = @{ approved = $true } | ConvertTo-Json
Invoke-RestMethod -Method Post `
   -Uri "$base/api/proposals/$($proposal.id)/milestones/$milestoneId/verify" `
   -Headers @{ "x-simulation-account" = "sim_member_1" } `
   -ContentType "application/json" -Body $json

Invoke-RestMethod -Method Post `
   -Uri "$base/api/proposals/$($proposal.id)/milestones/$milestoneId/release" `
   -Headers @{ "x-simulation-account" = "sim_admin" } `
   -ContentType "application/json" -Body "{}"
```

Reload the browser. The API proposal detail should show verified evidence and a completed grant/milestone; the audit explorer should show the resulting simulated actions.

## 9. Inspect the audit trail

Use the Audit explorer to inspect transactions, blocks, and events. The Treasury view shows the simulated balance and allocation history.

This is a local simulation only. It does not use a live blockchain, wallet, cryptocurrency, or real funds.
