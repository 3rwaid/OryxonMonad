// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OryxDEX — Automated Market Maker V2
 * @notice A constant-product AMM (x * y = k) for the OXY/MON pair.
 *
 * Features:
 *  - LP tokens minted proportional to contribution.
 *  - Minimum liquidity burned on first mint (Uni V2 pattern).
 *  - 0.3% swap fee accumulated in the pool (benefits LPs on withdrawal).
 *  - 0.05% protocol fee sent to fee recipient.
 *  - LP staking reward: LPs earn bonus OXY from a dedicated reward pool
 *    at a configurable rate. Rewards accrue per second per LP share.
 *  - Slippage + deadline protection on every user-facing function.
 *  - Emergency pause by owner.
 */
contract OryxDEX is ERC20, ReentrancyGuard, Ownable {

    // ── Constants ──────────────────────────────────────────────────────────────

    uint256 public constant SWAP_FEE_BPS      = 30;    // 0.30%
    uint256 public constant PROTOCOL_FEE_BPS  = 5;     // 0.05%
    uint256 public constant FEE_DENOMINATOR   = 10_000;
    uint256 public constant MINIMUM_LIQUIDITY  = 1_000; // burned on first mint

    // ── Immutables ─────────────────────────────────────────────────────────────

    IERC20 public immutable oxyToken;

    // ── State ──────────────────────────────────────────────────────────────────

    uint256 public reserveOxy;
    uint256 public reserveMon;

    address public feeRecipient;
    bool public paused;

    // ── LP Staking Rewards ─────────────────────────────────────────────────────

    uint256 public rewardPerSecond;
    uint256 public rewardPerTokenStored;
    uint256 public lastUpdateTime;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public pendingRewards;

    uint256 public rewardPoolBalance;

    // ── Events ─────────────────────────────────────────────────────────────────

    event LiquidityAdded(address indexed provider, uint256 oxyAmount, uint256 monAmount, uint256 lpMinted);
    event LiquidityRemoved(address indexed provider, uint256 oxyAmount, uint256 monAmount, uint256 lpBurned);
    event Swap(address indexed user, bool oxyIn, uint256 amountIn, uint256 amountOut);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardPoolFunded(uint256 amount);
    event RewardRateUpdated(uint256 newRate);
    event FeeRecipientUpdated(address newRecipient);
    event Paused(bool state);

    // ── Errors ─────────────────────────────────────────────────────────────────

    error Expired();
    error IsPaused();
    error ZeroAmount();
    error InsufficientLiquidity();
    error SlippageExceeded();
    error TransferFailed();
    error NothingToClaim();

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(address _oxyToken, address _feeRecipient)
        ERC20("OryxDEX LP Token", "OXY-LP")
        Ownable(msg.sender)
    {
        require(_oxyToken != address(0), "Invalid OXY token");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        oxyToken = IERC20(_oxyToken);
        feeRecipient = _feeRecipient;
        lastUpdateTime = block.timestamp;
    }

    // ── Modifiers ──────────────────────────────────────────────────────────────

    modifier notPaused() {
        if (paused) revert IsPaused();
        _;
    }

    modifier ensure(uint256 deadline) {
        if (block.timestamp > deadline) revert Expired();
        _;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            pendingRewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    // ── Reward math ────────────────────────────────────────────────────────────

    function rewardPerToken() public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return rewardPerTokenStored;
        uint256 elapsed = block.timestamp - lastUpdateTime;
        uint256 newReward = elapsed * rewardPerSecond;
        if (newReward > rewardPoolBalance) newReward = rewardPoolBalance;
        return rewardPerTokenStored + (newReward * 1e18) / supply;
    }

    function earned(address account) public view returns (uint256) {
        return (
            (balanceOf(account) * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18
        ) + pendingRewards[account];
    }

    // ── Liquidity ──────────────────────────────────────────────────────────────

    /**
     * @notice Add liquidity. First call seeds the pool and burns MINIMUM_LIQUIDITY.
     * @param oxyDesired OXY tokens to provide.
     * @param oxyMin     Minimum OXY accepted (slippage guard).
     * @param monMin    Minimum MON accepted (slippage guard).
     * @param deadline   Unix timestamp — tx reverts if block.timestamp exceeds this.
     */
    function addLiquidity(
        uint256 oxyDesired,
        uint256 oxyMin,
        uint256 monMin,
        uint256 deadline
    )
        external
        payable
        nonReentrant
        notPaused
        ensure(deadline)
        updateReward(msg.sender)
        returns (uint256 lpMinted, uint256 oxyUsed, uint256 monUsed)
    {
        if (oxyDesired == 0 || msg.value == 0) revert ZeroAmount();

        uint256 _reserveOxy  = reserveOxy;
        uint256 _reserveMon = reserveMon;
        uint256 supply = totalSupply();

        if (supply == 0) {
            // Initial seeding
            oxyUsed  = oxyDesired;
            monUsed = msg.value;
            lpMinted = _sqrt(oxyUsed * monUsed);
            if (lpMinted <= MINIMUM_LIQUIDITY) revert InsufficientLiquidity();
            // Permanently lock MINIMUM_LIQUIDITY to prevent price manipulation
            _mint(address(1), MINIMUM_LIQUIDITY);
            lpMinted -= MINIMUM_LIQUIDITY;
        } else {
            // Match existing ratio — pick the tighter bound
            uint256 optimalOxy  = (msg.value * _reserveOxy) / _reserveMon;
            uint256 optimalMon = (oxyDesired * _reserveMon) / _reserveOxy;

            if (optimalOxy <= oxyDesired) {
                if (optimalOxy < oxyMin) revert SlippageExceeded();
                oxyUsed  = optimalOxy;
                monUsed = msg.value;
            } else {
                if (optimalMon < monMin) revert SlippageExceeded();
                oxyUsed  = oxyDesired;
                monUsed = optimalMon;
            }

            // Mint LP proportional to contribution
            uint256 lpByMon = (monUsed * supply) / _reserveMon;
            uint256 lpByOxy  = (oxyUsed  * supply) / _reserveOxy;
            lpMinted = lpByMon < lpByOxy ? lpByMon : lpByOxy;
            if (lpMinted == 0) revert InsufficientLiquidity();
        }

        // Transfer OXY in (Checks-Effects-Interactions: state already computed)
        if (!oxyToken.transferFrom(msg.sender, address(this), oxyUsed)) revert TransferFailed();

        // Update reserves
        reserveOxy  += oxyUsed;
        reserveMon += monUsed;

        // Mint LP to user
        _mint(msg.sender, lpMinted);

        // Refund excess MON if any
        if (msg.value > monUsed) {
            (bool ok,) = msg.sender.call{value: msg.value - monUsed}("");
            if (!ok) revert TransferFailed();
        }

        emit LiquidityAdded(msg.sender, oxyUsed, monUsed, lpMinted);
    }

    /**
     * @notice Remove liquidity and reclaim underlying tokens + accrued fees.
     * @param lpAmount LP tokens to burn.
     * @param oxyMin   Minimum OXY to receive.
     * @param monMin  Minimum MON to receive.
     * @param deadline Unix timestamp deadline.
     */
    function removeLiquidity(
        uint256 lpAmount,
        uint256 oxyMin,
        uint256 monMin,
        uint256 deadline
    )
        external
        nonReentrant
        ensure(deadline)
        updateReward(msg.sender)
        returns (uint256 oxyOut, uint256 monOut)
    {
        if (lpAmount == 0) revert ZeroAmount();
        uint256 supply = totalSupply();
        if (supply == 0) revert InsufficientLiquidity();

        oxyOut  = (lpAmount * reserveOxy)  / supply;
        monOut = (lpAmount * reserveMon) / supply;

        if (oxyOut  < oxyMin)  revert SlippageExceeded();
        if (monOut < monMin) revert SlippageExceeded();

        // Effects: update state before interactions
        reserveOxy  -= oxyOut;
        reserveMon -= monOut;
        _burn(msg.sender, lpAmount);

        // Interactions: transfer assets out
        if (!oxyToken.transfer(msg.sender, oxyOut)) revert TransferFailed();
        (bool sent,) = msg.sender.call{value: monOut}("");
        if (!sent) revert TransferFailed();

        emit LiquidityRemoved(msg.sender, oxyOut, monOut, lpAmount);
    }

    // ── Swap ───────────────────────────────────────────────────────────────────

    /**
     * @notice Swap MON for OXY.
     * @param minOxyOut Minimum OXY to receive (slippage guard).
     * @param deadline  Unix timestamp deadline.
     */
    function swapMonForOxy(uint256 minOxyOut, uint256 deadline)
        external
        payable
        nonReentrant
        notPaused
        ensure(deadline)
        updateReward(address(0))
        returns (uint256 oxyOut)
    {
        if (msg.value == 0) revert ZeroAmount();
        if (reserveOxy == 0 || reserveMon == 0) revert InsufficientLiquidity();

        uint256 _reserveOxy  = reserveOxy;
        uint256 _reserveMon = reserveMon;

        // Calculate output using constant-product formula with fee
        uint256 totalFee = SWAP_FEE_BPS + PROTOCOL_FEE_BPS;
        uint256 amountInAfterFee = msg.value * (FEE_DENOMINATOR - totalFee);
        oxyOut = (amountInAfterFee * _reserveOxy) /
                 (_reserveMon * FEE_DENOMINATOR + amountInAfterFee);

        if (oxyOut < minOxyOut) revert SlippageExceeded();
        if (oxyOut >= _reserveOxy) revert InsufficientLiquidity();

        // Protocol fee (taken from input MON)
        uint256 protocolFee = (msg.value * PROTOCOL_FEE_BPS) / FEE_DENOMINATOR;

        // Effects: update reserves
        // Swap fee (30 bps) stays in pool; protocol fee leaves
        reserveMon = _reserveMon + (msg.value - protocolFee);
        reserveOxy  = _reserveOxy  - oxyOut;

        // Invariant check: new k >= old k (swap fee must grow the pool)
        assert(reserveMon * reserveOxy >= _reserveMon * _reserveOxy);

        // Interactions: send protocol fee, then output to user
        (bool feeOk,) = feeRecipient.call{value: protocolFee}("");
        if (!feeOk) revert TransferFailed();

        if (!oxyToken.transfer(msg.sender, oxyOut)) revert TransferFailed();

        emit Swap(msg.sender, false, msg.value, oxyOut);
    }

    /**
     * @notice Swap OXY for MON.
     * @param oxyIn      Amount of OXY to swap.
     * @param minMonOut Minimum MON to receive (slippage guard).
     * @param deadline   Unix timestamp deadline.
     */
    function swapOxyForMon(uint256 oxyIn, uint256 minMonOut, uint256 deadline)
        external
        nonReentrant
        notPaused
        ensure(deadline)
        updateReward(address(0))
        returns (uint256 monOut)
    {
        if (oxyIn == 0) revert ZeroAmount();
        if (reserveOxy == 0 || reserveMon == 0) revert InsufficientLiquidity();

        uint256 _reserveOxy  = reserveOxy;
        uint256 _reserveMon = reserveMon;

        // Calculate output
        uint256 totalFee = SWAP_FEE_BPS + PROTOCOL_FEE_BPS;
        uint256 amountInAfterFee = oxyIn * (FEE_DENOMINATOR - totalFee);
        monOut = (amountInAfterFee * _reserveMon) /
                  (_reserveOxy * FEE_DENOMINATOR + amountInAfterFee);

        if (monOut < minMonOut) revert SlippageExceeded();
        if (monOut >= _reserveMon) revert InsufficientLiquidity();

        // Protocol fee (taken from output MON)
        uint256 protocolFee = (monOut * PROTOCOL_FEE_BPS) / FEE_DENOMINATOR;
        uint256 monToUser = monOut - protocolFee;

        // Effects: pull OXY in, then update reserves
        if (!oxyToken.transferFrom(msg.sender, address(this), oxyIn)) revert TransferFailed();
        reserveOxy  = _reserveOxy  + oxyIn;
        reserveMon = _reserveMon - monOut;

        // Invariant: new k must not decrease (swap fee ensures growth)
        assert(reserveOxy * reserveMon >= _reserveOxy * _reserveMon);

        // Interactions: send assets out
        (bool feeOk,) = feeRecipient.call{value: protocolFee}("");
        if (!feeOk) revert TransferFailed();

        (bool sent,) = msg.sender.call{value: monToUser}("");
        if (!sent) revert TransferFailed();

        emit Swap(msg.sender, true, oxyIn, monToUser);
    }

    // ── Reward Claiming ────────────────────────────────────────────────────────

    function claimReward()
        external
        nonReentrant
        updateReward(msg.sender)
    {
        uint256 reward = pendingRewards[msg.sender];
        if (reward == 0) revert NothingToClaim();

        // Cap to available pool to prevent underflow if accumulated > balance
        if (reward > rewardPoolBalance) {
            reward = rewardPoolBalance;
        }

        pendingRewards[msg.sender] -= reward;
        rewardPoolBalance -= reward;

        if (!oxyToken.transfer(msg.sender, reward)) revert TransferFailed();

        emit RewardClaimed(msg.sender, reward);
    }

    // ── Owner functions ────────────────────────────────────────────────────────

    function fundRewardPool(uint256 amount) external onlyOwner updateReward(address(0)) {
        if (!oxyToken.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        rewardPoolBalance += amount;
        emit RewardPoolFunded(amount);
    }

    function setRewardPerSecond(uint256 _rewardPerSecond) external onlyOwner updateReward(address(0)) {
        rewardPerSecond = _rewardPerSecond;
        emit RewardRateUpdated(_rewardPerSecond);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid address");
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    // ── View helpers ───────────────────────────────────────────────────────────

    function getOxyOut(uint256 monIn) external view returns (uint256 oxyOut) {
        if (reserveOxy == 0 || reserveMon == 0 || monIn == 0) return 0;
        uint256 totalFee = SWAP_FEE_BPS + PROTOCOL_FEE_BPS;
        uint256 amountInAfterFee = monIn * (FEE_DENOMINATOR - totalFee);
        oxyOut = (amountInAfterFee * reserveOxy) /
                 (reserveMon * FEE_DENOMINATOR + amountInAfterFee);
    }

    function getMonOut(uint256 oxyIn) external view returns (uint256 monOut) {
        if (reserveOxy == 0 || reserveMon == 0 || oxyIn == 0) return 0;
        uint256 totalFee = SWAP_FEE_BPS + PROTOCOL_FEE_BPS;
        uint256 amountInAfterFee = oxyIn * (FEE_DENOMINATOR - totalFee);
        monOut = (amountInAfterFee * reserveMon) /
                  (reserveOxy * FEE_DENOMINATOR + amountInAfterFee);
    }

    function price() external view returns (uint256) {
        if (reserveMon == 0) return 0;
        return (reserveOxy * 1e18) / reserveMon;
    }

    function poolShare(address user) external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        return (balanceOf(user) * 1e18) / supply;
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) { z = x; x = (y / x + x) / 2; }
        } else if (y != 0) {
            z = 1;
        }
    }

    /**
     * @dev Update rewards on every LP token transfer (including mint/burn).
     */
    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0)) {
            pendingRewards[from] = earned(from);
            userRewardPerTokenPaid[from] = rewardPerTokenStored;
        }
        if (to != address(0) && to != from) {
            pendingRewards[to] = earned(to);
            userRewardPerTokenPaid[to] = rewardPerTokenStored;
        }
        super._update(from, to, amount);
    }

    receive() external payable {}
}
