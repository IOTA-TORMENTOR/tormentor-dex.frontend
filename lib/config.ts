import { createNetworkConfig } from '@iota/dapp-kit';
import { getFullnodeUrl } from '@iota/iota-sdk/client';

// Use env override if provided; fallback to placeholder so builds succeed offline.
const NEXT_PUBLIC_PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? '0x0';

const { networkConfig } = createNetworkConfig({
  testnet: {
    url: getFullnodeUrl('testnet'),
    variables: {
      packageId: NEXT_PUBLIC_PACKAGE_ID,
    },
  },
  devnet: {
    url: getFullnodeUrl('devnet'),
    variables: {
      packageId: NEXT_PUBLIC_PACKAGE_ID,
    },
  },
});

export { networkConfig };
