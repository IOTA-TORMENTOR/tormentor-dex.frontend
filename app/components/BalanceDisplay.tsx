'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useIotaClient } from '@iota/dapp-kit';

interface BalanceDisplayProps {
  tokenSymbol: string;
  tokenType?: string; // The type of token (e.g., 0x2::iota::IOTA)
  decimals?: number;
}

const BalanceDisplay = ({ tokenSymbol, tokenType = '0x2::iota::IOTA', decimals = 9 }: BalanceDisplayProps) => {
  const account = useCurrentAccount();
  const iotaClient = useIotaClient();
  const [balance, setBalance] = useState<string>('0.00');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account) return;

    const fetchBalance = async () => {
      try {
        // This would fetch the actual balance from the IOTA blockchain
        // For now, returning a mock value
        const mockBalance = '1000.00';
        setBalance(mockBalance);
      } catch (error) {
        console.error('Error fetching balance:', error);
        setBalance('0.00');
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [account, tokenType]);

  return (
    <div className="text-sm text-gray-500">
      {loading ? 'Loading...' : `Balance: ${balance} ${tokenSymbol}`}
    </div>
  );
};

export default BalanceDisplay;