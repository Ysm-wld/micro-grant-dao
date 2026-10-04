// Demo content file used by the Lab 5 frontend when live blockchain data is unavailable.
// It provides sample proposals, committee state, review comments, and activity feed
// so the dashboard remains interactive and easy to demonstrate.
const DEMO_CONTENT = {
  foundation: {
    title: "Lab 5: Micro-Grant Proposal Funding DAO",
    objectives: [
      "Submit grant proposals with milestone funding plans.",
      "Vote transparently through a student committee.",
      "Release treasury funds based on on-chain approval.",
      "Track milestone completion until final project delivery."
    ],
    notes: [
      "The dashboard blends governance, treasury oversight, and proposal lifecycle visualization.",
      "Demo mode shows realistic sample pipeline data while live blockchain data is unavailable."
    ]
  },

  // studentAddress MUST match the creator of at least one demo proposal below
  // Demo wallet identities used to simulate student, reviewer, and admin roles.
  user: {
    studentAddress: "0x93f5d239166f551253976c2f2af0cd628f0dd4f7",
    reviewerAddress: "0xf0c1e3b0addc4a42d9a6a24c77e8f4e8e49caa17",
    adminAddress: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
  },

  // Deployment metadata to mirror the live contract environment in demo mode.
  deployment: {
    network: "localhost",
    admin: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    approvalThresholdPercent: "60",
    contracts: {
      GrantDAO: "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    }
  },

  // Treasury sample values used for the metrics and funding overview.
  treasury: {
    balance: "12500000000000000000",
    approvalThresholdPercent: "60"
  },

  // Committee snapshot for reviewer and admin dashboard details.
  committee: {
    admin: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    committeeCount: "5",
    members: [
      { role: "Chair", address: "0x7EAc2110BB3a1B3F95CeD7f2BA4c4dE6Ca1b9F48" },
      { role: "Coordinator", address: "0x5B3f6738F3C22bF9fC05D324112bDd49bE1e3A1D" },
      { role: "Treasurer", address: "0xD3A54D6535a77861438cEdd1B6C0828fF32B6F5E" },
      { role: "Reviewer", address: "0xf0C1E3B0aDDc4a42d9a6a24c77E8f4e8E49Caa17" },
      { role: "Advisor", address: "0x8F2b7BB3D678c61f9FE0A5b89E6C32fA4d0dCce2" }
    ]
  },

  // Sample proposal data to demonstrate status, milestones, and voting progression.
  proposals: [
    {
      id: 1,
      // creator MATCHES user.studentAddress (lowercased)
      creator: "0x93f5d239166f551253976c2f2af0cd628f0dd4f7",
      title: "AI Study Assistant",
      description: "Develop an AI-powered study buddy that recommends research resources, schedules tasks, and helps students manage grant milestones effectively.",
      category: "Education Technology",
      requestedAmount: "4800000000000000000",
      createdAt: "2026-05-04T10:18:00Z",
      votingDeadline: "2026-05-10T18:00:00Z",
      status: 1,
      supportCount: 3,
      againstCount: 1,
      milestones: [
        { title: "Research & prototype", amount: "1600000000000000000", released: true },
        { title: "Platform development", amount: "1600000000000000000", released: false },
        { title: "Pilot launch", amount: "1600000000000000000", released: false }
      ]
    },
    {
      id: 2,
      creator: "0xc6f2e8c6b1f7d3a0a7b0ef3d9c54d4507624cef9",
      title: "Sustainability Lab Upgrade",
      description: "Fund lab instruments for student-led sustainability research and local energy innovation projects across campus.",
      category: "Sustainability",
      requestedAmount: "6500000000000000000",
      createdAt: "2026-04-22T14:03:00Z",
      votingDeadline: "2026-04-28T20:00:00Z",
      status: 2,
      supportCount: 4,
      againstCount: 1,
      milestones: [
        { title: "Equipment purchase", amount: "3000000000000000000", released: true },
        { title: "Testing phase", amount: "2000000000000000000", released: true },
        { title: "Community workshop", amount: "1500000000000000000", released: false }
      ]
    },
    {
      id: 3,
      creator: "0x8173cb4f22096a8a61fb2e72ac12dda17ccb4f0e",
      title: "Robotics Outreach Initiative",
      description: "Create an accessible robotics program for underrepresented students with travel, coaching, and prototype support materials.",
      category: "Robotics",
      requestedAmount: "9200000000000000000",
      createdAt: "2026-04-29T08:22:00Z",
      votingDeadline: "2026-05-05T20:00:00Z",
      status: 4,
      supportCount: 4,
      againstCount: 1,
      milestones: [
        { title: "Community engagement", amount: "3200000000000000000", released: true },
        { title: "Team training", amount: "3000000000000000000", released: true },
        { title: "Prototype delivery", amount: "3000000000000000000", released: false }
      ]
    },
    {
      id: 4,
      creator: "0xdf4cf1e6f2b2a8a4c5e3b8d6f1c2a7e5b8a9cd7f",
      title: "Research Scholarship Portal",
      description: "Build a student proposal portal for grant applications, progress tracking, and mentor feedback with an integrated review workflow.",
      category: "Research",
      requestedAmount: "3400000000000000000",
      createdAt: "2026-05-01T09:10:00Z",
      votingDeadline: "2026-05-07T18:00:00Z",
      status: 0,
      supportCount: 2,
      againstCount: 0,
      milestones: [
        { title: "Design and requirements", amount: "1100000000000000000", released: false },
        { title: "Platform build", amount: "1200000000000000000", released: false },
        { title: "Pilot testing", amount: "1100000000000000000", released: false }
      ]
    },
    {
      id: 5,
      creator: "0xf4d3a1c8b5f2e6a7d8c9e0f4a7b6c3d4e5f8b1c2",
      title: "Campus AI Innovation Hub",
      description: "Launch a small AI innovation hub for teamwork, grant guidance, and prototype incubator support for interdisciplinary student teams.",
      category: "AI Projects",
      requestedAmount: "7800000000000000000",
      createdAt: "2026-04-18T16:40:00Z",
      votingDeadline: "2026-04-25T19:00:00Z",
      status: 3,
      supportCount: 2,
      againstCount: 3,
      milestones: [
        { title: "Facility planning", amount: "2600000000000000000", released: false },
        { title: "Team recruitment", amount: "2500000000000000000", released: false },
        { title: "Launch event", amount: "2700000000000000000", released: false }
      ]
    }
  ],

  // Pre-seeded reviewer comments per proposal ID
  reviewerComments: {
    1: [
      { author: "Reviewer (Chair)", time: "2026-05-05T14:22:00Z", text: "Strong methodology. The prototype milestone is well-defined. Support." },
      { author: "Reviewer (Coordinator)", time: "2026-05-06T09:10:00Z", text: "Budget seems reasonable for this scope. Voting yes." }
    ],
    2: [
      { author: "Reviewer (Treasurer)", time: "2026-04-24T11:00:00Z", text: "Equipment costs are well-justified. Moving to approve." }
    ],
    3: [
      { author: "Reviewer (Advisor)", time: "2026-05-01T16:45:00Z", text: "Outreach component is excellent. Prototype delivery milestone needs clearer KPIs." }
    ],
    4: [],
    5: [
      { author: "Reviewer (Chair)", time: "2026-04-20T13:30:00Z", text: "Scope is too broad for current treasury. Voting against." },
      { author: "Reviewer (Coordinator)", time: "2026-04-21T08:50:00Z", text: "Agree — needs clearer deliverables. Rejecting." }
    ]
  },

  // Pre-seeded milestone progress notes per proposal ID
  milestoneUpdates: {
    1: [
      { milestoneIdx: 0, note: "Research phase complete. Prototype demo available at GitHub. Requesting review.", time: "2026-05-08T10:00:00Z" }
    ],
    3: [
      { milestoneIdx: 0, note: "Community events completed across 3 campuses. 120 students engaged.", time: "2026-04-30T14:00:00Z" },
      { milestoneIdx: 1, note: "Training sessions completed. Team roster finalized.", time: "2026-05-03T09:30:00Z" }
    ]
  },

  activity: [
    { time: "Just now", message: "Dashboard initialized in demo mode." },
    { time: "5m ago", message: "AI Study Assistant entered voting stage — 3 support, 1 against." },
    { time: "35m ago", message: "Sustainability Lab Upgrade received second milestone release (2.0 ETH)." },
    { time: "1h ago", message: "Committee Chair added a reviewer comment on AI Study Assistant." },
    { time: "3h ago", message: "Robotics Outreach Initiative funded — community milestone released." },
    { time: "6h ago", message: "Treasury deposit of 5 ETH recorded by admin." }
  ],

  workflow: [
    { title: "Proposal submitted", description: "Creators submit a grant proposal with budget, milestones, and category details.", state: "complete" },
    { title: "Under review", description: "The committee screens ideas, checks fit and funding needs, then prepares for voting.", state: "complete" },
    { title: "Committee voting", description: "Members cast votes on approval, rejection, or funding conditions.", state: "current" },
    { title: "Treasury release", description: "Approved proposals receive funds in installments as milestones complete.", state: "pending" },
    { title: "Milestone tracking", description: "Each milestone is tracked, verified, and released separately to reduce risk.", state: "pending" },
    { title: "Final completion", description: "When all milestones are delivered, the proposal is marked completed and the project closes.", state: "pending" }
  ]
};
