// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Oryx Warrior Genesis Collection
/// @notice 1,000 limited supply warrior characters with public sale phases
/// @dev Audited: reentrancy protection, excess refund, proper fund splitting, zero-address checks
contract OryxWarrior is ERC721Enumerable, Ownable, ReentrancyGuard {
    uint256 public constant MAX_SUPPLY = 1000;
    uint256 public constant MINT_PRICE = 0.01 ether;
    uint256 public constant MAX_PER_WALLET = 5;

    enum SalePhase { Inactive, Presale, PublicSale }
    SalePhase public currentPhase;

    mapping(address => uint256) public mintedPerWallet;
    mapping(address => bool) public presaleWhitelist;

    string private _baseTokenURI;
    uint256 private _tokenIdCounter;

    address public immutable ecosystemFund;
    address public immutable treeFund;

    uint256 private constant ECOSYSTEM_SHARE_BPS = 6000;
    uint256 private constant TREE_SHARE_BPS = 4000;

    event PhaseUpdated(SalePhase newPhase);
    event Minted(address indexed to, uint256 startTokenId, uint256 quantity);
    event FundsWithdrawn(uint256 ecosystemAmount, uint256 treeAmount);

    constructor(
        address _ecosystemFund,
        address _treeFund
    ) ERC721("OryxWarrior", "Oryx") Ownable(msg.sender) {
        require(_ecosystemFund != address(0), "Invalid ecosystem fund");
        require(_treeFund != address(0), "Invalid tree fund");
        ecosystemFund = _ecosystemFund;
        treeFund = _treeFund;
    }

    function setPhase(SalePhase _phase) external onlyOwner {
        currentPhase = _phase;
        emit PhaseUpdated(_phase);
    }

    function addToWhitelist(address[] calldata addresses) external onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            require(addresses[i] != address(0), "Invalid address");
            presaleWhitelist[addresses[i]] = true;
        }
    }

    function removeFromWhitelist(address[] calldata addresses) external onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            presaleWhitelist[addresses[i]] = false;
        }
    }

    function mint(uint256 quantity) external payable nonReentrant {
        require(currentPhase != SalePhase.Inactive, "Sale not active");
        require(quantity > 0, "Quantity must be > 0");
        require(_tokenIdCounter + quantity <= MAX_SUPPLY, "Exceeds max supply");
        require(mintedPerWallet[msg.sender] + quantity <= MAX_PER_WALLET, "Exceeds wallet limit");

        uint256 totalCost = MINT_PRICE * quantity;
        require(msg.value >= totalCost, "Insufficient payment");

        if (currentPhase == SalePhase.Presale) {
            require(presaleWhitelist[msg.sender], "Not whitelisted");
        }

        mintedPerWallet[msg.sender] += quantity;

        uint256 startId = _tokenIdCounter + 1;
        for (uint256 i = 0; i < quantity; i++) {
            _tokenIdCounter++;
            _safeMint(msg.sender, _tokenIdCounter);
        }

        uint256 excess = msg.value - totalCost;
        if (excess > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: excess}("");
            require(refunded, "Refund failed");
        }

        emit Minted(msg.sender, startId, quantity);
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        uint256 ecosystemAmount = (balance * ECOSYSTEM_SHARE_BPS) / 10000;
        uint256 treeAmount = balance - ecosystemAmount;

        (bool sentEco, ) = payable(ecosystemFund).call{value: ecosystemAmount}("");
        require(sentEco, "Ecosystem transfer failed");

        (bool sentTree, ) = payable(treeFund).call{value: treeAmount}("");
        require(sentTree, "Tree fund transfer failed");

        emit FundsWithdrawn(ecosystemAmount, treeAmount);
    }

    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }
}
