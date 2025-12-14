'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useIotaClient } from '@iota/dapp-kit';
import { Transaction } from '@iota/iota-sdk/transactions';
import { deriveTokensFromPools, getPools, hydratePoolsWithData, PoolWithOnChain } from '@/lib/pools';

const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_ID ?? '';
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? '0x0';

function toBaseUnits(value: string, decimals = 0): number {
  const parsed = parseFloat(value || '0');
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.floor(parsed * 10 ** decimals);
}

export default function ClaimFeesPage() {
  const [minA, setMinA] = useState('');
  const [minB, setMinB] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pools, setPools] = useState<PoolWithOnChain[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState('');

  const account = useCurrentAccount();
  const iotaClient = useIotaClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  useEffect(() => {
    let mounted = true;
    const loadPools = async () => {
      try {
        const meta = await getPools(iotaClient, REGISTRY_ID);
        const hydrated = await hydratePoolsWithData(iotaClient, meta);
        if (!mounted) return;
        setPools(hydrated);
        setSelectedPoolId((prev) => prev || hydrated[0]?.poolId || '');
      } catch (error) {
        console.error('Failed to load pools for fee claim', error);
      }
    };
    loadPools();
    return () => {
      mounted = false;
    };
  }, [iotaClient]);

  const activePool = useMemo(() => pools.find((p) => p.poolId === selectedPoolId) ?? pools[0], [pools, selectedPoolId]);
  const tokens = deriveTokensFromPools(activePool ? [activePool] : []);
  const tokenA = activePool?.tokenA ?? tokens[0];
  const tokenB = activePool?.tokenB ?? tokens[1];

  const handleClaimFees = async () => {
    if (!account || !activePool) return;
    if (!REGISTRY_ID) {
      alert('Set NEXT_PUBLIC_REGISTRY_ID in env');
      return;
    }

    setIsLoading(true);

    try {
      const transaction = new Transaction();
      const minABase = toBaseUnits(minA || '0', tokenA?.decimals ?? 0);
      const minBBase = toBaseUnits(minB || '0', tokenB?.decimals ?? 0);

      transaction.moveCall({
        target: `${PACKAGE_ID}::simple_amm_sandbox_fee::claim_protocol_fees`,
        typeArguments: [activePool.tokenA.tokenId, activePool.tokenB.tokenId],
        arguments: [
          transaction.object(REGISTRY_ID),
          transaction.object(activePool.poolId),
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
            console.log('Fee claim successful:', result);
            alert('Protocol fees claimed successfully!');
          },
          onError: (error) => {
            console.error('Fee claim failed:', error);
            alert('Fee claim failed: ' + error.message);
          },
          onSettled: () => {
            setIsLoading(false);
          },
        }
      );
    } catch (error) {
      console.error('Error during fee claim:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      alert('Error during fee claim: ' + errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-[#2d1b14] bg-linear-to-b from-[#130f0f] via-[#0b0a0a] to-[#0b0a0a] p-3">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-10 h-64 w-64 rounded-full bg-linear-to-br from-[#f6b394]/25 to-[#d1583e]/20 blur-3xl" />
        <div className="absolute top-12 -right-24 h-72 w-72 rounded-full bg-linear-to-br from-[#f6b394]/20 via-[#e77a55]/20 to-[#8a2d1b]/20 blur-3xl" />
      </div>

      <div className="space-y-5 rounded-3xl border border-[#2d1b14] bg-[#14100f]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-[#fbe5d5]">Claim Protocol Fees</h2>
          <p className="text-sm text-[#e6d4c7]">Withdraw accumulated protocol fees from your pools.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
            <label className="text-xs uppercase tracking-wide text-[#f6b394]">Select Pool</label>
            <select
              value={selectedPoolId}
              onChange={(e) => setSelectedPoolId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-3 py-2 text-sm text-[#fbe5d5] focus:border-[#f6b394] focus:outline-none focus:ring-2 focus:ring-[#f6b394]/30"
            >
              {pools.map((pool) => (
                <option key={pool.poolId} value={pool.poolId}>
                  {pool.tokenA.symbol} / {pool.tokenB.symbol} ({pool.poolId.slice(0, 8)}...)
                </option>
              ))}
              {!pools.length && <option>Pool fallback (set registry)</option>}
            </select>
          </div>
          <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20 text-sm text-[#e6d4c7]">
            <p className="text-xs uppercase tracking-wide text-[#f6b394]">Registry</p>
            <p className="mt-1 font-mono text-xs text-[#fbe5d5] truncate" title={REGISTRY_ID || 'Not configured'}>
              {REGISTRY_ID || 'Not set'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
          <p className="text-sm font-semibold text-[#f6b394]">Available Fees</p>
          <div className="mt-3 space-y-3">
            <div className="flex justify-between rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-3 py-2 text-[#fbe5d5]">
              <span>Token A Fees:</span>
              <span className="font-semibold">
                {activePool?.protocolReserveA?.toFixed(6) ?? '0.000000'} {tokenA?.symbol ?? 'Token A'}
              </span>
            </div>
            <div className="flex justify-between rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-3 py-2 text-[#fbe5d5]">
              <span>Token B Fees:</span>
              <span className="font-semibold">
                {activePool?.protocolReserveB?.toFixed(6) ?? '0.000000'} {tokenB?.symbol ?? 'Token B'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#fbe5d5]">Minimum {tokenA?.symbol ?? 'Token A'} to Receive</label>
            <input
              type="number"
              value={minA}
              onChange={(e) => setMinA(e.target.value)}
              placeholder="0.0"
              className="w-full rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-4 py-3 text-sm text-[#fbe5d5] shadow-inner shadow-black/30 focus:border-[#f6b394] focus:outline-none focus:ring-2 focus:ring-[#f6b394]/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#fbe5d5]">Minimum {tokenB?.symbol ?? 'Token B'} to Receive</label>
            <input
              type="number"
              value={minB}
              onChange={(e) => setMinB(e.target.value)}
              placeholder="0.0"
              className="w-full rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-4 py-3 text-sm text-[#fbe5d5] shadow-inner shadow-black/30 focus:border-[#f6b394] focus:outline-none focus:ring-2 focus:ring-[#f6b394]/30"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
          <h3 className="mb-2 text-sm font-medium text-[#fbe5d5]">Pool Information</h3>
          <div className="space-y-2 text-sm text-[#e6d4c7]">
            <div className="flex justify-between">
              <span>Pool ID:</span>
              <span className="font-mono truncate max-w-40" title={activePool?.poolId || 'Not set'}>{activePool?.poolId || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span>Fee Recipient:</span>
              <span className="font-mono truncate max-w-40">{activePool?.feeRecipient || account?.address || 'Not connected'}</span>
            </div>
            <div className="flex justify-between">
              <span>Protocol Reserves:</span>
              <span>
                {activePool?.protocolReserveA?.toFixed(4) ?? 0} {tokenA?.symbol ?? ''} / {activePool?.protocolReserveB?.toFixed(4) ?? 0} {tokenB?.symbol ?? ''}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleClaimFees}
          disabled={!account || isLoading || !activePool}
          className={`w-full rounded-xl py-3 font-medium text-white transition-all ${
            !account || isLoading || !activePool
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-linear-to-r from-[#f6b394] via-[#e77a55] to-[#8a2d1b] hover:shadow-lg hover:shadow-[#f6b394]/50'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Claiming...
            </span>
          ) : !account ? 'Connect Wallet' : 'Claim Protocol Fees'}
        </button>
      </div>
    </div>
  );
}
