'use client';

import { useState, useEffect, Dispatch, SetStateAction } from 'react';

interface Token {
  id: string;
  name?: string;
  symbol: string;
  decimals?: number;
  icon?: string;
  packageId?: string;
  treasuryId?: string;
}

interface TokenSelectorProps {
  tokens: Token[];
  selectedToken: Token;
  onSelectToken: Dispatch<SetStateAction<Token>>;
  title?: string;
  balance?: string;
}

const TokenSelector = ({ tokens, selectedToken, onSelectToken, title = "Select Token", balance }: TokenSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleTokenSelect = (token: Token) => {
    onSelectToken(token);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border border-[#2d1b14] bg-[#0f0d0d] px-3 py-2 text-lg font-medium text-[#fbe5d5] shadow-inner shadow-black/30 focus:outline-none focus:ring-2 focus:ring-[#f6b394]/30"
      >
        <div>
          <span>{selectedToken.symbol}</span>
          {balance && <span className="ml-2 text-xs text-[#e6d4c7]">Balance: {balance}</span>}
        </div>
        <svg 
          className={`h-5 w-5 text-[#f6b394] transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-[#2d1b14] bg-[#1a1412] shadow-lg shadow-black/40">
          <div className="p-2">
            <div className="px-2 py-1 text-xs font-medium uppercase tracking-wider text-[#f6b394]/80">
              {title}
            </div>
            {tokens.map((token) => (
              <button
                key={token.id}
                onClick={() => handleTokenSelect(token)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-[#fbe5d5] transition ${
                  selectedToken.id === token.id
                    ? 'bg-[#f6b394]/15 text-[#f6b394]'
                    : 'hover:bg-[#2d1b14]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {token.icon && (
                    <img
                      src={token.icon}
                      alt={token.symbol}
                      className="h-6 w-6 rounded-full border border-[#2d1b14] object-contain"
                    />
                  )}
                  <span className="font-medium">{token.symbol}</span>
                </div>
                <span className="text-sm text-[#e6d4c7]">{token.name ?? token.symbol}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenSelector;
