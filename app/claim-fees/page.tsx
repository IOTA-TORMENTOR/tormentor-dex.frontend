'use client';

import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useIotaClient } from '@iota/dapp-kit';

export default function ClaimFeesPage() {
  const [minA, setMinA] = useState('');
  const [minB, setMinB] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const account = useCurrentAccount();
  const iotaClient = useIotaClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const handleClaimFees = async () => {
    if (!account) return;

    setIsLoading(true);

    try {
      // Dynamically import Transaction to use the same version as wallet-standard
      const { Transaction } = await import('@iota/iota-sdk/transactions');
      const transaction = new Transaction();

      // This would be replaced with actual contract call
      transaction.moveCall({
        target: `${process.env.NEXT_PUBLIC_PACKAGE_ID}::simple_amm::claim_protocol_fees`,
        typeArguments: ['iota', 'usdc'], // These would be dynamic based on pool
        arguments: [
          transaction.object('0x123'), // pool object ID - needs to be fetched
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

        <div className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
          <p className="text-sm font-semibold text-[#f6b394]">Available Fees</p>
          <div className="mt-3 space-y-3">
            <div className="flex justify-between rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-3 py-2 text-[#fbe5d5]">
              <span>Token A Fees:</span>
              <span className="font-semibold">0.000000 IOTA</span>
            </div>
            <div className="flex justify-between rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-3 py-2 text-[#fbe5d5]">
              <span>Token B Fees:</span>
              <span className="font-semibold">0.000000 USDC</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 shadow-inner shadow-black/20">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#fbe5d5]">Minimum Token A to Receive</label>
            <input
              type="number"
              value={minA}
              onChange={(e) => setMinA(e.target.value)}
              placeholder="0.0"
              className="w-full rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-4 py-3 text-sm text-[#fbe5d5] shadow-inner shadow-black/30 focus:border-[#f6b394] focus:outline-none focus:ring-2 focus:ring-[#f6b394]/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#fbe5d5]">Minimum Token B to Receive</label>
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
              <span className="font-mono">0x123...</span>
            </div>
            <div className="flex justify-between">
              <span>Fee Recipient:</span>
              <span className="font-mono truncate max-w-40">{account?.address || 'Not connected'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleClaimFees}
          disabled={!account || isLoading}
          className={`w-full rounded-xl py-3 font-medium text-white transition-all ${!account || isLoading
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
