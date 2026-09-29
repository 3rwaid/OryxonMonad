// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Oryxon OxyTree Collection (NFT B)
/// @notice Unlimited supply RWA-backed tree NFTs with authorized minter roles
/// @dev Audited: minter access control, zero-address checks, reentrancy protection
contract OxyTree is ERC721Enumerable, Ownable, ReentrancyGuard {
    struct TreeData {
        string species;
        string location;
        string planter;
        uint256 plantedAt;
    }

    mapping(uint256 => TreeData) public trees;
    mapping(address => bool) public authorizedMinters;
    uint256 private _tokenIdCounter;
    string private _baseTokenURI;

    event TreeMinted(uint256 indexed tokenId, address indexed to, string species, string location, string planter);
    event MinterUpdated(address indexed minter, bool authorized);

    modifier onlyMinter() {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized minter");
        _;
    }

    constructor() ERC721("OxyTree", "OXYT") Ownable(msg.sender) {}

    function setMinter(address minter, bool authorized) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        authorizedMinters[minter] = authorized;
        emit MinterUpdated(minter, authorized);
    }

    function mintTree(
        address to,
        string calldata species,
        string calldata location,
        string calldata planter
    ) external onlyMinter nonReentrant returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(bytes(species).length > 0, "Species required");
        require(bytes(location).length > 0, "Location required");

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        trees[tokenId] = TreeData({
            species: species,
            location: location,
            planter: planter,
            plantedAt: block.timestamp
        });

        _safeMint(to, tokenId);
        emit TreeMinted(tokenId, to, species, location, planter);
        return tokenId;
    }

    function mintIncentive(address nftAHolder) external onlyMinter nonReentrant returns (uint256) {
        require(nftAHolder != address(0), "Cannot mint to zero address");

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        trees[tokenId] = TreeData({
            species: "Incentive Tree",
            location: "Ecosystem Reserve",
            planter: "OryxonEcosystem",
            plantedAt: block.timestamp
        });

        _safeMint(nftAHolder, tokenId);
        emit TreeMinted(tokenId, nftAHolder, "Incentive Tree", "Ecosystem Reserve", "OxyEcosystem");
        return tokenId;
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
