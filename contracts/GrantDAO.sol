// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GrantDAO
/// @notice A lightweight DAO for student micro-grant proposals, committee voting, and milestone-based payouts.
/// @dev This contract manages proposal creation, committee voting, milestone funding, and treasury deposits.
contract GrantDAO {
    /// @notice Proposal lifecycle states used to control voting, funding, and completion.
    enum ProposalStatus {
        Pending,
        Voting,
        Approved,
        Rejected,
        Funded,
        Completed,
        Cancelled
    }

    /// @notice A grant milestone with an amount and release status.
    struct Milestone {
        string title;
        uint256 amount;
        bool released;
    }

    /// @notice Stores the core proposal details and voting state.
    struct Proposal {
        address creator;
        string title;
        string description;
        string category;
        uint256 requestedAmount;
        uint256 createdAt;
        uint256 votingDeadline;
        ProposalStatus status;
        uint256 milestoneCount;
        uint256 nextMilestoneIndex;
        uint256 supportCount;
        uint256 againstCount;
        bool exists;
    }

    /// @notice Contract admin address with privileged DAO configuration rights.
    address public immutable admin;
    /// @notice Running proposal counter for assigning unique proposal IDs.
    uint256 public proposalCounter;
    /// @notice Count of active committee members who can vote.
    uint256 public committeeMemberCount;
    /// @notice Approval threshold percentage used to determine whether proposals pass.
    uint256 public approvalThresholdPercent;

    /// @notice Tracks addresses that are authorized committee voters.
    mapping(address => bool) public isCommitteeMember;
    /// @notice Stores proposals by their unique numeric ID.
    mapping(uint256 => Proposal) public proposals;
    /// @notice Stores milestone data for each proposal, keyed by proposal ID and milestone index.
    mapping(uint256 => mapping(uint256 => Milestone)) public proposalMilestones;
    /// @notice Tracks whether a committee member has already voted on a proposal.
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event CommitteeMemberAdded(address indexed member);
    event CommitteeMemberRemoved(address indexed member);
    event TreasuryDeposited(address indexed sender, uint256 amount);
    event ProposalSubmitted(uint256 indexed proposalId, address indexed creator, string title);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalFinalized(uint256 indexed proposalId, ProposalStatus status);
    event MilestoneReleased(uint256 indexed proposalId, uint256 milestoneIndex, uint256 amount);
    event ProposalFunded(uint256 indexed proposalId, uint256 totalAmount);

    /// @notice Reentrancy guard flag used by nonReentrant modifier.
    bool private locked;

    /// @notice Restricts execution to the DAO admin only.
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action.");
        _;
    }

    /// @notice Restricts execution to registered committee members.
    modifier onlyCommittee() {
        require(isCommitteeMember[msg.sender], "Only committee members can perform this action.");
        _;
    }

    /// @notice Simple reentrancy guard to protect state writes and transfers.
    modifier nonReentrant() {
        require(!locked, "Reentrant call detected.");
        locked = true;
        _;
        locked = false;
    }

    /// @notice Ensures the referenced proposal exists before executing the function.
    modifier proposalExists(uint256 proposalId) {
        require(proposals[proposalId].exists, "Proposal not found.");
        _;
    }

    /// @notice Initialize the DAO with an approval threshold and set contract deployer as admin.
    /// @param _approvalThresholdPercent The percentage of committee support required for proposal approval.
    constructor(uint256 _approvalThresholdPercent) {
        require(_approvalThresholdPercent > 0 && _approvalThresholdPercent <= 100, "Threshold must be 1-100.");
        admin = msg.sender;
        approvalThresholdPercent = _approvalThresholdPercent;
    }

    /// @notice Accept plain ETH transfers and record the deposit event for treasury funding.
    receive() external payable {
        emit TreasuryDeposited(msg.sender, msg.value);
    }

    /// @notice Supports explicit treasury deposits into the DAO contract.
    /// @dev Preserves on-chain treasury funding for proposal milestones.
    function depositTreasury() external payable {
        require(msg.value > 0, "Deposit amount must be positive.");
        emit TreasuryDeposited(msg.sender, msg.value);
    }

    /// @notice Grant admin authority to add a committee voter.
    /// @param member Address of the committee member being added.
    function addCommitteeMember(address member) external onlyAdmin {
        require(member != address(0), "Member address cannot be zero.");
        require(!isCommitteeMember[member], "Member already exists.");

        isCommitteeMember[member] = true;
        committeeMemberCount += 1;

        emit CommitteeMemberAdded(member);
    }

    /// @notice Remove voting rights from a committee member.
    /// @param member Address of the member to remove.
    function removeCommitteeMember(address member) external onlyAdmin {
        require(isCommitteeMember[member], "Member does not exist.");

        isCommitteeMember[member] = false;
        committeeMemberCount -= 1;

        emit CommitteeMemberRemoved(member);
    }

    /// @notice Submit a new grant proposal with milestone funding details.
    /// @dev Proposal creators must supply milestones that sum to the requested amount.
    function submitProposal(
        string calldata title,
        string calldata description,
        string calldata category,
        uint256 requestedAmount,
        uint256 votingDurationSeconds,
        string[] calldata milestoneTitles,
        uint256[] calldata milestoneAmounts
    ) external {
        require(bytes(title).length > 0, "Proposal title is required.");
        require(bytes(description).length > 0, "Proposal description is required.");
        require(bytes(category).length > 0, "Proposal category is required.");
        require(requestedAmount > 0, "Requested amount must be positive.");
        require(votingDurationSeconds >= 60, "Voting duration must be at least 60 seconds.");
        require(milestoneTitles.length > 0, "At least one milestone is required.");
        require(milestoneTitles.length == milestoneAmounts.length, "Milestone arrays must match.");

        uint256 totalMilestoneAmount = 0;
        for (uint256 i = 0; i < milestoneAmounts.length; i += 1) {
            require(bytes(milestoneTitles[i]).length > 0, "Milestone title is required.");
            require(milestoneAmounts[i] > 0, "Milestone amount must be positive.");
            totalMilestoneAmount += milestoneAmounts[i];
        }

        require(totalMilestoneAmount == requestedAmount, "Milestone totals must equal requested amount.");

        proposalCounter += 1;
        uint256 proposalId = proposalCounter;
        Proposal storage proposal = proposals[proposalId];
        proposal.creator = msg.sender;
        proposal.title = title;
        proposal.description = description;
        proposal.category = category;
        proposal.requestedAmount = requestedAmount;
        proposal.createdAt = block.timestamp;
        proposal.votingDeadline = block.timestamp + votingDurationSeconds;
        proposal.status = ProposalStatus.Voting;
        proposal.milestoneCount = milestoneTitles.length;
        proposal.nextMilestoneIndex = 0;
        proposal.supportCount = 0;
        proposal.againstCount = 0;
        proposal.exists = true;

        for (uint256 i = 0; i < milestoneTitles.length; i += 1) {
            proposalMilestones[proposalId][i] = Milestone({
                title: milestoneTitles[i],
                amount: milestoneAmounts[i],
                released: false
            });
        }

        emit ProposalSubmitted(proposalId, msg.sender, title);
    }

    /// @notice Cast a vote on an active proposal as a committee member.
    /// @param proposalId The proposal being voted on.
    /// @param support True to support approval, false to vote against.
    function voteOnProposal(uint256 proposalId, bool support) external onlyCommittee proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.Voting, "Voting is not open.");
        require(block.timestamp < proposal.votingDeadline, "Voting deadline has passed.");
        require(!hasVoted[proposalId][msg.sender], "Committee member already voted.");

        hasVoted[proposalId][msg.sender] = true;
        if (support) {
            proposal.supportCount += 1;
        } else {
            proposal.againstCount += 1;
        }

        emit VoteCast(proposalId, msg.sender, support);
    }

    /// @notice Finalize voting on a proposal once the deadline passes.
    /// @dev Uses committee member count and the approval threshold to determine pass/fail.
    function finalizeProposal(uint256 proposalId) external proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.Voting, "Proposal is not in voting stage.");
        require(block.timestamp >= proposal.votingDeadline, "Voting is still open.");
        require(committeeMemberCount > 0, "No committee members registered.");

        uint256 requiredSupport = (committeeMemberCount * approvalThresholdPercent + 99) / 100;
        if (proposal.supportCount >= requiredSupport && proposal.supportCount > proposal.againstCount) {
            proposal.status = ProposalStatus.Approved;
            emit ProposalFinalized(proposalId, ProposalStatus.Approved);
        } else {
            proposal.status = ProposalStatus.Rejected;
            emit ProposalFinalized(proposalId, ProposalStatus.Rejected);
        }
    }

    /// @notice Release the next unpaid milestone to the proposal creator.
    /// @dev Uses nonReentrant to protect the transfer and updates status to Funded or Completed.
    function releaseNextMilestone(uint256 proposalId) external onlyCommittee nonReentrant proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.Approved || proposal.status == ProposalStatus.Funded, "Proposal is not approved for funding.");
        require(proposal.nextMilestoneIndex < proposal.milestoneCount, "All milestones have been released.");

        Milestone storage milestone = proposalMilestones[proposalId][proposal.nextMilestoneIndex];
        require(!milestone.released, "Milestone already released.");
        require(address(this).balance >= milestone.amount, "Insufficient treasury balance.");

        milestone.released = true;
        proposal.nextMilestoneIndex += 1;
        if (proposal.nextMilestoneIndex == proposal.milestoneCount) {
            proposal.status = ProposalStatus.Completed;
        } else {
            proposal.status = ProposalStatus.Funded;
        }

        payable(proposal.creator).transfer(milestone.amount);

        emit MilestoneReleased(proposalId, proposal.nextMilestoneIndex - 1, milestone.amount);
        emit ProposalFunded(proposalId, milestone.amount);
    }

    /// @notice Read helper for contract callers to check committee membership.
    function getCommitteeMember(address member) external view returns (bool) {
        return isCommitteeMember[member];
    }

    /// @notice Fetch the core stored proposal data for a given proposal ID.
    /// @param proposalId The ID of the proposal to query.
    function getProposal(uint256 proposalId)
        external
        view
        proposalExists(proposalId)
        returns (
            address creator,
            string memory title,
            string memory description,
            string memory category,
            uint256 requestedAmount,
            uint256 createdAt,
            uint256 votingDeadline,
            ProposalStatus status,
            uint256 milestoneCount,
            uint256 nextMilestoneIndex,
            uint256 supportCount,
            uint256 againstCount
        )
    {
        Proposal memory proposal = proposals[proposalId];
        return (
            proposal.creator,
            proposal.title,
            proposal.description,
            proposal.category,
            proposal.requestedAmount,
            proposal.createdAt,
            proposal.votingDeadline,
            proposal.status,
            proposal.milestoneCount,
            proposal.nextMilestoneIndex,
            proposal.supportCount,
            proposal.againstCount
        );
    }

    /// @notice Read the current ETH balance held by the DAO treasury.
    function balance() external view returns (uint256) {
        return address(this).balance;
    }
}
