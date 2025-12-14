module tormentor_dex::simple_amm_sandbox_fee;

use iota::balance::{Balance, zero, join, value as balance_value, split as balance_split};
use iota::coin::{Coin, into_balance, from_balance, value as coin_value, split as coin_split};
use iota::tx_context::sender;

// use std::vector;

/// =======================
/// Errors
/// =======================
const E_INVALID_AMOUNT: u64 = 1;
const E_ZERO_RESERVE: u64 = 2;
const E_INSUFFICIENT_OUTPUT: u64 = 3;
const E_INSUFFICIENT_LIQUIDITY: u64 = 4;
const E_INSUFFICIENT_SHARES: u64 = 5;
const E_POOL_NOT_FOUND: u64 = 6;
const E_POOL_ALREADY_EXISTS: u64 = 7;
const E_NOT_FEE_RECIPIENT: u64 = 8;

/// =======================
/// Fee config (BPS)
/// =======================
const BPS_DENOM: u64 = 10_000;
const SWAP_FEE_BPS: u64 = 30; // 0.30% total fee
const PROTOCOL_FEE_SHARE_BPS: u64 = 2000; // 20% of fee => protocol, 80% => LP

/// =======================
/// Registry (SANDBOX)
/// =======================
/// Karena IOTA Move tidak punya TypeTag reflection, kita simpan token sebagai bytes (string)
/// Ini SANDBOX untuk FE dropdown, bukan production.
public struct PoolInfo has copy, drop, store {
    token0: vector<u8>,
    token1: vector<u8>,
    pool_id: ID,
}

public struct PoolRegistry has key {
    id: UID,
    pools: vector<PoolInfo>,
}

/// Create registry (owned object). Simpan object_id nya di FE.
public entry fun create_registry(ctx: &mut TxContext) {
    let reg = PoolRegistry {
        id: object::new(ctx),
        pools: vector::empty(),
    };
    transfer::transfer(reg, sender(ctx));
}

/// ENTRY: return by value (boleh), bukan reference
public entry fun get_pools(registry: &PoolRegistry): vector<PoolInfo> {
    registry.pools
}

/// Helper: vector contains bytes string (sandbox O(n²))
fun bytes_eq(a: &vector<u8>, b: &vector<u8>): bool {
    if (vector::length(a) != vector::length(b)) return false;
    let n = vector::length(a);
    let mut i = 0;
    while (i < n) {
        if (*vector::borrow(a, i) != *vector::borrow(b, i)) return false;
        i = i + 1;
    };
    true
}

fun token_list_contains(v: &vector<vector<u8>>, t: &vector<u8>): bool {
    let n = vector::length(v);
    let mut i = 0;
    while (i < n) {
        let cur = vector::borrow(v, i);
        if (bytes_eq(cur, t)) return true;
        i = i + 1;
    };
    false
}

/// ENTRY: FE ambil list token unik dari registry (sandbox)
public entry fun get_tokens(registry: &PoolRegistry): vector<vector<u8>> {
    let mut out = vector::empty<vector<u8>>();
    let n = vector::length(&registry.pools);
    let mut i = 0;

    while (i < n) {
        let info = vector::borrow(&registry.pools, i);

        if (!token_list_contains(&out, &info.token0)) {
            vector::push_back(&mut out, info.token0);
        };

        if (!token_list_contains(&out, &info.token1)) {
            vector::push_back(&mut out, info.token1);
        };

        i = i + 1;
    };

    out
}

/// Guard: pool object yang dipakai harus sudah terdaftar di registry
fun assert_pool_exists(registry: &PoolRegistry, pool_id: &ID) {
    let n = vector::length(&registry.pools);
    let mut i = 0;
    while (i < n) {
        let p = vector::borrow(&registry.pools, i);
        if (&p.pool_id == pool_id) return;
        i = i + 1;
    };
    abort E_POOL_NOT_FOUND;
}

/// Cegah duplicate pool pair (sandbox, order-agnostic)
fun pool_pair_exists(registry: &PoolRegistry, t0: &vector<u8>, t1: &vector<u8>): bool {
    let n = vector::length(&registry.pools);
    let mut i = 0;
    while (i < n) {
        let p = vector::borrow(&registry.pools, i);
        let ab = bytes_eq(&p.token0, t0) && bytes_eq(&p.token1, t1);
        let ba = bytes_eq(&p.token0, t1) && bytes_eq(&p.token1, t0);
        if (ab || ba) return true;
        i = i + 1;
    };
    false
}

/// =======================
/// AMM STRUCTS (WITH FEES)
/// =======================
public struct Pool<phantom A, phantom B> has key {
    id: UID,
    reserve_a: Balance<A>,
    reserve_b: Balance<B>,
    /// LP fee reserve: dibagi pro-rata ke LP saat remove liquidity
    fee_reserve_a: Balance<A>,
    fee_reserve_b: Balance<B>,
    /// Protocol fee reserve: hanya bisa di-claim fee_recipient
    protocol_reserve_a: Balance<A>,
    protocol_reserve_b: Balance<B>,
    lp_supply: u64,
    fee_recipient: address,
}

public struct Position<phantom A, phantom B> has key {
    id: UID,
    shares: u64,
}

/// =======================
/// Helpers
/// =======================
fun sqrt_u128(x: u128): u128 {
    if (x == 0) return 0;
    let mut z = x;
    let mut y = x;
    loop {
        y = (y + x / y) / 2;
        if (y >= z) break;
        z = y;
    };
    z
}

/// Fee split:
/// total_fee = amount_in * SWAP_FEE_BPS / 10_000
/// protocol_fee = total_fee * PROTOCOL_FEE_SHARE_BPS / 10_000
/// lp_fee = total_fee - protocol_fee
/// net_in = amount_in - total_fee
fun compute_fee_split(amount_in: u64): (u64, u64, u64) {
    let total_fee = (((amount_in as u128) * (SWAP_FEE_BPS as u128)) / (BPS_DENOM as u128)) as u64;

    let protocol_fee =
        (((total_fee as u128) * (PROTOCOL_FEE_SHARE_BPS as u128)) / (BPS_DENOM as u128)) as u64;

    let lp_fee = total_fee - protocol_fee;
    let net_in = amount_in - total_fee;

    (net_in, lp_fee, protocol_fee)
}

/// =======================
/// Create Pool (register token names + pool object)
/// =======================
public entry fun create_pool<A, B>(
    registry: &mut PoolRegistry,
    token0: vector<u8>,
    token1: vector<u8>,
    ctx: &mut TxContext,
) {
    // sandbox: cegah duplicate pair
    let exists = pool_pair_exists(registry, &token0, &token1);
    assert!(!exists, E_POOL_ALREADY_EXISTS);

    let owner = sender(ctx);

    let pool = Pool<A, B> {
        id: object::new(ctx),
        reserve_a: zero(),
        reserve_b: zero(),
        fee_reserve_a: zero(),
        fee_reserve_b: zero(),
        protocol_reserve_a: zero(),
        protocol_reserve_b: zero(),
        lp_supply: 0,
        fee_recipient: owner,
    };

    let pid = object::id(&pool);

    vector::push_back(
        &mut registry.pools,
        PoolInfo { token0, token1, pool_id: pid },
    );

    transfer::transfer(pool, owner);
}

/// =======================
/// Add Liquidity (mint shares + return Position)
/// =======================
public entry fun add_liquidity<A, B>(
    registry: &PoolRegistry,
    pool: &mut Pool<A, B>,
    mut coin_a: Coin<A>,
    amount_a: u64,
    mut coin_b: Coin<B>,
    amount_b: u64,
    ctx: &mut TxContext,
) {
    assert_pool_exists(registry, &object::id(pool));

    let s = sender(ctx);

    let total_a = coin_value(&coin_a);
    let total_b = coin_value(&coin_b);

    assert!(amount_a > 0 && amount_a <= total_a, E_INVALID_AMOUNT);
    assert!(amount_b > 0 && amount_b <= total_b, E_INVALID_AMOUNT);

    let ra = balance_value(&pool.reserve_a);
    let rb = balance_value(&pool.reserve_b);

    // split exact used amounts
    let used_a = coin_split(&mut coin_a, amount_a, ctx);
    let used_b = coin_split(&mut coin_b, amount_b, ctx);

    join(&mut pool.reserve_a, into_balance(used_a));
    join(&mut pool.reserve_b, into_balance(used_b));

    // mint shares (Uniswap V2 style)
    let minted: u64 = if (pool.lp_supply == 0) {
        let root = sqrt_u128((amount_a as u128) * (amount_b as u128)) as u64;
        assert!(root > 0, E_INSUFFICIENT_LIQUIDITY);
        root
    } else {
        // minted = min(amount_a * supply / ra, amount_b * supply / rb)
        let mint_a = (((amount_a as u128) * (pool.lp_supply as u128)) / (ra as u128)) as u64;
        let mint_b = (((amount_b as u128) * (pool.lp_supply as u128)) / (rb as u128)) as u64;

        let m = if (mint_a < mint_b) mint_a else mint_b;
        assert!(m > 0, E_INSUFFICIENT_LIQUIDITY);
        m
    };

    pool.lp_supply = pool.lp_supply + minted;

    let pos = Position<A, B> { id: object::new(ctx), shares: minted };
    transfer::transfer(pos, s);

    // return unused coins
    transfer::public_transfer(coin_a, s);
    transfer::public_transfer(coin_b, s);
}

/// =======================
/// Remove Liquidity (reserve + LP fee rewards, protocol fee excluded)
/// =======================
public entry fun remove_liquidity_partial<A, B>(
    registry: &PoolRegistry,
    pool: &mut Pool<A, B>,
    position: &mut Position<A, B>,
    shares_to_burn: u64,
    min_a: u64,
    min_b: u64,
    ctx: &mut TxContext,
) {
    assert_pool_exists(registry, &object::id(pool));

    let s = sender(ctx);

    assert!(shares_to_burn > 0 && shares_to_burn <= position.shares, E_INSUFFICIENT_SHARES);
    assert!(pool.lp_supply > 0, E_INSUFFICIENT_LIQUIDITY);

    let ra = balance_value(&pool.reserve_a);
    let rb = balance_value(&pool.reserve_b);

    let fa = balance_value(&pool.fee_reserve_a);
    let fb = balance_value(&pool.fee_reserve_b);

    // LP share: reserve + fee_reserve (protocol reserve not shared)
    let total_a = ra + fa;
    let total_b = rb + fb;

    assert!(total_a > 0 && total_b > 0, E_ZERO_RESERVE);

    let amount_a =
        (((shares_to_burn as u128) * (total_a as u128)) / (pool.lp_supply as u128)) as u64;
    let amount_b =
        (((shares_to_burn as u128) * (total_b as u128)) / (pool.lp_supply as u128)) as u64;

    assert!(amount_a >= min_a && amount_b >= min_b, E_INSUFFICIENT_OUTPUT);

    // update shares
    position.shares = position.shares - shares_to_burn;
    pool.lp_supply = pool.lp_supply - shares_to_burn;

    // split between reserve vs fee_reserve proportionally (safe u128)
    let reserve_part_a = (((amount_a as u128) * (ra as u128)) / (total_a as u128)) as u64;
    let fee_part_a = amount_a - reserve_part_a;

    let reserve_part_b = (((amount_b as u128) * (rb as u128)) / (total_b as u128)) as u64;
    let fee_part_b = amount_b - reserve_part_b;

    let mut out_a = balance_split(&mut pool.reserve_a, reserve_part_a);
    let fee_a = balance_split(&mut pool.fee_reserve_a, fee_part_a);
    join(&mut out_a, fee_a);

    let mut out_b = balance_split(&mut pool.reserve_b, reserve_part_b);
    let fee_b = balance_split(&mut pool.fee_reserve_b, fee_part_b);
    join(&mut out_b, fee_b);

    transfer::public_transfer(from_balance(out_a, ctx), s);
    transfer::public_transfer(from_balance(out_b, ctx), s);
}

/// =======================
/// Swap A -> B (fee split: LP + protocol)
/// =======================
public entry fun swap_a_to_b<A, B>(
    registry: &PoolRegistry,
    pool: &mut Pool<A, B>,
    mut coin_in: Coin<A>,
    min_out: u64,
    ctx: &mut TxContext,
) {
    assert_pool_exists(registry, &object::id(pool));

    let s = sender(ctx);

    let amount_in = coin_value(&coin_in);
    assert!(amount_in > 0, E_INVALID_AMOUNT);

    let ra = balance_value(&pool.reserve_a);
    let rb = balance_value(&pool.reserve_b);
    assert!(ra > 0 && rb > 0, E_ZERO_RESERVE);

    let (net_in, lp_fee, protocol_fee) = compute_fee_split(amount_in);
    assert!(net_in > 0, E_INVALID_AMOUNT);

    // take protocol fee
    if (protocol_fee > 0) {
        let p = coin_split(&mut coin_in, protocol_fee, ctx);
        join(&mut pool.protocol_reserve_a, into_balance(p));
    };

    // take LP fee
    if (lp_fee > 0) {
        let l = coin_split(&mut coin_in, lp_fee, ctx);
        join(&mut pool.fee_reserve_a, into_balance(l));
    };

    // net goes to reserve
    let net_coin = coin_split(&mut coin_in, net_in, ctx);
    join(&mut pool.reserve_a, into_balance(net_coin));

    // pricing uses net_in
    let out = (((rb as u128) * (net_in as u128)) / ((ra as u128) + (net_in as u128))) as u64;

    assert!(out >= min_out, E_INSUFFICIENT_OUTPUT);
    assert!(out < rb, E_INSUFFICIENT_LIQUIDITY);

    let out_balance = balance_split(&mut pool.reserve_b, out);
    transfer::public_transfer(from_balance(out_balance, ctx), s);

    // any leftover coin_in should be 0; but still return safely
    transfer::public_transfer(coin_in, s);
}

/// =======================
/// Swap B -> A (fee split: LP + protocol)
/// =======================
public entry fun swap_b_to_a<A, B>(
    registry: &PoolRegistry,
    pool: &mut Pool<A, B>,
    mut coin_in: Coin<B>,
    min_out: u64,
    ctx: &mut TxContext,
) {
    assert_pool_exists(registry, &object::id(pool));

    let s = sender(ctx);

    let amount_in = coin_value(&coin_in);
    assert!(amount_in > 0, E_INVALID_AMOUNT);

    let ra = balance_value(&pool.reserve_a);
    let rb = balance_value(&pool.reserve_b);
    assert!(ra > 0 && rb > 0, E_ZERO_RESERVE);

    let (net_in, lp_fee, protocol_fee) = compute_fee_split(amount_in);
    assert!(net_in > 0, E_INVALID_AMOUNT);

    if (protocol_fee > 0) {
        let p = coin_split(&mut coin_in, protocol_fee, ctx);
        join(&mut pool.protocol_reserve_b, into_balance(p));
    };

    if (lp_fee > 0) {
        let l = coin_split(&mut coin_in, lp_fee, ctx);
        join(&mut pool.fee_reserve_b, into_balance(l));
    };

    let net_coin = coin_split(&mut coin_in, net_in, ctx);
    join(&mut pool.reserve_b, into_balance(net_coin));

    let out = (((ra as u128) * (net_in as u128)) / ((rb as u128) + (net_in as u128))) as u64;

    assert!(out >= min_out, E_INSUFFICIENT_OUTPUT);
    assert!(out < ra, E_INSUFFICIENT_LIQUIDITY);

    let out_balance = balance_split(&mut pool.reserve_a, out);
    transfer::public_transfer(from_balance(out_balance, ctx), s);

    transfer::public_transfer(coin_in, s);
}

/// =======================
/// Claim protocol fees (only fee_recipient)
/// =======================
public entry fun claim_protocol_fees<A, B>(
    registry: &PoolRegistry,
    pool: &mut Pool<A, B>,
    min_a: u64,
    min_b: u64,
    ctx: &mut TxContext,
) {
    assert_pool_exists(registry, &object::id(pool));

    let s = sender(ctx);
    assert!(s == pool.fee_recipient, E_NOT_FEE_RECIPIENT);

    let pa = balance_value(&pool.protocol_reserve_a);
    let pb = balance_value(&pool.protocol_reserve_b);

    assert!(pa >= min_a && pb >= min_b, E_INSUFFICIENT_OUTPUT);

    let out_a = balance_split(&mut pool.protocol_reserve_a, pa);
    let out_b = balance_split(&mut pool.protocol_reserve_b, pb);

    transfer::public_transfer(from_balance(out_a, ctx), s);
    transfer::public_transfer(from_balance(out_b, ctx), s);
}
