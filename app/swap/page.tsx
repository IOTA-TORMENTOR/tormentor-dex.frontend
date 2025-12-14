'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrentAccount, useIotaClient, useSignAndExecuteTransaction } from '@iota/dapp-kit';
import { useRouter } from 'next/navigation';
import { Transaction, coinWithBalance } from '@iota/iota-sdk/transactions';
import TokenSelector from '../components/TokenSelector';
import TokenInput from '../components/TokenInput';
import { listCoin } from '@/lib/constant';
import { deriveTokensFromPools, getPools, hydratePoolsWithData, PoolWithOnChain } from '@/lib/pools';

const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_ID ?? '';
const NEXT_PUBLIC_PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? '0x0';

type TokenOption = {
  id: string;
  symbol: string;
  name?: string;
  decimals?: number;
  icon?: string;
};

function toBaseUnits(value: string, decimals = 0): number {
  const parsed = parseFloat(value || '0');
  if (Number.isNaN(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed * 10 ** decimals);
}

export default function SwapPage() {
  const [tokens, setTokens] = useState<TokenOption[]>(
    listCoin.map((coin) => ({
      id: coin.tokenId,
      name: coin.symbol,
      symbol: coin.symbol,
      decimals: coin.decimals,
      icon: coin.icon,
    }))
  );
  const [fromToken, setFromToken] = useState<TokenOption>(tokens[0]);
  const [toToken, setToToken] = useState<TokenOption>(tokens[1] ?? tokens[0]);
  const [pools, setPools] = useState<PoolWithOnChain[]>([]);
  const [loadingPools, setLoadingPools] = useState(false);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [isSwapping, setIsSwapping] = useState(false);

  const account = useCurrentAccount();
  const iotaClient = useIotaClient();
  const router = useRouter();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const activePool = useMemo(() => {
    const direct = pools.find((pool) => pool.tokenA.tokenId === fromToken.id && pool.tokenB.tokenId === toToken.id);
    if (direct) return { pool: direct, reversed: false } as const;
    const reversed = pools.find((pool) => pool.tokenA.tokenId === toToken.id && pool.tokenB.tokenId === fromToken.id);
    if (reversed) return { pool: reversed, reversed: true } as const;
    return null;
  }, [pools, fromToken.id, toToken.id]);

  const calculateOutput = () => {
    if (!fromAmount) return '';
    if (activePool?.pool && activePool.pool.reserveA !== undefined && activePool.pool.reserveB !== undefined) {
      const amountIn = parseFloat(fromAmount);
      if (Number.isNaN(amountIn) || amountIn <= 0) return '';
      const reserveIn = activePool.reversed ? activePool.pool.reserveB ?? 0 : activePool.pool.reserveA ?? 0;
      const reserveOut = activePool.reversed ? activePool.pool.reserveA ?? 0 : activePool.pool.reserveB ?? 0;
      if (reserveIn <= 0 || reserveOut <= 0) return '';
      const fee = 0.003; // 0.30%
      const amountAfterFee = amountIn * (1 - fee);
      const out = (reserveOut * amountAfterFee) / (reserveIn + amountAfterFee);
      return out.toFixed(6);
    }
    const rate = 0.95;
    const output = parseFloat(fromAmount) * rate;
    return output.toFixed(6);
  };

  useEffect(() => {
    let mounted = true;
    const loadPools = async () => {
      setLoadingPools(true);
      try {
        const poolMeta = await getPools(iotaClient, REGISTRY_ID);
        const hydrated = await hydratePoolsWithData(iotaClient, poolMeta);
        if (!mounted) return;
        setPools(hydrated);
        const derived = deriveTokensFromPools(hydrated);
        setTokens(
          derived.map((coin) => ({
            id: coin.tokenId,
            name: coin.symbol,
            symbol: coin.symbol,
            decimals: coin.decimals,
            icon: coin.icon,
          }))
        );
      } catch (error) {
        console.error('Failed to load pools, using fallback listCoin', error);
      } finally {
        if (mounted) setLoadingPools(false);
      }
    };

    loadPools();
    return () => {
      mounted = false;
    };
  }, [iotaClient]);

  useEffect(() => {
    if (!tokens.length) return;
    setFromToken((prev) => tokens.find((t) => t.id === prev?.id) ?? tokens[0]);
    setToToken((prev) => tokens.find((t) => t.id === prev?.id) ?? tokens[1] ?? tokens[0]);
  }, [tokens]);

  useEffect(() => {
    if (fromAmount) {
      const output = calculateOutput();
      setToAmount(output);
    } else {
      setToAmount('');
    }
  }, [fromAmount, activePool]);

  const handleSwap = async () => {
    if (!account) {
      alert('Connect wallet first');
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) return;
    if (!REGISTRY_ID) {
      alert('Set NEXT_PUBLIC_REGISTRY_ID in env');
      return;
    }

    if (!activePool?.pool) {
      alert('Pool not found for selected pair');
      return;
    }

    const amountInBase = toBaseUnits(fromAmount, fromToken.decimals ?? 0);
    const estOut = toAmount || calculateOutput() || '0';
    const outBase = toBaseUnits(estOut, toToken.decimals ?? 0);
    const slippageNum = parseFloat(slippage || '0');
    const minOutBase = Math.floor(outBase * (1 - slippageNum / 100));

    setIsSwapping(true);

    try {
      const transaction = new Transaction();
      transaction.setSenderIfNotSet(account.address);
      const swapFn = activePool.reversed ? 'swap_b_to_a' : 'swap_a_to_b';

      const coinIn = transaction.add(
        coinWithBalance({
          type: activePool.reversed ? activePool.pool.tokenB.tokenId : activePool.pool.tokenA.tokenId,
          balance: BigInt(amountInBase),
          useGasCoin: false,
        })
      );

      transaction.moveCall({
        target: `${NEXT_PUBLIC_PACKAGE_ID}::simple_amm_sandbox_fee::${swapFn}`,
        typeArguments: [activePool.pool.tokenA.tokenId, activePool.pool.tokenB.tokenId],
        arguments: [
          transaction.object(REGISTRY_ID),
          transaction.object(activePool.pool.poolId),
          coinIn,
          transaction.pure.u64(minOutBase),
        ],
      });

      signAndExecuteTransaction(
        { transaction, account },
        {
          onSuccess: (result) => {
            console.log('Swap successful:', result);
            router.refresh();
            alert('Swap completed successfully!');
          },
          onError: (error) => {
            console.error('Swap failed:', error);
            alert('Swap failed: ' + error.message);
          },
          onSettled: () => setIsSwapping(false),
        }
      );
    } catch (error) {
      console.error('Error during swap:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      alert('Error during swap: ' + errorMessage);
      setIsSwapping(false);
    }
  };

  const switchTokens = () => {
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);

    const tempAmount = fromAmount;
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const poolStats = activePool?.pool;

  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-[#2d1b14] bg-linear-to-b from-[#130f0f] via-[#0b0a0a] to-[#0b0a0a] p-3">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-10 h-64 w-64 rounded-full bg-linear-to-br from-[#f6b394]/25 to-[#d1583e]/20 blur-3xl" />
        <div className="absolute top-12 -right-24 h-72 w-72 rounded-full bg-linear-to-br from-[#f6b394]/20 via-[#e77a55]/20 to-[#8a2d1b]/20 blur-3xl" />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-3xl border border-[#2d1b14] bg-[#14100f]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#f6b394]">Tormentor DEX</p>
                <h2 className="text-3xl font-bold text-[#fbe5d5]">Swap &amp; Bridge the Easy Way</h2>
                <p className="mt-2 text-[#e6d4c7]">
                  Deep liquidity AMM inspired by modern DEXes. Seamless swaps with protocol fee sharing.
                </p>
              </div>
              <div className="rounded-2xl bg-linear-to-br from-[#f6b394] via-[#e77a55] to-[#8a2d1b] px-4 py-3 text-black shadow-lg shadow-[#f6b394]/30">
                <p className="text-xs uppercase tracking-wide opacity-80">Registry</p>
                <p className="text-sm font-semibold truncate max-w-[220px]" title={REGISTRY_ID || 'Not configured'}>
                  {REGISTRY_ID ? REGISTRY_ID : 'Not set'}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: '24h Volume', value: '$0.00' },
                {
                  label: 'Pool TVL',
                  value:
                    poolStats && poolStats.reserveA !== undefined && poolStats.reserveB !== undefined
                      ? `${poolStats.reserveA.toFixed(4)} ${poolStats.tokenA.symbol}`
                      : '$0.00',
                },
                { label: 'Protocol Fee', value: '0.30% (20% to protocol)' },
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
            {poolStats && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20 sm:grid-cols-2">
                <div className="space-y-1 text-sm text-[#e6d4c7]">
                  <p className="text-xs uppercase tracking-wide text-[#f6b394]/80">Pool</p>
                  <p className="font-semibold text-[#fbe5d5]">{poolStats.tokenA.symbol} / {poolStats.tokenB.symbol}</p>
                  <p className="font-mono text-xs text-[#f6b394] truncate" title={poolStats.poolId}>
                    {poolStats.poolId}
                  </p>
                </div>
                <div className="space-y-1 text-sm text-[#e6d4c7]">
                  <p className="text-xs uppercase tracking-wide text-[#f6b394]/80">Reserves</p>
                  <p>
                    {poolStats.reserveA?.toFixed(6) ?? '0'} {poolStats.tokenA.symbol} / {poolStats.reserveB?.toFixed(6) ?? '0'} {poolStats.tokenB.symbol}
                  </p>
                  <p>LP Supply: {poolStats.lpSupply ?? 0}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="space-y-6 rounded-3xl border border-[#2d1b14] bg-[#14100f]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-[#fbe5d5]">Swap</h3>
                <p className="text-sm text-[#e6d4c7]">Stable UI &amp; precise controls</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#f6b394]/40 bg-[#f6b394]/15 px-3 py-1 text-xs font-semibold text-[#f6b394]">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.15)]" />
                {loadingPools ? 'Syncing pools' : 'Ready'}
              </div>
            </div>

            <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
              <TokenInput
                value={fromAmount}
                onChange={setFromAmount}
                title="From"
                balance="0.00"
                onMaxClick={() => setFromAmount('100')}
              />
              <div className="mt-3">
                <TokenSelector
                  tokens={tokens.filter((t) => t.symbol !== toToken.symbol)}
                  selectedToken={fromToken}
                  onSelectToken={setFromToken}
                  title="Select From Token"
                />
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={switchTokens}
                className="group relative rounded-full bg-linear-to-br from-[#f6b394] via-[#e77a55] to-[#8a2d1b] p-0.5 transition hover:scale-105"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0b0a0a] text-[#f6b394] shadow-md shadow-black/40 transition group-hover:bg-[#14100f]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4 4 4m6 0v12m0 0l4-4m-4 4-4-4" />
                  </svg>
                </div>
              </button>
            </div>

            <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
              <TokenInput
                value={toAmount}
                onChange={setToAmount}
                title="To"
                balance="0.00"
                placeholder="0.0"
              />
              <div className="mt-3">
                <TokenSelector
                  tokens={tokens.filter((t) => t.symbol !== fromToken.symbol)}
                  selectedToken={toToken}
                  onSelectToken={setToToken}
                  title="Select To Token"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#fbe5d5]">Slippage</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={slippage}
                      onChange={(e) => setSlippage(e.target.value)}
                      className="w-full rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-3 py-2 text-sm text-[#fbe5d5] shadow-inner shadow-black/30 focus:border-[#f6b394] focus:outline-none focus:ring-2 focus:ring-[#f6b394]/30"
                      min="0.1"
                      step="0.1"
                    />
                    <span className="absolute right-3 top-2 text-[#f6b394]">%</span>
                  </div>
                  <p className="mt-1 text-xs text-[#e6d4c7]">Recommended: 0.5%</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#fbe5d5]">Rate</label>
                  <div className="rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-3 py-2 text-sm text-[#fbe5d5] shadow-inner shadow-black/30">
                    {fromAmount && toAmount
                      ? `1 ${fromToken.symbol} = ${(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} ${toToken.symbol}`
                      : `1 ${fromToken.symbol} = ? ${toToken.symbol}`}
                  </div>
                  <p className="mt-1 text-xs text-[#e6d4c7]">Output is estimated.</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSwap}
              disabled={!account || !fromAmount || parseFloat(fromAmount) <= 0 || isSwapping || !activePool}
              className={`w-full rounded-xl py-3 font-medium text-white transition-all ${
                !account || !fromAmount || parseFloat(fromAmount) <= 0 || isSwapping || !activePool
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-linear-to-r from-[#f6b394] via-[#e77a55] to-[#8a2d1b] hover:shadow-lg hover:shadow-[#f6b394]/50'
              }`}
            >
              {isSwapping ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Swapping...
                </span>
              ) : !account ? 'Connect Wallet' : 'Swap'}
            </button>

            <div className="space-y-1 text-center text-xs text-[#e6d4c7]">
              <p>Pool Fee: 0.30% | Protocol Fee: 20% of swap fee</p>
              <p>You will receive at least {slippage}% of the estimated amount.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
