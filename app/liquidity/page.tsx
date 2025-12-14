'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@iota/dapp-kit';
import { Transaction } from '@iota/iota-sdk/transactions';
import TokenSelector from '../components/TokenSelector';
import TokenInput from '../components/TokenInput';
import { listCoin } from '@/lib/constant';
import { getPools } from '@/lib/pools';

type TokenOption = {
  id: string;
  symbol: string;
  name?: string;
  decimals?: number;
  icon?: string;
};

export default function LiquidityPage() {
  const [tokens, setTokens] = useState<TokenOption[]>(
    listCoin.map((coin) => ({
      id: coin.tokenId,
      symbol: coin.symbol,
      name: coin.symbol,
      decimals: coin.decimals,
      icon: coin.icon,
    }))
  );

  const [tokenA, setTokenA] = useState<TokenOption>(tokens[0]);
  const [tokenB, setTokenB] = useState<TokenOption>(tokens[1] ?? tokens[0]);
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [activeTab, setActiveTab] = useState<'add' | 'remove'>('add'); // Add/remove liquidity tabs
  const [sharesToBurn, setSharesToBurn] = useState('');
  const [minA, setMinA] = useState('');
  const [minB, setMinB] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // Load pools/token list (fallback to static)
  useEffect(() => {
    getPools()
      .then((coins) =>
        setTokens(
          coins.map((coin) => ({
            id: coin.tokenId,
            symbol: coin.symbol,
            name: coin.symbol,
            decimals: coin.decimals,
            icon: coin.icon,
          }))
        )
      )
      .catch((err) => console.error('Failed to load pools, using fallback listCoin', err));
  }, []);

  const handleAddLiquidity = async () => {
    if (!account || !amountA || !amountB) return;

    setIsLoading(true);

    try {
      const transaction = new Transaction();

      // This would be replaced with actual contract call
      transaction.moveCall({
        target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::simple_amm::add_liquidity_partial`,
        typeArguments: [tokenA.id, tokenB.id],
        arguments: [
          transaction.object('0x123'), // pool object ID - needs to be fetched
          transaction.pure.u64(parseInt(amountA)),
          transaction.pure.u64(parseInt(amountB)),
          transaction.pure.u64(Math.floor(parseFloat(amountA) * 0.999)), // min amount A
          transaction.pure.u64(Math.floor(parseFloat(amountB) * 0.999)), // min amount B
        ],
      });

      signAndExecuteTransaction(
        {
          transaction,
          account,
        },
        {
          onSuccess: (result) => {
            console.log('Add liquidity successful:', result);
            alert('Liquidity added successfully!');
          },
          onError: (error) => {
            console.error('Add liquidity failed:', error);
            alert('Add liquidity failed: ' + error.message);
          },
          onSettled: () => {
            setIsLoading(false);
          },
        }
      );
    } catch (error) {
      console.error('Error during add liquidity:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      alert('Error during add liquidity: ' + errorMessage);
      setIsLoading(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!account || !sharesToBurn) return;

    setIsLoading(true);

    try {
      const transaction = new Transaction();

      // This would be replaced with actual contract call
      transaction.moveCall({
        target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::simple_amm::remove_liquidity_partial`,
        typeArguments: [tokenA.id, tokenB.id],
        arguments: [
          transaction.object('0x123'), // pool object ID - needs to be fetched
          transaction.object('0x456'), // position object ID - needs to be fetched
          transaction.pure.u64(parseInt(sharesToBurn)),
          transaction.pure.u64(parseInt(minA || '0')),
          transaction.pure.u64(parseInt(minB || '0')),
        ],
      });

      signAndExecuteTransaction(
        {
          transaction,
          account,
        },
        {
          onSuccess: (result) => {
            console.log('Remove liquidity successful:', result);
            alert('Liquidity removed successfully!');
          },
          onError: (error) => {
            console.error('Remove liquidity failed:', error);
            alert('Remove liquidity failed: ' + error.message);
          },
          onSettled: () => {
            setIsLoading(false);
          },
        }
      );
    } catch (error) {
      console.error('Error during remove liquidity:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      alert('Error during remove liquidity: ' + errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-[#2d1b14] bg-gradient-to-b from-[#130f0f] via-[#0b0a0a] to-[#0b0a0a] p-3">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-10 h-64 w-64 rounded-full bg-gradient-to-br from-[#f6b394]/25 to-[#d1583e]/20 blur-3xl" />
        <div className="absolute top-12 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-[#f6b394]/20 via-[#e77a55]/20 to-[#8a2d1b]/20 blur-3xl" />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-3xl border border-[#2d1b14] bg-[#14100f]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#f6b394]">Liquidity</p>
                <h2 className="text-3xl font-bold text-[#fbe5d5]">Deposit &amp; Earn</h2>
                <p className="mt-2 text-[#e6d4c7]">
                  Provide or remove liquidity with confidence. Earn LP fees while keeping price impact low.
                </p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-[#f6b394] via-[#e77a55] to-[#8a2d1b] px-4 py-3 text-black shadow-lg shadow-[#f6b394]/30">
                <p className="text-xs uppercase tracking-wide opacity-80">Pool Fees</p>
                <p className="text-lg font-semibold">0.30% | 20% protocol</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'TVL', value: '$0.00' },
                { label: 'Your Share', value: '0.00%' },
                { label: 'Network', value: 'IOTA Testnet' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/90 px-4 py-3 shadow-sm shadow-black/30 backdrop-blur"
                >
                  <p className="text-xs uppercase tracking-wide text-[#f6b394]/80">{item.label}</p>
                  <p className="text-lg font-semibold text-[#fbe5d5]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="space-y-6 rounded-3xl border border-[#2d1b14] bg-[#14100f]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-[#fbe5d5]">Manage Liquidity</h3>
                <p className="text-sm text-[#e6d4c7]">Deposit or withdraw shares</p>
              </div>
              <div className="rounded-full border border-[#f6b394]/40 bg-[#f6b394]/15 px-3 py-1 text-xs font-semibold text-[#f6b394]">
                Pools
              </div>
            </div>

            <div className="flex rounded-xl border border-[#2d1b14] bg-[#1a1412] p-1">
              <button
                className={`flex-1 rounded-lg py-2 text-center font-medium transition ${
                  activeTab === 'add'
                    ? 'bg-[#0f0d0d] text-[#f6b394] shadow'
                    : 'text-[#e6d4c7]'
                }`}
                onClick={() => setActiveTab('add')}
              >
                Add
              </button>
              <button
                className={`flex-1 rounded-lg py-2 text-center font-medium transition ${
                  activeTab === 'remove'
                    ? 'bg-[#0f0d0d] text-[#f6b394] shadow'
                    : 'text-[#e6d4c7]'
                }`}
                onClick={() => setActiveTab('remove')}
              >
                Remove
              </button>
            </div>

            {activeTab === 'add' && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
                  <TokenInput
                    value={amountA}
                    onChange={setAmountA}
                    title={`Token ${tokenA.symbol} Amount`}
                    balance="0.00"
                    onMaxClick={() => setAmountA('100')}
                  />
                  <div className="mt-3">
                    <TokenSelector
                      tokens={tokens.filter((token) => token.symbol !== tokenB.symbol)}
                      selectedToken={tokenA}
                      onSelectToken={setTokenA}
                      title="Select Token A"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
                  <TokenInput
                    value={amountB}
                    onChange={setAmountB}
                    title={`Token ${tokenB.symbol} Amount`}
                    balance="0.00"
                    onMaxClick={() => setAmountB('100')}
                  />
                  <div className="mt-3">
                    <TokenSelector
                      tokens={tokens.filter((token) => token.symbol !== tokenA.symbol)}
                      selectedToken={tokenB}
                      onSelectToken={setTokenB}
                      title="Select Token B"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
                  <h3 className="mb-2 text-sm font-medium text-[#fbe5d5]">Pool Info</h3>
                  <div className="space-y-2 text-sm text-[#e6d4c7]">
                    <div className="flex justify-between">
                      <span>Rates</span>
                      <span>1 {tokenA.symbol} ≈ 0.000000 {tokenB.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reverse</span>
                      <span>1 {tokenB.symbol} ≈ 0.000000 {tokenA.symbol}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
                  <h3 className="mb-2 text-sm font-medium text-[#fbe5d5]">Your Position</h3>
                  <div className="space-y-2 text-sm text-[#e6d4c7]">
                    <div className="flex justify-between">
                      <span>Liquidity Tokens</span>
                      <span>0.0000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{tokenA.symbol} deposited</span>
                      <span>0.0000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{tokenB.symbol} deposited</span>
                      <span>0.0000</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleAddLiquidity}
                  disabled={!account || !amountA || !amountB || isLoading}
                  className={`w-full rounded-xl py-3 font-medium text-white transition-all ${
                    !account || !amountA || !amountB || isLoading
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#f6b394] via-[#e77a55] to-[#8a2d1b] hover:shadow-lg hover:shadow-[#f6b394]/50'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Adding...
                    </span>
                  ) : !account ? 'Connect Wallet' : 'Add Liquidity'}
                </button>
              </div>
            )}

            {activeTab === 'remove' && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
                  <TokenInput
                    value={sharesToBurn}
                    onChange={setSharesToBurn}
                    title="Shares to Burn"
                    balance="0.00"
                    onMaxClick={() => setSharesToBurn('100')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#fbe5d5]">Min {tokenA.symbol}</label>
                    <input
                      type="number"
                      value={minA}
                      onChange={(e) => setMinA(e.target.value)}
                      placeholder="0.0"
                      className="w-full rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-3 py-2 text-sm text-[#fbe5d5] shadow-inner shadow-black/30 focus:border-[#f6b394] focus:outline-none focus:ring-2 focus:ring-[#f6b394]/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#fbe5d5]">Min {tokenB.symbol}</label>
                    <input
                      type="number"
                      value={minB}
                      onChange={(e) => setMinB(e.target.value)}
                      placeholder="0.0"
                      className="w-full rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-3 py-2 text-sm text-[#fbe5d5] shadow-inner shadow-black/30 focus:border-[#f6b394] focus:outline-none focus:ring-2 focus:ring-[#f6b394]/30"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
                  <h3 className="mb-2 text-sm font-medium text-[#fbe5d5]">Your Position</h3>
                  <div className="space-y-2 text-sm text-[#e6d4c7]">
                    <div className="flex justify-between">
                      <span>Liquidity Tokens</span>
                      <span>0.0000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{tokenA.symbol} available</span>
                      <span>0.0000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{tokenB.symbol} available</span>
                      <span>0.0000</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleRemoveLiquidity}
                  disabled={!account || !sharesToBurn || isLoading}
                  className={`w-full rounded-xl py-3 font-medium text-white transition-all ${
                    !account || !sharesToBurn || isLoading
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#f6b394] via-[#e77a55] to-[#8a2d1b] hover:shadow-lg hover:shadow-[#f6b394]/50'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Removing...
                    </span>
                  ) : !account ? 'Connect Wallet' : 'Remove Liquidity'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
