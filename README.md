# Tormentor DEX

A decentralized exchange (DEX) built on the IOTA blockchain using Next.js and Move smart contracts. This project implements an automated market maker (AMM) with liquidity provision capabilities and fee structures.

## Features

- Swap tokens using a constant product AMM (xy=k)
- Liquidity provision (add/remove liquidity)
- Pool creation for new trading pairs
- Protocol fee collection and distribution
- Integration with IOTA blockchain and wallets
- Responsive UI built with Next.js and Tailwind CSS

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Blockchain**: IOTA
- **Wallet Integration**: @iota/dapp-kit
- **Blockchain SDK**: @iota/iota-sdk
- **Query Management**: @tanstack/react-query
- **Smart Contracts**: Move language (IOTA)

## Architecture

### Frontend Components
- `app/page.tsx` - Landing page with swap functionality
- `app/swap/page.tsx` - Token swapping interface
- `app/liquidity/page.tsx` - Add/remove liquidity interface
- `app/create-pool/page.tsx` - Pool creation interface
- `app/claim-fees/page.tsx` - Fee claiming functionality
- Shared components for navigation, token selection, and balance display

### Smart Contracts
Located in the `contract/` directory:
- `simple_amm.move` - Implements the AMM logic with fee splits
- `coin_idr.move` and `coin_usdc.move` - Mock token implementations
- `token_wrapper.move` - Token minting utilities

#### Key Contract Features:
- Constant product formula (xy=k) for pricing
- Swap fees: 0.30% (30 basis points)
- Protocol fee share: 20% of collected fees
- Support for add/remove liquidity with proportional share calculation
- Protocol fee claim functionality

## Setup

### Prerequisites
- Node.js (v18 or higher)
- An IOTA-compatible wallet

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
NEXT_PUBLIC_PACKAGE_ID=your_move_package_id
NEXT_PUBLIC_IOTA_PROVIDER_URL=https://api.lb-aws.iotaledger.net
```

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/tormentor-dex.git
cd tormentor-dex
```

2. Install dependencies
```bash
npm install
```

3. Run the development server
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Configuration

This project requires a live IOTA node connection and proper Move contract addresses. The smart contracts are located in the `contract/` directory and must be deployed to an IOTA network before the frontend can interact with them.

## Development

### Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the production version
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint for code quality checks

### Project Structure

```
tormentor-dex/
├── app/                    # Next.js app router pages
│   ├── claim-fees/         # Fee claim interface
│   ├── components/         # Reusable UI components
│   ├── create-pool/        # Pool creation interface
│   ├── liquidity/          # Liquidity management
│   ├── swap/               # Trading interface
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   └── providers.tsx       # Global providers
├── contract/              # Move smart contracts
├── lib/                   # Utility functions
├── public/                # Static assets
└── ...
```

## Current Status

The project is in active development. Current features include:
- Basic token swap functionality
- Liquidity provision
- Pool creation
- Fee claiming

Note: Many values are currently mocked and need to be connected to on-chain data for production use.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License.