// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title OxyToken - $OXY Utility Token
/// @notice ERC-20 with 2.1B max supply and three allocation categories (80/10/10)
/// @dev Audited: zero-address checks, immutable wallets, one-time mint guards, supply cap enforcement
contract OxyToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 2_100_000_000 * 10**18;

    uint256 public constant IDO_ALLOCATION = (MAX_SUPPLY * 10) / 100;
    uint256 public constant LIQUIDITY_ALLOCATION = (MAX_SUPPLY * 10) / 100;
    uint256 public constant STAKING_ALLOCATION = (MAX_SUPPLY * 80) / 100;

    address public stakingContract;
    address public immutable idoWallet;
    address public immutable liquidityWallet;

    bool public idoMinted;
    bool public liquidityMinted;
    bool public stakingMinted;

    event StakingContractSet(address indexed oldAddr, address indexed newAddr);
    event IDOMinted(address indexed to, uint256 amount);
    event LiquidityMinted(address indexed to, uint256 amount);
    event StakingMinted(address indexed to, uint256 amount);

    constructor(
        address _idoWallet,
        address _liquidityWallet
    ) ERC20("Oxy Token", "OXY") Ownable(msg.sender) {
        require(_idoWallet != address(0), "Invalid IDO wallet");
        require(_liquidityWallet != address(0), "Invalid liquidity wallet");
        require(_idoWallet != _liquidityWallet, "Wallets must be different");
        idoWallet = _idoWallet;
        liquidityWallet = _liquidityWallet;
    }

    function mintIDOAllocation() external onlyOwner {
        require(!idoMinted, "IDO already minted");
        idoMinted = true;
        _mint(idoWallet, IDO_ALLOCATION);
        emit IDOMinted(idoWallet, IDO_ALLOCATION);
    }

    function mintLiquidityAllocation() external onlyOwner {
        require(!liquidityMinted, "Liquidity already minted");
        liquidityMinted = true;
        _mint(liquidityWallet, LIQUIDITY_ALLOCATION);
        emit LiquidityMinted(liquidityWallet, LIQUIDITY_ALLOCATION);
    }

    function mintStakingAllocation() external onlyOwner {
        require(!stakingMinted, "Staking already minted");
        require(stakingContract != address(0), "Staking contract not set");
        stakingMinted = true;
        _mint(stakingContract, STAKING_ALLOCATION);
        emit StakingMinted(stakingContract, STAKING_ALLOCATION);
    }

    function setStakingContract(address _stakingContract) external onlyOwner {
        require(_stakingContract != address(0), "Invalid address");
        require(!stakingMinted, "Cannot change after mint");
        address old = stakingContract;
        stakingContract = _stakingContract;
        emit StakingContractSet(old, _stakingContract);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0)) {
            require(totalSupply() + value <= MAX_SUPPLY, "Exceeds max supply");
        }
        super._update(from, to, value);
    }
}
