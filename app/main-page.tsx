'use client';

import Navigation from './components/Navigation';
import SwapPage from './swap/page';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="py-8">
        <SwapPage />
      </main>
    </div>
  );
}