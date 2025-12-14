export interface CoinModel {
  tokenId: string; // 0xea7d...::coin::TYPE
  symbol: string;
  icon: string;
  decimals: number;
}

export interface PoolModel {
  poolId: string;
  tokenA: CoinModel;
  tokenB: CoinModel;
}
