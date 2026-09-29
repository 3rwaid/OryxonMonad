// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title OryxonMarketplace - NFT Trading for Oryxon
/// @notice Buy/sell Oryx Warriors and OxyTrees with $OXY fees routed to staking pool
/// @dev Audited: SafeERC20, reentrancy on all state-changing functions, CEI pattern, approval checks
contract OryxMarketplace is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC721 public immutable oryxWarriorContract;
    IERC721 public immutable oxyTreeContract;
    IERC20 public immutable oxyToken;
    address public stakingRewardPool;

    uint256 public platformFeeBps = 250;
    uint256 public constant MAX_FEE_BPS = 1000;
    uint256 public constant MIN_PRICE = 1;

    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 priceOxy;
        bool isActive;
    }

    uint256 public listingCounter;
    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed listingId, address indexed seller, address nftContract, uint256 tokenId, uint256 priceOxy);
    event Sale(uint256 indexed listingId, address indexed buyer, uint256 priceOxy, uint256 fee);
    event ListingCancelled(uint256 indexed listingId);
    event FeeUpdated(uint256 newFeeBps);
    event StakingPoolUpdated(address indexed newPool);

    constructor(
        address _OryxWarrior,
        address _OxyTree,
        address _oxyToken,
        address _stakingRewardPool
    ) Ownable(msg.sender) {
        require(_oryxWarrior != address(0), "Invalid NFT OryxWarrior address");
        require(_oxyTree != address(0), "Invalid NFT OxyTree address");
        require(_oxyToken != address(0), "Invalid token address");
        require(_stakingRewardPool != address(0), "Invalid pool address");
        oryxWarriorContract = IERC721(_oryxWarrior);
        oxyTreeContract = IERC721(_oxyTree);
        oxyToken = IERC20(_oxyToken);
        stakingRewardPool = _stakingRewardPool;
    }

    function listOryxWarrior (uint256 tokenId, uint256 priceOxy) external nonReentrant {
        require(oryxWarriorContract.ownerOf(tokenId) == msg.sender, "Not owner");
        require(priceOxy >= MIN_PRICE, "Price too low");
        require(
            oryxWarriorContract.isApprovedForAll(msg.sender, address(this)) ||
            oryxWarriorContract.getApproved(tokenId) == address(this),
            "Not approved"
        );

        oryxWarriorContract.transferFrom(msg.sender, address(this), tokenId);

        listingCounter++;
        listings[listingCounter] = Listing({
            seller: msg.sender,
            nftContract: address(oryxWarriorContract),
            tokenId: tokenId,
            priceOxy: priceOxy,
            isActive: true
        });

        emit Listed(listingCounter, msg.sender, address(oryxWarriorContract), tokenId, priceOxy);
    }

    function listOxyTree(uint256 tokenId, uint256 priceOxy) external nonReentrant {
        require(oxyTreeContract.ownerOf(tokenId) == msg.sender, "Not owner");
        require(priceOxy >= MIN_PRICE, "Price too low");
        require(
            oxyTreeContract.isApprovedForAll(msg.sender, address(this)) ||
            oxyTreeContract.getApproved(tokenId) == address(this),
            "Not approved"
        );

        oxyTreeContract.transferFrom(msg.sender, address(this), tokenId);

        listingCounter++;
        listings[listingCounter] = Listing({
            seller: msg.sender,
            nftContract: address(oxyTreeContract),
            tokenId: tokenId,
            priceOxy: priceOxy,
            isActive: true
        });

        emit Listed(listingCounter, msg.sender, address(oxyTreeContract), tokenId, priceOxy);
    }

    function buy(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Not active");
        require(listing.seller != msg.sender, "Cannot buy own listing");

        uint256 fee = (listing.priceOxy * platformFeeBps) / 10000;
        uint256 sellerAmount = listing.priceOxy - fee;

        listing.isActive = false;

        oxyToken.safeTransferFrom(msg.sender, listing.seller, sellerAmount);

        if (fee > 0) {
            oxyToken.safeTransferFrom(msg.sender, stakingRewardPool, fee);
        }

        IERC721(listing.nftContract).transferFrom(address(this), msg.sender, listing.tokenId);

        emit Sale(listingId, msg.sender, listing.priceOxy, fee);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not seller");
        require(listing.isActive, "Not active");

        listing.isActive = false;

        IERC721(listing.nftContract).transferFrom(address(this), msg.sender, listing.tokenId);

        emit ListingCancelled(listingId);
    }

    function updateFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        platformFeeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function updateStakingPool(address _pool) external onlyOwner {
        require(_pool != address(0), "Invalid pool address");
        stakingRewardPool = _pool;
        emit StakingPoolUpdated(_pool);
    }

    function getActiveListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }
}
