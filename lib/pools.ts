import type { IotaClient } from '@iota/iota-sdk/client';
import { listCoin } from './constant';
import { CoinModel, PoolModel } from './type';

const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_ID;

type AnyClient = Pick<IotaClient, 'getObject'> | null;

export interface PoolWithOnChain extends PoolModel {
  reserveA?: number;
  reserveB?: number;
  feeReserveA?: number;
  feeReserveB?: number;
  protocolReserveA?: number;
  protocolReserveB?: number;
  lpSupply?: number;
  feeRecipient?: string;
}

type PoolFields = {
  token0?: unknown;
  token1?: unknown;
  pool_id?: string;
};

type RegistryResponse = {
  data?: {
    content?: {
      fields?: {
        pools?: unknown[];
      };
    };
  };
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = typeof atob !== 'undefined' ? atob(b64) : '';
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}

function bytesToUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder().decode(bytes);
  } catch {
    return String.fromCharCode(...Array.from(bytes));
  }
}

function bytesFieldToString(field: unknown): string | null {
  if (!field) return null;
  if (typeof field === 'string') {
    if (field.startsWith('0x')) return bytesToUtf8(hexToBytes(field));
    return field;
  }
  if (Array.isArray(field) && field.every((item) => typeof item === 'number')) {
    return bytesToUtf8(Uint8Array.from(field));
  }
  if (typeof field === 'object' && field !== null && 'bytes' in field && typeof (field as any).bytes === 'string') {
    return bytesToUtf8(base64ToBytes((field as any).bytes as string));
  }
  return null;
}

function withMetadata(tokenId: string): CoinModel {
  const found = listCoin.find((c) => c.tokenId.toLowerCase() === tokenId.toLowerCase());
  if (found) return found;

  const symbol = tokenId.split('::').pop() ?? 'TOKEN';
  return {
    tokenId,
    symbol,
    icon: '/tormentor-icon.png',
    decimals: 6,
  };
}

function fallbackPools(): PoolModel[] {
  if (listCoin.length >= 2) {
    return [{ poolId: '0x0', tokenA: listCoin[0], tokenB: listCoin[1] }];
  }
  if (listCoin.length === 1) {
    return [{ poolId: '0x0', tokenA: listCoin[0], tokenB: listCoin[0] }];
  }
  return [];
}

function parsePool(entry: PoolFields): PoolModel | null {
  if (!entry) return null;
  const token0 = bytesFieldToString(entry.token0);
  const token1 = bytesFieldToString(entry.token1);
  const poolId = (entry.pool_id as string | undefined) ?? '';
  if (!token0 || !token1 || !poolId) return null;

  return {
    poolId,
    tokenA: withMetadata(token0),
    tokenB: withMetadata(token1),
  };
}

export async function getPools(client?: AnyClient, registryId: string | undefined = REGISTRY_ID): Promise<PoolModel[]> {
  if (!client || !registryId) return fallbackPools();

  try {
    const response = (await client.getObject({
      id: registryId,
      options: { showContent: true },
    })) as RegistryResponse;

    const poolsField = response?.data?.content?.fields?.pools;
    if (!Array.isArray(poolsField)) return fallbackPools();

    const parsed = poolsField
      .map((item) => {
        if (item && typeof item === 'object' && 'fields' in (item as any)) {
          return parsePool((item as any).fields as PoolFields);
        }
        return parsePool(item as PoolFields);
      })
      .filter(Boolean) as PoolModel[];

    return parsed.length ? parsed : fallbackPools();
  } catch (error) {
    console.error('Failed to fetch pools from registry, using fallback list', error);
    return fallbackPools();
  }
}

export function deriveTokensFromPools(pools: PoolModel[]): CoinModel[] {
  const seen = new Set<string>();
  const out: CoinModel[] = [];

  pools.forEach((pool) => {
    [pool.tokenA, pool.tokenB].forEach((coin) => {
      if (!seen.has(coin.tokenId)) {
        seen.add(coin.tokenId);
        out.push(coin);
      }
    });
  });

  return out.length ? out : listCoin;
}

function extractNumber(field: unknown): number {
  if (typeof field === 'number') return field;
  if (typeof field === 'string') return Number(field);
  if (field && typeof field === 'object') {
    if ('value' in (field as any) && typeof (field as any).value !== 'undefined') {
      return Number((field as any).value);
    }
    if ('fields' in (field as any) && typeof (field as any).fields?.value !== 'undefined') {
      return Number((field as any).fields?.value);
    }
  }
  return 0;
}

/**
 * Hydrate pools with on-chain reserves/fee data. Gracefully ignores failures.
 */
export async function hydratePoolsWithData(client: AnyClient, pools: PoolModel[]): Promise<PoolWithOnChain[]> {
  if (!client) return pools;

  const results: PoolWithOnChain[] = [];

  for (const pool of pools) {
    try {
      const resp = await client.getObject({
        id: pool.poolId,
        options: { showContent: true },
      });

      const fields = (resp as any)?.data?.content?.fields ?? (resp as any)?.content?.fields;
      if (!fields) {
        results.push(pool);
        continue;
      }

      const reserveA = extractNumber(fields.reserve_a);
      const reserveB = extractNumber(fields.reserve_b);
      const feeReserveA = extractNumber(fields.fee_reserve_a);
      const feeReserveB = extractNumber(fields.fee_reserve_b);
      const protocolReserveA = extractNumber(fields.protocol_reserve_a);
      const protocolReserveB = extractNumber(fields.protocol_reserve_b);
      const lpSupply = extractNumber(fields.lp_supply);
      const feeRecipient = typeof fields.fee_recipient === 'string' ? fields.fee_recipient : undefined;

      const scaleA = pool.tokenA.decimals > 0 ? 10 ** pool.tokenA.decimals : 1;
      const scaleB = pool.tokenB.decimals > 0 ? 10 ** pool.tokenB.decimals : 1;

      results.push({
        ...pool,
        reserveA: reserveA / scaleA,
        reserveB: reserveB / scaleB,
        feeReserveA: feeReserveA / scaleA,
        feeReserveB: feeReserveB / scaleB,
        protocolReserveA: protocolReserveA / scaleA,
        protocolReserveB: protocolReserveB / scaleB,
        lpSupply,
        feeRecipient,
      });
    } catch (error) {
      console.error(`Failed to fetch pool ${pool.poolId}, keeping metadata only`, error);
      results.push(pool);
    }
  }

  return results;
}
