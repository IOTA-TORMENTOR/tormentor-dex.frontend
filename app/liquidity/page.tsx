'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrentAccount, useIotaClient, useSignAndExecuteTransaction } from '@iota/dapp-kit';
import { Transaction, coinWithBalance } from '@iota/iota-sdk/transactions';
import { useRouter } from 'next/navigation';
import TokenSelector from '../components/TokenSelector';
import TokenInput from '../components/TokenInput';
import { listCoin } from '@/lib/constant';
import { deriveTokensFromPools, getPools, hydratePoolsWithData, PoolWithOnChain } from '@/lib/pools';

type TokenOption = {
  id: string;
  symbol: string;
  name?: string;
  decimals?: number;
  icon?: string;
};

const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_ID ?? '';
const NEXT_PUBLIC_PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? '0x0';
const DEFAULT_COIN_A_OBJECT = process.env.NEXT_PUBLIC_DEFAULT_COIN_A_OBJECT_ID ?? '';
const DEFAULT_COIN_B_OBJECT = process.env.NEXT_PUBLIC_DEFAULT_COIN_B_OBJECT_ID ?? '';
const DEFAULT_POSITION_ID = process.env.NEXT_PUBLIC_POSITION_ID ?? '';

function toBaseUnits(value: string, decimals = 0): number {
  const parsed = parseFloat(value || '0');
  if (Number.isNaN(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed * 10 ** decimals);
}

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
  const [pools, setPools] = useState<PoolWithOnChain[]>([]);
  const [loadingPools, setLoadingPools] = useState(false);

  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [coinAId, setCoinAId] = useState(DEFAULT_COIN_A_OBJECT);
  const [coinBId, setCoinBId] = useState(DEFAULT_COIN_B_OBJECT);

  const [activeTab, setActiveTab] = useState<'add' | 'remove'>('add');
  const [sharesToBurn, setSharesToBurn] = useState('');
  const [minA, setMinA] = useState('');
  const [minB, setMinB] = useState('');
  const [positionId, setPositionId] = useState(DEFAULT_POSITION_ID);
  const [isLoading, setIsLoading] = useState(false);
  const [autoLoadingCoins, setAutoLoadingCoins] = useState(false);

  const account = useCurrentAccount();
  const iotaClient = useIotaClient();
  const router = useRouter();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const activePool = useMemo(() => {
    const direct = pools.find((pool) => pool.tokenA.tokenId === tokenA.id && pool.tokenB.tokenId === tokenB.id);
    if (direct) return { pool: direct, reversed: false } as const;
    const reversed = pools.find((pool) => pool.tokenA.tokenId === tokenB.id && pool.tokenB.tokenId === tokenA.id);
    if (reversed) return { pool: reversed, reversed: true } as const;
    return null;
  }, [pools, tokenA.id, tokenB.id]);

  // Load pools/token list (fallback to static)
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
            symbol: coin.symbol,
            name: coin.symbol,
            decimals: coin.decimals,
            icon: coin.icon,
          }))
        );
      } catch (err) {
        console.error('Failed to load pools, using fallback listCoin', err);
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
    setTokenA((prev) => tokens.find((t) => t.id === prev?.id) ?? tokens[0]);
    setTokenB((prev) => tokens.find((t) => t.id === prev?.id) ?? tokens[1] ?? tokens[0]);
  }, [tokens]);

  // Auto-pick the first owned coin object for the selected types (if available)
  useEffect(() => {
    const owner = account?.address;
    if (!owner || !iotaClient) return;

    let cancelled = false;
    const loadCoinObjects = async () => {
      setAutoLoadingCoins(true);
      try {
        const fetchCoinObject = async (typeTag: string) => {
          if (!typeTag || !typeTag.includes('::')) return undefined;
          // Prefer getCoins to ensure matching coin type
          try {
            const coins = await iotaClient.getCoins({ owner, coinType: typeTag, limit: 50 });
            const hit = coins.data?.[0]?.coinObjectId;
            if (hit) return hit;
          } catch (e) {
            console.warn('getCoins failed, fallback to owned scan', e);
          }

          // Fallback: scan owned objects by type
          try {
            const ownedAny = await iotaClient.getOwnedObjects({
              owner,
              options: { showType: true, showContent: true },
              limit: 50,
            });
            const match = ownedAny.data?.find((item: any) => item?.data?.type === typeTag);
            return match?.data?.objectId as string | undefined;
          } catch (e) {
            console.error('Owned objects scan failed', e);
            return undefined;
          }
        };

        const [aObj, bObj] = await Promise.all([fetchCoinObject(tokenA.id), fetchCoinObject(tokenB.id)]);
        if (cancelled) return;
        if (aObj) setCoinAId(aObj);
        if (bObj) setCoinBId(bObj);
      } catch (err) {
        console.error('Failed to fetch coin object from wallet; keep manual input', err);
      } finally {
        if (!cancelled) setAutoLoadingCoins(false);
      }
    };

    loadCoinObjects();
    return () => {
      cancelled = true;
    };
  }, [account?.address, iotaClient, tokenA.id, tokenB.id]);

const handleAddLiquidity = async () => {
    if (!account || !amountA || !amountB || !activePool?.pool) return;
    if (!REGISTRY_ID) {
      alert('Set NEXT_PUBLIC_REGISTRY_ID in env');
      return;
    }
    const pool = activePool.pool;
    const callTokenA = pool.tokenA;
    const callTokenB = pool.tokenB;
    const inputAmountA = activePool.reversed ? amountB : amountA;
    const inputAmountB = activePool.reversed ? amountA : amountB;
    const decA = callTokenA.decimals ?? 0;
    const decB = callTokenB.decimals ?? 0;

    const amountABase = toBaseUnits(inputAmountA, decA);
    const amountBBase = toBaseUnits(inputAmountB, decB);

    setIsLoading(true);

    console.log('POOL ID:', activePool.pool.poolId);

    try {
      const transaction = new Transaction();
      transaction.setSenderIfNotSet(account.address);
      const [coinAInput] = transaction.add(
        coinWithBalance({
          type: callTokenA.tokenId,
          balance: BigInt(amountABase),
          useGasCoin: false,
        })
      );
      const [coinBInput] = transaction.add(
        coinWithBalance({
          type: callTokenB.tokenId,
          balance: BigInt(amountBBase),
          useGasCoin: false,
        })
      );

      transaction.moveCall({
        target: `${NEXT_PUBLIC_PACKAGE_ID}::simple_amm_sandbox_fee::add_liquidity`,
        typeArguments: [callTokenA.tokenId, callTokenB.tokenId],
        arguments: [
          transaction.object(REGISTRY_ID),
          transaction.object(pool.poolId),
          coinAInput,
          transaction.pure.u64(amountABase),
          coinBInput,
          transaction.pure.u64(amountBBase),
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
            router.refresh();
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
    if (!account || !sharesToBurn || !activePool?.pool) return;
    if (!REGISTRY_ID) {
      alert('Set NEXT_PUBLIC_REGISTRY_ID in env');
      return;
    }
    if (!positionId) {
      alert('Isi Position ID untuk burn shares.');
      return;
    }

    const shares = parseInt(sharesToBurn, 10);
    const pool = activePool.pool;
    const callTokenA = pool.tokenA;
    const callTokenB = pool.tokenB;
    const minABase = toBaseUnits(activePool.reversed ? minB || '0' : minA || '0', callTokenA.decimals ?? 0);
    const minBBase = toBaseUnits(activePool.reversed ? minA || '0' : minB || '0', callTokenB.decimals ?? 0);

    setIsLoading(true);

    try {
      const transaction = new Transaction();
      transaction.setSenderIfNotSet(account.address);

      transaction.moveCall({
        target: `${NEXT_PUBLIC_PACKAGE_ID}::simple_amm_sandbox_fee::remove_liquidity_partial`,
        typeArguments: [callTokenA.tokenId, callTokenB.tokenId],
        arguments: [
          transaction.object(REGISTRY_ID),
          transaction.object(pool.poolId),
          transaction.object(positionId),
          transaction.pure.u64(shares),
          transaction.pure.u64(minABase),
          transaction.pure.u64(minBBase),
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

  const poolStats = activePool?.pool;

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
                <p className="text-xs uppercase tracking-wide opacity-80">Registry</p>
                <p className="text-sm font-semibold truncate max-w-[220px]" title={REGISTRY_ID || 'Not configured'}>
                  {REGISTRY_ID || 'Not set'}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'TVL', value: poolStats ? `${poolStats.reserveA?.toFixed(4) ?? 0} ${poolStats.tokenA.symbol}` : '$0.00' },
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
                <h3 className="text-xl font-semibold text-[#fbe5d5]">Manage Liquidity</h3>
                <p className="text-sm text-[#e6d4c7]">Deposit or withdraw shares</p>
              </div>
              <div className="rounded-full border border-[#f6b394]/40 bg-[#f6b394]/15 px-3 py-1 text-xs font-semibold text-[#f6b394]">
                {loadingPools ? 'Syncing pools' : autoLoadingCoins ? 'Loading coins' : 'Pools'}
              </div>
            </div>

            <div className="flex rounded-xl border border-[#2d1b14] bg-[#1a1412] p-1">
              <button
                className={`flex-1 rounded-lg py-2 text-center font-medium transition ${activeTab === 'add' ? 'bg-[#0f0d0d] text-[#f6b394] shadow' : 'text-[#e6d4c7]'
                  }`}
                onClick={() => setActiveTab('add')}
              >
                Add
              </button>
              <button
                className={`flex-1 rounded-lg py-2 text-center font-medium transition ${activeTab === 'remove' ? 'bg-[#0f0d0d] text-[#f6b394] shadow' : 'text-[#e6d4c7]'
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
                  {/* <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-[#fbe5d5]">Coin Object ID (Token A)</label>
                    <input
                      value={coinAId}
                      onChange={(e) => setCoinAId(e.target.value)}
                      placeholder="0x..."
                      className="w-full rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-3 py-2 text-xs text-[#fbe5d5] shadow-inner shadow-black/30 focus:border-[#f6b394] focus:outline-none focus:ring-2 focus:ring-[#f6b394]/30"
                    />
                  </div> */}
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
                  {/* <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-[#fbe5d5]">Coin Object ID (Token B)</label>
                    <input
                      value={coinBId}
                      onChange={(e) => setCoinBId(e.target.value)}
                      placeholder="0x..."
                      className="w-full rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-3 py-2 text-xs text-[#fbe5d5] shadow-inner shadow-black/30 focus:border-[#f6b394] focus:outline-none focus:ring-2 focus:ring-[#f6b394]/30"
                    />
                  </div> */}
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
                  disabled={!account || !amountA || !amountB || isLoading || !activePool}
                  className={`w-full rounded-xl py-3 font-medium text-white transition-all ${!account || !amountA || !amountB || isLoading || !activePool
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
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-[#fbe5d5]">Position ID</label>
                    <input
                      value={positionId}
                      onChange={(e) => setPositionId(e.target.value)}
                      placeholder="0x..."
                      className="w-full rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-3 py-2 text-xs text-[#fbe5d5] shadow-inner shadow-black/30 focus:border-[#f6b394] focus:outline-none focus:ring-2 focus:ring-[#f6b394]/30"
                    />
                  </div>
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
                  disabled={!account || !sharesToBurn || isLoading || !activePool}
                  className={`w-full rounded-xl py-3 font-medium text-white transition-all ${!account || !sharesToBurn || isLoading || !activePool
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
