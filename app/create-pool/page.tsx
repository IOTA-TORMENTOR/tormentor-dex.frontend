'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrentAccount, useIotaClient, useSignAndExecuteTransaction } from '@iota/dapp-kit';
import { Transaction } from '@iota/iota-sdk/transactions';
import TokenSelector from '../components/TokenSelector';
import { listCoin } from '@/lib/constant';
import { deriveTokensFromPools, getPools, hydratePoolsWithData } from '@/lib/pools';

type TokenOption = {
  id: string;
  symbol: string;
  name?: string;
  decimals?: number;
  icon?: string;
};

const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_ID ?? '';
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? '0x0';

function toBytesVector(str: string): number[] {
  return Array.from(new TextEncoder().encode(str));
}

export default function CreatePoolPage() {
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
  const [isLoading, setIsLoading] = useState(false);

  const account = useCurrentAccount();
  const iotaClient = useIotaClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const hasSameToken = useMemo(() => tokenA.id === tokenB.id, [tokenA.id, tokenB.id]);

  // Load pools/token list (fallback to static)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const poolMeta = await getPools(iotaClient, REGISTRY_ID);
        const hydrated = await hydratePoolsWithData(iotaClient, poolMeta);
        if (!mounted) return;
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
        console.error('Failed to load token list, using fallback', err);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [iotaClient]);

  useEffect(() => {
    if (!tokens.length) return;
    setTokenA((prev) => tokens.find((t) => t.id === prev?.id) ?? tokens[0]);
    setTokenB((prev) => tokens.find((t) => t.id === prev?.id) ?? tokens[1] ?? tokens[0]);
  }, [tokens]);

  const handleCreatePool = async () => {
    if (!account || !tokenA || !tokenB) return;
    if (hasSameToken) {
      alert('Token A dan B harus berbeda');
      return;
    }
    if (!REGISTRY_ID) {
      alert('Set NEXT_PUBLIC_REGISTRY_ID in env');
      return;
    }

    setIsLoading(true);

    try {
      const transaction = new Transaction();

      transaction.moveCall({
        target: `${PACKAGE_ID}::simple_amm_sandbox_fee::create_pool`,
        typeArguments: [tokenA.id, tokenB.id],
        arguments: [
          transaction.object(REGISTRY_ID),
          transaction.pure.vector('u8', toBytesVector(tokenA.id)),
          transaction.pure.vector('u8', toBytesVector(tokenB.id)),
        ],
      });

      signAndExecuteTransaction(
        {
          transaction,
          account,
        },
        {
          onSuccess: (result) => {
            console.log('Pool creation successful:', result);
            alert('Pool created successfully! Tambahkan likuiditas di menu Liquidity.');
          },
          onError: (error) => {
            console.error('Pool creation failed:', error);
            alert('Pool creation failed: ' + error.message);
          },
          onSettled: () => {
            setIsLoading(false);
          },
        }
      );
    } catch (error) {
      console.error('Error during pool creation:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      alert('Error during pool creation: ' + errorMessage);
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
                <p className="text-sm font-semibold uppercase tracking-wide text-[#f6b394]">Create Pool</p>
                <h2 className="text-3xl font-bold text-[#fbe5d5]">Seed a New Pair</h2>
                <p className="mt-2 text-[#e6d4c7]">
                  Daftarkan pasangan token ke registry. Setoran awal dilakukan lewat halaman Liquidity.
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
                { label: 'Deposit', value: 'Not required here' },
                { label: 'Network', value: 'IOTA Testnet' },
                { label: 'Outcome', value: 'Pool + LP supply = 0' },
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
                <h3 className="text-xl font-semibold text-[#fbe5d5]">Select Pair Only</h3>
                <p className="text-sm text-[#e6d4c7]">Tidak ada form amount di tahap ini.</p>
              </div>
              <div className="rounded-full border border-[#f6b394]/40 bg-[#f6b394]/15 px-3 py-1 text-xs font-semibold text-[#f6b394]">
                Step
              </div>
            </div>

            <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
              <TokenSelector
                tokens={tokens.filter((token) => token.symbol !== tokenB.symbol)}
                selectedToken={tokenA}
                onSelectToken={setTokenA}
                title="Select Token A"
              />
            </div>

            <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
              <TokenSelector
                tokens={tokens.filter((token) => token.symbol !== tokenA.symbol)}
                selectedToken={tokenB}
                onSelectToken={setTokenB}
                title="Select Token B"
              />
            </div>

            <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
              <h3 className="mb-2 text-sm font-medium text-[#fbe5d5]">Pool Information</h3>
              <div className="space-y-2 text-sm text-[#e6d4c7]">
                <div className="flex justify-between">
                  <span>Pool Fee</span>
                  <span>0.30%</span>
                </div>
                <div className="flex justify-between">
                  <span>Protocol Fee</span>
                  <span>20% of swap fee</span>
                </div>
                <p className="text-xs text-[#e6d4c7]">Setoran awal dilakukan setelah pool terbentuk di halaman Liquidity.</p>
                {hasSameToken && <p className="text-xs text-red-300">Token A dan B harus berbeda.</p>}
              </div>
            </div>

            <button
              onClick={handleCreatePool}
              disabled={!account || isLoading || hasSameToken}
              className={`w-full rounded-xl py-3 font-medium text-white transition-all ${
                !account || isLoading || hasSameToken
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
                  Creating Pool...
                </span>
              ) : !account ? 'Connect Wallet' : 'Create Pool'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
