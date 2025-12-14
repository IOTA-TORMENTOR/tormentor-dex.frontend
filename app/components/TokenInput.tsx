'use client';

import { useState } from 'react';

interface TokenInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxValue?: string;
  onMaxClick?: () => void;
  tokenSymbol?: string;
  title?: string;
  balance?: string;
}

const TokenInput = ({ 
  value, 
  onChange, 
  placeholder = "0.0", 
  maxValue, 
  onMaxClick,
  tokenSymbol,
  title,
  balance
}: TokenInputProps) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Only allow numbers and decimal points
    if (newValue === '' || /^\d*\.?\d*$/.test(newValue)) {
      onChange(newValue);
    }
  };

  return (
    <div className="w-full">
      {title && (
        <div className="flex justify-between mb-2">
          <span className="text-sm text-[#fbe5d5]">{title}</span>
          {balance && <span className="text-sm text-[#e6d4c7]">Balance: {balance}</span>}
        </div>
      )}
      <div
        className={`flex items-center space-x-2 rounded-xl border p-3 shadow-inner shadow-black/20 focus-within:ring-2 focus-within:ring-[#f6b394]/30 ${
          isFocused ? 'border-[#f6b394]' : 'border-[#2d1b14] bg-[#1a1412]'
        }`}
      >
        <input
          type="text"
          value={value}
          onChange={handleValueChange}
          placeholder={placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full bg-transparent text-2xl text-[#fbe5d5] placeholder:text-[#7a6a63] focus:outline-none"
        />
        {onMaxClick && maxValue && (
          <button
            onClick={onMaxClick}
            className="text-xs rounded-md bg-[#f6b394]/20 px-2 py-1 font-medium text-[#f6b394] transition hover:bg-[#f6b394]/30"
          >
            MAX
          </button>
        )}
        {tokenSymbol && (
          <div className="rounded-lg bg-[#0f0d0d] px-3 py-1 text-lg font-medium text-[#fbe5d5] border border-[#2d1b14]">
            {tokenSymbol}
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenInput;
