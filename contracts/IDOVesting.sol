// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title IDOVesting - Secure Token Vesting for IDO Participants
/// @notice Manages cliff + linear vesting schedules for OXY IDO buyers.
///         The owner (IDO admin) creates per-beneficiary schedules after funding
///         the contract with OXY tokens. Beneficiaries claim unlocked tokens at
///         their own pace after the cliff period ends.
///
/// @dev Security measures:
///   - ReentrancyGuard on all state-mutating external calls
///   - SafeERC20 for all token transfers (handles non-standard ERC20)
///   - Pull-pattern: beneficiaries claim; no push distribution
///   - Immutable token address (cannot be swapped post-deploy)
///   - Each schedule is individually revocable by owner (unvested tokens returned)
///   - No self-destruct, no delegatecall, no assembly
///   - Arithmetic overflow protection via Solidity 0.8+ built-in checks
///   - Zero-address and zero-amount guards on every entry point
///   - Schedule immutability: cliff/duration/start cannot change after creation
///   - Explicit total-allocated tracking prevents over-commitment
contract IDOVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Types ────────────────────────────────────────────────────────────────

    struct VestingSchedule {
        uint256 totalAmount;      // Total OXY allocated to this beneficiary
        uint256 released;         // OXY already claimed
        uint64  startTime;        // Vesting clock start (TGE or custom)
        uint64  cliffDuration;    // Seconds after startTime before any claim
        uint64  vestingDuration;  // Total seconds over which tokens vest linearly
        bool    revocable;        // Whether owner can revoke unvested portion
        bool    revoked;          // Whether schedule has been revoked
    }

    // ── State ────────────────────────────────────────────────────────────────

    IERC20 public immutable oxyToken;

    /// @notice All vesting schedules, keyed by beneficiary address.
    ///         One schedule per address; a second createSchedule for the same
    ///         address will revert.
    mapping(address => VestingSchedule) public schedules;

    /// @notice List of all beneficiary addresses (for off-chain enumeration).
    address[] public beneficiaries;
    mapping(address => bool) private _isBeneficiary;

    /// @notice Sum of all totalAmount across active (non-revoked) schedules.
    ///         Used to prevent allocating more tokens than the contract holds.
    uint256 public totalAllocated;

    // ── Events ───────────────────────────────────────────────────────────────

    event ScheduleCreated(
        address indexed beneficiary,
        uint256 totalAmount,
        uint64  startTime,
        uint64  cliffDuration,
        uint64  vestingDuration,
        bool    revocable
    );

    event TokensClaimed(address indexed beneficiary, uint256 amount);

    event ScheduleRevoked(
        address indexed beneficiary,
        uint256 unvestedReturned,
        uint256 vestedReleased
    );

    event EmergencyWithdraw(address indexed to, uint256 amount);

    // ── Constructor ──────────────────────────────────────────────────────────

    /// @param _oxyToken Address of the OXY ERC-20 token contract.
    constructor(address _oxyToken) Ownable(msg.sender) {
        require(_oxyToken != address(0), "IDOVesting: zero token address");
        oxyToken = IERC20(_oxyToken);
    }

    // ── Admin: Create Schedule ───────────────────────────────────────────────

    /// @notice Create a vesting schedule for a beneficiary.
    /// @dev Requires that enough unallocated OXY sits in this contract.
    ///      Each address can have at most one schedule.
    /// @param _beneficiary   Recipient of vested tokens.
    /// @param _totalAmount   Total OXY to vest (18-decimal wei).
    /// @param _startTime     Unix timestamp when vesting clock begins.
    /// @param _cliffDuration Seconds after _startTime before first claim.
    /// @param _vestingDuration Total vesting window in seconds (includes cliff).
    /// @param _revocable     Whether the owner can revoke unvested tokens.
    function createSchedule(
        address _beneficiary,
        uint256 _totalAmount,
        uint64  _startTime,
        uint64  _cliffDuration,
        uint64  _vestingDuration,
        bool    _revocable
    ) external onlyOwner nonReentrant {
        require(_beneficiary != address(0), "IDOVesting: zero beneficiary");
        require(_beneficiary != address(this), "IDOVesting: self beneficiary");
        require(_totalAmount > 0, "IDOVesting: zero amount");
        require(_vestingDuration > 0, "IDOVesting: zero duration");
        require(_cliffDuration <= _vestingDuration, "IDOVesting: cliff > duration");
        require(_startTime > 0, "IDOVesting: zero start time");
        require(!_isBeneficiary[_beneficiary], "IDOVesting: schedule exists");

        uint256 available = oxyToken.balanceOf(address(this)) - totalAllocated;
        require(_totalAmount <= available, "IDOVesting: insufficient balance");

        schedules[_beneficiary] = VestingSchedule({
            totalAmount:     _totalAmount,
            released:        0,
            startTime:       _startTime,
            cliffDuration:   _cliffDuration,
            vestingDuration: _vestingDuration,
            revocable:       _revocable,
            revoked:         false
        });

        totalAllocated += _totalAmount;
        beneficiaries.push(_beneficiary);
        _isBeneficiary[_beneficiary] = true;

        emit ScheduleCreated(
            _beneficiary,
            _totalAmount,
            _startTime,
            _cliffDuration,
            _vestingDuration,
            _revocable
        );
    }

    /// @notice Create multiple vesting schedules in one transaction.
    /// @dev All arrays must have the same length. Saves gas on batch IDO setup.
    function createScheduleBatch(
        address[] calldata _beneficiaries,
        uint256[] calldata _totalAmounts,
        uint64    _startTime,
        uint64    _cliffDuration,
        uint64    _vestingDuration,
        bool      _revocable
    ) external onlyOwner nonReentrant {
        uint256 len = _beneficiaries.length;
        require(len > 0, "IDOVesting: empty batch");
        require(len == _totalAmounts.length, "IDOVesting: length mismatch");
        require(len <= 200, "IDOVesting: batch too large");
        require(_vestingDuration > 0, "IDOVesting: zero duration");
        require(_cliffDuration <= _vestingDuration, "IDOVesting: cliff > duration");
        require(_startTime > 0, "IDOVesting: zero start time");

        uint256 batchTotal = 0;
        for (uint256 i = 0; i < len; i++) {
            batchTotal += _totalAmounts[i];
        }

        uint256 available = oxyToken.balanceOf(address(this)) - totalAllocated;
        require(batchTotal <= available, "IDOVesting: insufficient balance");

        for (uint256 i = 0; i < len; i++) {
            address b = _beneficiaries[i];
            uint256 amt = _totalAmounts[i];

            require(b != address(0), "IDOVesting: zero beneficiary");
            require(b != address(this), "IDOVesting: self beneficiary");
            require(amt > 0, "IDOVesting: zero amount");
            require(!_isBeneficiary[b], "IDOVesting: schedule exists");

            schedules[b] = VestingSchedule({
                totalAmount:     amt,
                released:        0,
                startTime:       _startTime,
                cliffDuration:   _cliffDuration,
                vestingDuration: _vestingDuration,
                revocable:       _revocable,
                revoked:         false
            });

            beneficiaries.push(b);
            _isBeneficiary[b] = true;

            emit ScheduleCreated(b, amt, _startTime, _cliffDuration, _vestingDuration, _revocable);
        }

        totalAllocated += batchTotal;
    }

    // ── Beneficiary: Claim ───────────────────────────────────────────────────

    /// @notice Claim all currently vested and unreleased tokens.
    /// @dev Uses pull-pattern. Beneficiary calls this themselves.
    function claim() external nonReentrant {
        VestingSchedule storage schedule = schedules[msg.sender];
        require(schedule.totalAmount > 0, "IDOVesting: no schedule");

        uint256 claimable = _releasableAmount(schedule);
        require(claimable > 0, "IDOVesting: nothing to claim");

        schedule.released += claimable;
        totalAllocated -= claimable;

        oxyToken.safeTransfer(msg.sender, claimable);

        emit TokensClaimed(msg.sender, claimable);
    }

    // ── Admin: Revoke ────────────────────────────────────────────────────────

    /// @notice Revoke a beneficiary's unvested tokens (returned to owner).
    ///         Already-vested tokens are released to the beneficiary first.
    /// @param _beneficiary Address whose schedule to revoke.
    function revoke(address _beneficiary) external onlyOwner nonReentrant {
        VestingSchedule storage schedule = schedules[_beneficiary];
        require(schedule.totalAmount > 0, "IDOVesting: no schedule");
        require(schedule.revocable, "IDOVesting: not revocable");
        require(!schedule.revoked, "IDOVesting: already revoked");

        uint256 vested = _vestedAmount(schedule);
        uint256 unreleased = vested - schedule.released;
        uint256 unvested = schedule.totalAmount - vested;

        schedule.revoked = true;
        schedule.totalAmount = vested;

        totalAllocated -= (unreleased + unvested);

        if (unreleased > 0) {
            schedule.released += unreleased;
            oxyToken.safeTransfer(_beneficiary, unreleased);
        }

        if (unvested > 0) {
            oxyToken.safeTransfer(owner(), unvested);
        }

        emit ScheduleRevoked(_beneficiary, unvested, unreleased);
    }

    // ── Admin: Emergency ─────────────────────────────────────────────────────

    /// @notice Withdraw unallocated tokens (tokens not assigned to any schedule).
    ///         Cannot touch tokens that are allocated to active schedules.
    /// @param _to Recipient of the unallocated tokens.
    function withdrawUnallocated(address _to) external onlyOwner nonReentrant {
        require(_to != address(0), "IDOVesting: zero address");
        uint256 balance = oxyToken.balanceOf(address(this));
        uint256 unallocated = balance - totalAllocated;
        require(unallocated > 0, "IDOVesting: nothing to withdraw");

        oxyToken.safeTransfer(_to, unallocated);

        emit EmergencyWithdraw(_to, unallocated);
    }

    // ── View Functions ───────────────────────────────────────────────────────

    /// @notice How many tokens are currently claimable by a beneficiary.
    function releasable(address _beneficiary) external view returns (uint256) {
        return _releasableAmount(schedules[_beneficiary]);
    }

    /// @notice How many tokens have vested in total for a beneficiary.
    function vested(address _beneficiary) external view returns (uint256) {
        return _vestedAmount(schedules[_beneficiary]);
    }

    /// @notice Total number of beneficiaries (including revoked).
    function beneficiaryCount() external view returns (uint256) {
        return beneficiaries.length;
    }

    /// @notice Full schedule details for a beneficiary.
    function getSchedule(address _beneficiary)
        external
        view
        returns (
            uint256 totalAmount,
            uint256 released,
            uint64  startTime,
            uint64  cliffDuration,
            uint64  vestingDuration,
            bool    revocable,
            bool    revoked,
            uint256 currentlyVested,
            uint256 currentlyClaimable
        )
    {
        VestingSchedule storage s = schedules[_beneficiary];
        return (
            s.totalAmount,
            s.released,
            s.startTime,
            s.cliffDuration,
            s.vestingDuration,
            s.revocable,
            s.revoked,
            _vestedAmount(s),
            _releasableAmount(s)
        );
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    /// @dev Calculates total vested amount based on linear schedule + cliff.
    function _vestedAmount(VestingSchedule storage schedule)
        internal
        view
        returns (uint256)
    {
        if (schedule.totalAmount == 0) return 0;
        if (schedule.revoked) return schedule.totalAmount;

        uint256 cliffEnd = uint256(schedule.startTime) + uint256(schedule.cliffDuration);
        if (block.timestamp < cliffEnd) return 0;

        uint256 vestEnd = uint256(schedule.startTime) + uint256(schedule.vestingDuration);
        if (block.timestamp >= vestEnd) return schedule.totalAmount;

        uint256 elapsed = block.timestamp - schedule.startTime;
        return (schedule.totalAmount * elapsed) / schedule.vestingDuration;
    }

    /// @dev Claimable = vested - already released.
    function _releasableAmount(VestingSchedule storage schedule)
        internal
        view
        returns (uint256)
    {
        return _vestedAmount(schedule) - schedule.released;
    }
}
