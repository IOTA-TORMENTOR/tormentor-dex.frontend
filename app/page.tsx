import Link from 'next/link';

export default function Home() {
  const stats = [
    { label: 'TVL', value: '$0.00' },
    { label: '24h Volume', value: '$0.00' },
    { label: 'Supported Tokens', value: '2+' },
  ];

  const features = [
    {
      title: 'Swap Instantly',
      desc: 'Low-friction token swaps with protocol fee sharing and clean UX.',
      cta: 'Start Swapping',
      href: '/swap',
    },
    {
      title: 'Provide Liquidity',
      desc: 'Deposit pairs to earn LP fees. Manage positions with clear controls.',
      cta: 'Manage Liquidity',
      href: '/liquidity',
    },
    {
      title: 'Create New Pools',
      desc: 'Seed new markets with your own pairs and set initial pricing.',
      cta: 'Create Pool',
      href: '/create-pool',
    },
    {
      title: 'Claim Protocol Fees',
      desc: 'Fee recipients can withdraw protocol share with safeguards.',
      cta: 'Claim Fees',
      href: '/claim-fees',
    },
  ];

  return (
    <div className="container px-4 md:px-6 mx-auto relative">
      <div className="relative isolate overflow-hidden rounded-3xl border border-[#2d1b14] bg-linear-to-b from-[#130f0f] via-[#0b0a0a] to-[#0b0a0a] p-6 shadow-[0_10px_60px_rgba(0,0,0,0.4)]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-20 h-80 w-80 rounded-full bg-linear-to-br from-[#f6b394]/25 to-[#d1583e]/20 blur-3xl" />
          <div className="absolute top-16 -right-24 h-96 w-96 rounded-full bg-linear-to-br from-[#f6b394]/20 via-[#e77a55]/20 to-[#8a2d1b]/20 blur-3xl" />
        </div>

        <div className="grid gap-10 lg:grid-cols-1">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#f6b394]">Tormentor DEX</p>
              <h1 className="text-4xl font-bold text-[#fbe5d5] sm:text-5xl">
                High-Efficiency AMM built for IOTA with clarity and control.
              </h1>
              <p className="text-lg text-[#e6d4c7]">
                Swap, provide liquidity, create pools, and claim protocol fees in a unified, dark-styled interface inspired by premier DEX UX.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/swap"
                className="inline-flex items-center rounded-full bg-linear-to-r from-[#f6b394] via-[#e77a55] to-[#8a2d1b] px-6 py-3 text-black font-semibold shadow-lg shadow-[#f6b394]/40 transition hover:shadow-[#f6b394]/60"
              >
                Launch Swap
              </Link>
              <Link
                href="/liquidity"
                className="inline-flex items-center rounded-full border border-[#f6b394]/50 bg-transparent px-6 py-3 text-[#f6b394] font-semibold shadow-sm transition hover:border-[#f6b394] hover:bg-[#f6b394]/10"
              >
                Provide Liquidity
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {stats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-[#2d1b14] bg-[#1a1412]/90 px-4 py-3 shadow-lg shadow-black/40"
                >
                  <p className="text-xs uppercase tracking-wide text-[#f6b394]/80">{item.label}</p>
                  <p className="text-lg font-semibold text-[#fbe5d5]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-[#2d1b14] bg-[#14100f]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur">
              <h3 className="text-xl font-semibold text-[#fbe5d5]">One interface for every action</h3>
              <p className="mt-2 text-[#e6d4c7]">
                All menus share the same app bar and layout. Move between swap, liquidity, pool creation, and fee claiming without UI surprises.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {features.map((feature) => (
                  <Link
                    key={feature.title}
                    href={feature.href}
                    className="group flex h-full flex-col justify-between rounded-2xl border border-[#2d1b14] bg-[#1a1412]/80 p-4 transition hover:border-[#f6b394]/50 hover:bg-[#241a17]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#f6b394]">{feature.title}</p>
                      <p className="mt-1 text-sm text-[#e6d4c7]">{feature.desc}</p>
                    </div>
                    <span className="mt-3 inline-flex items-center text-sm font-medium text-[#f6b394] group-hover:underline">
                      {feature.cta} →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  );
}
