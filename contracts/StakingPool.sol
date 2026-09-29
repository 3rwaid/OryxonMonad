// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title StakingPool — Oryxon OxyTree Staking
/// @notice Stake OxyTrees to earn $OXY rewards accruing per CLAIM_PERIOD (1 day).
/// @dev Rewards = (rewardPoolBalance * REWARD_RATE_BPS / 10000 / totalStaked) per period,
///      multiplied by full periods elapsed since lastClaimAt. Fractional periods are preserved
///      by advancing lastClaimAt by `periods * CLAIM_PERIOD`, not `block.timestamp`.
contract StakingPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC721 public immutable oxyTree;
    IERC20  public immutable oxyToken;

    uint256 public constant CLAIM_PERIOD    = 1 days;
    uint256 public constant REWARD_RATE_BPS = 10; // 0.10% of pool per day, split across all stakers

    struct StakeInfo {
        address staker;
        uint256 stakedAt;
        uint256 lastClaimAt;
        uint256 totalClaimed;
    }

    mapping(uint256 => StakeInfo)        public stakes;
    mapping(address => uint256[])        public userStakedTokens;
    uint256 public totalStaked;
    uint256 public rewardPoolBalance;

    event Staked(address indexed staker, uint256 indexed tokenId);
    event Unstaked(address indexed staker, uint256 indexed tokenId);
    event RewardsClaimed(address indexed staker, uint256 indexed tokenId, uint256 amount, uint256 periods);
    event RewardPoolFunded(address indexed funder, uint256 amount);
    event MarketplaceFeeReceived(uint256 amount);
    event RewardPoolSynced(uint256 delta);

    constructor(address _oxyTree, address _oxyToken) Ownable(msg.sender) {
        require(_oxyTree != address(0), "Invalid NFT address");
        require(_oxyToken != address(0), "Invalid token address");
        oxyTree  = IERC721(_oxyTree);
        oxyToken = IERC20(_oxyToken);
    }

    // ── Staking ──────────────────────────────────────────────────────────────

    function stake(uint256 tokenId) external nonReentrant {
        require(oxyTree.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(stakes[tokenId].staker == address(0), "Already staked");

        stakes[tokenId] = StakeInfo({
            staker: msg.sender,
            stakedAt: block.timestamp,
            lastClaimAt: block.timestamp,
            totalClaimed: 0
        });

        userStakedTokens[msg.sender].push(tokenId);
        totalStaked++;

        oxyTree.transferFrom(msg.sender, address(this), tokenId);
        emit Staked(msg.sender, tokenId);
    }

    // ── Reward computation ───────────────────────────────────────────────────

    /// @dev Returns (rewardAmount, periodsCounted) for a given stake.
    ///      Caps reward to remaining rewardPoolBalance to prevent underflow.
    function _accruedReward(uint256 tokenId) internal view returns (uint256 reward, uint256 periods) {
        StakeInfo memory info = stakes[tokenId];
        if (info.staker == address(0) || totalStaked == 0) return (0, 0);

        periods = (block.timestamp - info.lastClaimAt) / CLAIM_PERIOD;
        if (periods == 0) return (0, 0);

        uint256 daily = (rewardPoolBalance * REWARD_RATE_BPS) / (10000 * totalStaked);
        reward = daily * periods;
        if (reward > rewardPoolBalance) reward = rewardPoolBalance;
    }

    function calculateReward(uint256 tokenId) external view returns (uint256) {
        (uint256 reward,) = _accruedReward(tokenId);
        return reward;
    }

    function getPendingRewards(address user) external view returns (uint256 total) {
        uint256[] memory tokens = userStakedTokens[user];
        uint256 simulatedPool = rewardPoolBalance;
        for (uint256 i = 0; i < tokens.length; i++) {
            StakeInfo memory info = stakes[tokens[i]];
            if (totalStaked == 0) break;
            uint256 periods = (block.timestamp - info.lastClaimAt) / CLAIM_PERIOD;
            if (periods == 0) continue;
            uint256 daily = (simulatedPool * REWARD_RATE_BPS) / (10000 * totalStaked);
            uint256 r = daily * periods;
            if (r > simulatedPool) r = simulatedPool;
            simulatedPool -= r;
            total += r;
        }
    }

    // ── Claim ────────────────────────────────────────────────────────────────

    function claimRewards(uint256 tokenId) external nonReentrant {
        StakeInfo storage info = stakes[tokenId];
        require(info.staker == msg.sender, "Not staker");

        (uint256 reward, uint256 periods) = _accruedReward(tokenId);
        require(reward > 0, "No rewards available");

        // Advance lastClaimAt by exactly `periods` to preserve fractional time
        info.lastClaimAt += periods * CLAIM_PERIOD;
        info.totalClaimed += reward;
        rewardPoolBalance -= reward;

        oxyToken.safeTransfer(msg.sender, reward);
        emit RewardsClaimed(msg.sender, tokenId, reward, periods);
    }

    function claimAll() external nonReentrant {
        uint256[] memory tokens = userStakedTokens[msg.sender];
        require(tokens.length > 0, "No staked tokens");

        uint256 totalReward;
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 tokenId = tokens[i];
            StakeInfo storage info = stakes[tokenId];

            // Re-compute against current rewardPoolBalance, which may have shrunk
            // from prior iterations — earlier claimers naturally get slightly more.
            uint256 periods = (block.timestamp - info.lastClaimAt) / CLAIM_PERIOD;
            if (periods == 0 || totalStaked == 0) continue;

            uint256 daily = (rewardPoolBalance * REWARD_RATE_BPS) / (10000 * totalStaked);
            uint256 reward = daily * periods;
            if (reward > rewardPoolBalance) reward = rewardPoolBalance;
            if (reward == 0) continue;

            info.lastClaimAt += periods * CLAIM_PERIOD;
            info.totalClaimed += reward;
            rewardPoolBalance -= reward;
            totalReward += reward;

            emit RewardsClaimed(msg.sender, tokenId, reward, periods);
        }

        require(totalReward > 0, "Nothing to claim");
        oxyToken.safeTransfer(msg.sender, totalReward);
    }

    // ── Unstake ──────────────────────────────────────────────────────────────

    function unstake(uint256 tokenId) external nonReentrant {
        StakeInfo storage info = stakes[tokenId];
        require(info.staker == msg.sender, "Not staker");

        // Settle accrued rewards before removing from totalStaked
        (uint256 reward,) = _accruedReward(tokenId);

        address staker = info.staker;
        _removeTokenFromUser(staker, tokenId);
        delete stakes[tokenId];
        totalStaked--;

        if (reward > 0) {
            rewardPoolBalance -= reward;
            oxyToken.safeTransfer(staker, reward);
        }

        oxyTree.transferFrom(address(this), staker, tokenId);
        emit Unstaked(staker, tokenId);
    }

    // ── Pool funding ─────────────────────────────────────────────────────────

    function fundRewardsPool(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        oxyToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPoolBalance += amount;
        emit RewardPoolFunded(msg.sender, amount);
    }

    /// @notice Sync OXY tokens that were sent directly to this contract (e.g. via mintStakingAllocation)
    /// into rewardPoolBalance so they can be distributed as rewards.
    function syncRewardPool() external onlyOwner {
        uint256 actual = oxyToken.balanceOf(address(this));
        require(actual > rewardPoolBalance, "No untracked balance to sync");
        uint256 delta = actual - rewardPoolBalance;
        rewardPoolBalance += delta;
        emit RewardPoolSynced(delta);
    }

    function receiveMarketplaceFees(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        oxyToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPoolBalance += amount;
        emit MarketplaceFeeReceived(amount);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function getUserStakedTokens(address user) external view returns (uint256[] memory) {
        return userStakedTokens[user];
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _removeTokenFromUser(address user, uint256 tokenId) internal {
        uint256[] storage tokens = userStakedTokens[user];
        uint256 len = tokens.length;
        for (uint256 i = 0; i < len; i++) {
            if (tokens[i] == tokenId) {
                tokens[i] = tokens[len - 1];
                tokens.pop();
                break;
            }
        }
    }
}
