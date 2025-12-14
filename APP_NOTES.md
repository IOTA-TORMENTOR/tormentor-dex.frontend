# Catatan Proyek

- **Gambaran umum**: Aplikasi Tormentor DEX berbasis Next.js (app router) dengan Tailwind CSS 4. Menggunakan `@iota/dapp-kit` untuk koneksi dompet, `@iota/iota-sdk/transactions` untuk membangun transaksi Move, dan dibungkus `WalletProvider` di `app/layout.tsx`. Dependensi inti: Next 16, React 19, TypeScript strict-ish, tailwind via PostCSS plugin.

- **Struktur UI**:
  - `app/page.tsx` merender `SwapPage` sebagai landing, disertai `Navigation` + `ConnectButton`.
  - `app/swap/page.tsx`: form swap sederhana dengan daftar token mock (IOTA, USDC, WETH). Hitung slippage -> `minOut`, lalu `Transaction().moveCall` ke `${NEXT_PUBLIC_PACKAGE_ID}::simple_amm::swap_a_to_b` dengan pool object placeholder `0x123`. Estimasi output hanya mock (rate 0.95) dan belum membaca reserve on-chain.
  - `app/liquidity/page.tsx`: tab Add/Remove. Add memanggil `simple_amm::add_liquidity_partial`, Remove memanggil `simple_amm::remove_liquidity_partial`; keduanya memakai pool/position ID placeholder (`0x123`, `0x456`) dan angka min output dummy. Perhitungan posisi/rate masih hardcoded.
  - `app/create-pool/page.tsx`: pilih token A/B + amount awal lalu `moveCall` `simple_amm::create_pool` (argumen amount belum digunakan). Token list masih mock.
  - `app/claim-fees/page.tsx`: klaim fee protokol via `simple_amm::claim_protocol_fees` dengan type args `iota`, `usdc` dan pool ID placeholder. Tampilkan balance fee statik; import `Transaction` secara dinamis agar versi selaras dengan wallet.
  - Komponen umum: `Navigation` (tabs swap/liquidity/create/claim + tombol connect), `TokenSelector`, `TokenInput`, `BalanceDisplay` (balance masih mock).

- **Kontrak Move (`contract/`)**:
  - `tormentor_dex.move` (`simple_amm`): AMM xy=k dengan fee split. Struct `Pool` menyimpan reserve, akumulasi fee LP (`fee_reserve_*`), fee protokol (`protocol_reserve_*`), total LP supply, dan `fee_recipient`. `Position` menyimpan jumlah `shares`.
  - Fee: `SWAP_FEE_BPS = 30` (0.30%), `PROTOCOL_FEE_SHARE_BPS = 2000` (20% dari fee ke protokol, 80% ke LP). Bagi fee di `compute_fee_split`.
  - Fungsi utama:
    - `create_pool<A,B>`: buat pool kosong, fee recipient = publisher.
    - `add_liquidity_partial`: ambil sebagian coin A/B, mint shares (`sqrt(amountA*amountB)` saat pool awal, lalu proporsional), kembalikan sisa coin.
    - `remove_liquidity_partial`: burn shares, kirim kembali porsi reserve + fee LP sesuai pro-rata; protocol fee tidak dibagi ke LP.
    - `swap_a_to_b` / `swap_b_to_a`: constant-product pricing `(rY * netIn) / (rX + netIn)`, split fee ke LP/protokol (disimpan di reserve khusus), cek `min_out`, kembalikan sisa coin_in jika ada.
    - `claim_protocol_fees`: hanya `fee_recipient`, tarik seluruh protocol_reserve dengan batas minimal.
  - Token mock: `coin_idr.move` (`MOCK_IDR`) & `coin_usdc.move` (`MOCK_USDC`) mencetak koin via TreasuryCap pada init; metadata dibekukan. `token_wrapper.move` menyediakan entry `mint_idr_only`, `mint_usdc_only`, `mint_both` untuk minting ke penerima tertentu.

- **Konfigurasi & variabel**: panggilan Move memakai `${process.env.NEXT_PUBLIC_PACKAGE_ID}` sebagai package ID; pool/position object ID masih hardcoded dan perlu di-fetch dari chain atau backend. Belum ada hookup ke data on-chain (reserve, saldo, posisi). Tailwind sudah diaktifkan lewat `app/globals.css` (@import `tailwindcss`).

- **Pekerjaan lanjutan yang jelas**: sambungkan daftar token ke on-chain metadata, ambil pool/position IDs dan reserve sebelum memanggil transaksi, tangani decimals secara benar, tampilkan saldo & fee nyata, dan tambahkan validasi/error handling yang tidak hanya `alert`.
