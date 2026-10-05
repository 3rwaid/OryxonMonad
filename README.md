# Oryxon

> Building a sustainable economy on the blockchain.

Oryxon is a Web3 ecosystem on **Monad Testnet** that connects digital collectibles, environmental assets, token utilities, staking, and peer-to-peer trading in one approachable experience.

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-2hakuvwp)

## Project Description

Oryxon turns blockchain features into a simple ecosystem for users who want to collect, support, and participate in sustainable digital assets. The platform combines Oryx Warrior NFTs, OxyTree environmental NFTs, the $OXY token, staking rewards, token exchange, and a creator-friendly marketplace.

The application is currently connected to **Monad Testnet** so the ecosystem can be explored and tested without using mainnet funds.

## What It Does

With Oryxon, users can:

- Connect a compatible Web3 wallet.
- Mint Oryx Warrior NFTs during an active sale phase.
- View NFTs owned by their wallet.
- List eligible NFTs for sale and cancel marketplace listings.
- Purchase OxyTree NFTs with supported payment options.
- Explore the $OXY token ecosystem and token distribution.
- Stake $OXY and claim available rewards.
- Swap tokens through the Oryxon exchange interface.
- Track ecosystem statistics, transactions, and platform information.
- Switch between English and Indonesian translations.

## Features

### Oryx Warrior NFTs

- NFT minting with a configurable supply and mint price.
- Wallet ownership view.
- Marketplace listing flow for owned NFTs.
- Transaction status and block explorer links.

### OxyTree NFTs

- Digital representations of tree species and environmental participation.
- Tree purchase and order tracking.
- Support for payment processing through the platform flow.

### $OXY Token

- Token balance and supply information.
- Token distribution and ecosystem utility details.
- Exchange integration for supported token pairs.

### Staking

- Stake $OXY through the staking pool.
- View staked balances and reward information.
- Claim rewards when they become available.

### Marketplace

- Browse active NFT listings.
- Buy listed assets.
- List owned assets for sale.
- Marketplace fee and creator royalty support through the smart contract flow.

### User Experience

- Responsive layout for desktop and mobile screens.
- Wallet connection and network switching support.
- Clear loading, error, and transaction feedback.
- English and Indonesian language support.
- Public ecosystem pages for documentation, FAQs, resources, and legal information.

## Deployed Smart Contract Links

The application targets **Monad Testnet**.

| Contract | Explorer link |
| --- | --- |
| IDO Vesting | [View IDO Vesting contract](https://testnet.monadexplorer.com/address/0xa5BB12B9808Ab034D75aa457066C2f082E345b45) |
| $OXY Token | Deployment address is supplied by the active application deployment |
| Oryx Warrior NFT | Deployment address is supplied by the active application deployment |
| OxyTree NFT | Deployment address is supplied by the active application deployment |
| Staking Pool | Deployment address is supplied by the active application deployment |
| Marketplace | Deployment address is supplied by the active application deployment |
| OxyDEX | Deployment address is supplied by the active application deployment |

The app automatically creates transaction links using the Monad Testnet Explorer after wallet actions are completed.

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- ethers.js
- wagmi and Web3Modal
- Supabase for application data and server-side workflows
- Solidity smart contracts
- Monad Testnet

## Getting Started

### Requirements

- Node.js 18 or newer
- A compatible Web3 wallet, such as MetaMask
- Monad Testnet configured in the wallet

### Install

```bash
npm install
```

### Start the project

```bash
npm run dev
```

### Available checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Network Information

| Setting | Value |
| --- | --- |
| Network | Monad Testnet |
| Chain ID | `10143` |
| RPC | `https://testnet-rpc.monad.xyz` |
| Explorer | [Monad Testnet Explorer](https://testnet.monadexplorer.com) |

Use testnet funds only while interacting with the current deployment.

## Smart Contracts

The Solidity source files are available in the [`contracts`](./contracts) directory. The frontend reads the deployed contract addresses supplied by the active deployment configuration and uses the matching ABIs in [`src/lib/abi`](./src/lib/abi).

## Project Structure

```text
contracts/       Solidity smart contracts
src/components/  Reusable interface sections
src/hooks/       Blockchain and application data hooks
src/pages/       Main application pages
src/lib/         Wallet, contract, translation, and shared utilities
supabase/        Database migrations and server-side functions
```

## Status

Oryxon is an active testnet project. Features and contract deployments may change as the ecosystem evolves.

## License

No open-source license has been declared yet. Please contact the project owner before redistributing or using this code in another project.
