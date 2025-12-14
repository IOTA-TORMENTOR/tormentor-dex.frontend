'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@iota/dapp-kit';
import Image from 'next/image';

export default function Navigation() {
  const pathname = usePathname();

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Swap', href: '/swap' },
    { name: 'Liquidity', href: '/liquidity' },
    { name: 'Create Pool', href: '/create-pool' },
    { name: 'Claim Fees', href: '/claim-fees' },
  ];

  return (
    <nav className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-[#2d1b14] shadow-[0_1px_0_rgba(255,255,255,0.05)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="relative h-9 w-9 overflow-hidden rounded-full border border-[#2d1b14] bg-[#0f0d0d] shadow-lg shadow-[#f6b394]/30">
              <Image
                src="/tormentor-icon.png"
                alt="Tormentor icon"
                fill
                className="object-cover"
                sizes="36px"
                priority
              />
            </div>
            <span className="text-lg font-bold text-[#f6b394] tracking-tight">Tormentor</span>
          </div>
          <div className="hidden md:flex items-center gap-4">
            {navLinks.map((link) => {
              const active = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                    active
                      ? 'bg-[#f6b394] text-black shadow-inner shadow-[#d1583e]/40'
                      : 'text-[#f6e7de]/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-[#f6e7de]/80 border border-white/10">
            IOTA Testnet
          </div>
          <ConnectButton
            size="md"
            className="rounded-full bg-linear-to-r from-[#f6b394] via-[#e77a55] to-[#8a2d1b] px-4 py-2 text-black font-semibold shadow-lg shadow-[#f6b394]/40 hover:shadow-[#f6b394]/60"
          />
        </div>
      </div>
    </nav>
  );
}
