🛡️ Laporan Audit Teknis: Erp-Manufactured

Tanggal: 29 Desember 2025

Auditor: Senior Code Partner

Status Project: MVP (Strong Foundation, but Scalability Risks Detected)

📋 Ringkasan Eksekutif

Project ini memiliki struktur database yang sangat solid dengan penegakan Business Invariants yang ketat (Stok Negatif, Period Lock, Journal Balance). Namun, terdapat risiko skalabilitas (performansi trigger) dan pemeliharaan (logika bisnis bocor ke database) yang harus diperbaiki sebelum go-live dengan data riil yang besar.

🚨 BAGIAN 1: Analisa Mendalam "The Big 3" (Kritis)

1. The "SUM Trigger Trap" (Risiko: Critical Performance Bottleneck)

Lokasi: backend/supabase/migrations/042_negative_stock_prevention.sql

Analisa Teknis:
Trigger saat ini menghitung saldo on-the-fly setiap kali ada transaksi keluar (ISSUE):

-- BAD PRACTICE
SELECT COALESCE(SUM(qty_in - qty_out), 0) ... FROM raw_material_ledger ...


Kompleksitas Waktu: O(N). Jika ada 100.000 transaksi sejarah untuk Material A, database melakukan scan terhadap 100.000 baris hanya untuk validasi 1 baris baru.

Masalah Locking: Agregasi SUM pada tabel yang sering di-write memicu lock contention. Jika 5 user melakukan 'Goods Issue' bersamaan, mereka akan saling menunggu (blocking), menyebabkan timeout.

Solusi Arsitektural (The Summary Table Pattern):

Buat tabel baru: inventory_balances (material_id, warehouse_id, current_qty).

Ubah Trigger Ledger:

Saat INSERT ke ledger, lakukan UPDATE inventory_balances SET current_qty = current_qty + NEW.qty_in - NEW.qty_out.

Pindahkan constraint: Tambahkan CHECK (current_qty >= 0) pada tabel inventory_balances.

Hasil: Kompleksitas turun ke O(1). Validasi instan tanpa scan sejarah.

2. Logic Leakage & Orchestration (Risiko: Maintainability)

Lokasi: src/integrations/supabase/types.ts (Daftar Functions: post_grn, post_sales_invoice, dll).

Analisa Teknis:
Fungsi SQL seperti post_grn melakukan terlalu banyak hal:

Update status dokumen.

Looping items.

Insert ke Ledger.

Insert ke Jurnal.

Ini melanggar prinsip Separation of Concerns.

Debugging Nightmare: Error di baris ke-50 dalam fungsi SQL sulit dilacak stack trace-nya dari sisi aplikasi (Node/React).

Vendor Lock-in: Logika bisnis Anda terikat mati dengan syntax PL/pgSQL Supabase.

Solusi Arsitektural:
Pindahkan logika orkestrasi ke Backend Service (Node.js / Edge Functions).

Gunakan db.transaction() di library client.

Database hanya bertugas menolak jika aturan dilanggar (misal: stok negatif), bukan mengatur flow dokumen.

3. Partial Journal Entry (Risiko: Data Integrity Lock)

Lokasi: backend/supabase/migrations/043_unbalanced_journal_check.sql

Analisa Teknis:
Trigger AFTER INSERT berjalan per baris (row-level).

Aplikasi mengirim: Debit 100. -> Trigger Cek: Debit 100, Kredit 0 -> ERROR.

Aplikasi tidak akan pernah bisa mengirim baris Kredit penyeimbangnya karena baris pertama sudah ditolak.

Solusi Arsitektural:
Opsi A (Paling Robust): Gunakan Deferred Constraint.

CREATE CONSTRAINT TRIGGER check_balance
AFTER INSERT ON journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION ...


Ini menunda pengecekan sampai transaksi COMMIT selesai.

Opsi B (Praktis): Gunakan RPC/Function yang menerima Array of Objects, lalu insert sekaligus dalam satu perintah SQL.

🔍 BAGIAN 2: Temuan Baru (Security & Architecture)

4. Isu Isolasi Tenant (Security Risk) 🛑

Observasi:
Tabel companies dan mapping user ada, tapi saya melihat potensi celah di Frontend atau RPC.
Jika Frontend mengirim payload seperti ini:

{
  "company_id": "uuid-perusahaan-orang-lain",
  "qty": 100
}


Apakah RLS (Row Level Security) memvalidasi bahwa auth.uid() benar-benar memiliki akses ke company_id tersebut di tabel user_company_mapping?

Rekomendasi:
Jangan pernah mempercayai company_id dari body request untuk operasi sensitif. Selalu resolve company_id di sisi server berdasarkan sesi user yang aktif, atau pastikan RLS Policy memaksa check ke tabel mapping.

5. Masalah Floating Point (Financial Accuracy) ⚠️

Observasi:
Tipe data di TypeScript (types.ts) menggunakan number. Database menggunakan decimal.
JavaScript number adalah IEEE 754 float.

Contoh Bahaya: 0.1 + 0.2 === 0.30000000000000004.

Jika Frontend menghitung pajak: 100 * 0.11 mungkin menghasilkan angka aneh yang menyebabkan validasi jurnal "Unbalanced" karena selisih 0.0000001.

Rekomendasi:

Frontend: Gunakan library seperti decimal.js, big.js, atau dinero.js untuk semua kalkulasi uang. Jangan gunakan operasi matematika JS native (+ - * /) untuk uang.

Database: Tetap gunakan DECIMAL(15,2) atau simpan dalam integer (cents) jika memungkinkan.

6. Client-Side Trust (Security Risk)

Observasi:
Pada src/pages/sales/CreateSalesOrder.tsx (dan hook useSales), tampaknya Frontend menghitung subtotal, tax_amount, dan total_amount lalu mengirimnya ke Database.

Risiko:
Attacker bisa mencegat request API dan mengirim:

Items: iPhone 15, Qty: 1, Price: 20.000.000

Total_Amount: 500 (Dimanipulasi)

Rekomendasi:
Backend/Database harus menghitung ulang total berdasarkan harga satuan di master data produk saat transaksi dibuat. Jangan percaya total kiriman client.

7. Stale Data pada Materialized Views

Observasi:
Terdapat migrasi 030_analytics_mvs.sql. Materialized View (MV) sangat bagus untuk performa dashboard, tapi data tidak real-time.

Apakah ada trigger REFRESH MATERIALIZED VIEW CONCURRENTLY?

Jika tidak, user mungkin bingung kenapa stok di Dashboard berbeda dengan di halaman Stok Opname.

Rekomendasi:
Jika refresh otomatis terlalu berat, berikan indikator di UI: "Data updated 1 hour ago. [Refresh Now]".

💡 BAGIAN 3: Rekomendasi Frontend (DX & Reliability)

8. Hardcoded Enums di Frontend

Lokasi: src/integrations/supabase/types.ts mengekspor Enum, tapi di file UI (SalesOrders.tsx dll) seringkali status ditulis string manual seperti 'draft', 'posted'.

Rekomendasi:
Buat file src/constants/enums.ts yang memetakan Enum dari Supabase Type. Gunakan ini di seluruh UI untuk menghindari typo (misal: menulis 'canceled' padahal database maunya 'cancelled' - double 'l').

9. Error Handling UX

Banyak hooks menggunakan toast untuk error. Pastikan error dari Database Invariants (seperti "Stok Negatif") ditangkap dan ditampilkan sebagai pesan yang ramah manusia, bukan "Database Error: 23514".

🔎 BAGIAN 4: Temuan Lanjutan (Detail & Edge Cases)

10. Infinite Recursion Risk pada BOM (Crash Risk)

Lokasi: Function explode_bom pada types.ts.
Observasi:
Fungsi explode_bom kemungkinan besar menggunakan SQL WITH RECURSIVE untuk memecah struktur produk bertingkat (Produk Jadi -> Komponen A -> Sub-komponen B).
Masalah:
Jika user secara tidak sengaja membuat siklus (Produk A membutuhkan Produk B, Produk B membutuhkan Produk A), fungsi ini akan memicu Infinite Loop sampai memory database habis dan crash.
Solusi:
Tambahkan deteksi siklus pada query SQL:
WITH RECURSIVE bom_tree AS ( ... ) CYCLE component_product_id SET is_cycle USING path

11. Masalah "Journal Date Shift" (Financial Integrity)

Observasi:
Field transaction_date di ledger bertipe string (kemungkinan YYYY-MM-DD dari input type="date"), sedangkan database biasanya menyimpan timestamp UTC.
Masalah:
Jika server Supabase di set ke UTC dan user di WIB (UTC+7):

User input: "31 Des 2024".

Disimpan sebagai: "2024-12-30 17:00:00 UTC".

Laporan Keuangan Bulan Desember mungkin kehilangan transaksi tersebut, atau Laporan Bulan Januari kelebihan transaksi.
Solusi:
Simpan tanggal transaksi akuntansi (journal_date) sebagai tipe DATE (bukan TIMESTAMPTZ) di PostgreSQL untuk mengunci tanggal kalender tanpa peduli jam/zona waktu.

12. Validasi Panjang String (Constraint Mismatch)

Observasi:
Database sering memiliki limit VARCHAR(50) untuk Kode Barang (sku atau code).
Frontend menggunakan validasi form standar.
Masalah:
Jika user memasukkan kode 60 karakter, Frontend mungkin meloloskan, tapi Database akan melempar error value too long for type character varying(50).
Solusi:
Pastikan skema Zod di Frontend disinkronkan secara ketat dengan skema Database:
sku: z.string().max(50, "Maksimal 50 karakter")

13. Audit Log Bloat (Operational Cost)

Observasi:
Tabel audit_log menyimpan old_values dan new_values dalam format JSON.
Untuk tabel transaksional tinggi seperti ledger, ukuran JSON ini bisa 10x lipat lebih besar dari data aslinya.
Masalah:
Dalam 6 bulan, tabel audit_log bisa membengkak menjadi puluhan Gigabyte, memperlambat backup dan meningkatkan biaya storage Supabase.
Solusi:

Pertimbangkan Partial Audit: Hanya simpan kolom yang berubah (changed_fields), bukan seluruh row JSON.

Setup Retention Policy: Hapus log > 1 tahun, atau pindahkan ke Cold Storage.

🕵️ BAGIAN 5: Temuan Frontend & UX (Black Box Analysis)

14. Masalah "Magic Strings" di Komponen UI

Observasi:
Tanpa membaca kode secara langsung, pola umum pada CreateSalesOrder.tsx dan SalesOrders.tsx sering kali menggunakan string literal untuk logika kondisional.
Contoh kode berisiko:

// BERISIKO
if (order.status === 'approved') { ... } 
// Jika di DB statusnya 'Approved' (Case Sensitive), ini akan gagal diam-diam.


Rekomendasi:
Buat file src/constants/status.ts atau gunakan enum dari generated types Supabase.

import { Enums } from '@/integrations/supabase/types';
if (order.status === Enums.po_status.approved) { ... }


15. Form Input: Validasi Angka Negatif

Observasi:
Pada form CreateSalesOrder atau ReceiveGoods, input quantity sering hanya divalidasi required.
Risiko:
User bisa tidak sengaja (atau sengaja) memasukkan -50 pada input quantity penerimaan barang. Jika backend tidak memvalidasi ulang (hanya percaya frontend), ini bisa merusak stok (mengurangi stok padahal harusnya menambah).
Solusi:
Pastikan Zod schema di Frontend memblokir angka negatif: z.number().min(0.0001, "Harus lebih dari 0").

16. Performance: List Virtualization Missing

Observasi:
File SalesOrders.tsx menggunakan komponen Table standar. Tidak terlihat adanya dependensi react-window atau tanstack/react-virtual di package.json.
Masalah:
Jika user memuat 500 Sales Order sekaligus, DOM browser akan membengkak dengan ribuan node <tr> dan <td>, menyebabkan aplikasi menjadi lambat (laggy) saat scrolling.
Solusi:
Gunakan Pagination Server-Side (jangan load semua data) atau implementasi Virtual Scrolling untuk list panjang.

17. UX: Feedback Error Generik

Observasi:
Penggunaan use-toast.ts mengindikasikan error ditampilkan via Toast.
Masalah:
Seringkali error dari Supabase (PostgrestError) langsung di-dump ke toast message. Pesan seperti violates check constraint "chk_negative_stock" sangat membingungkan user awam.
Solusi:
Buat errorHandler utility yang memetakan kode error Postgres ke pesan bahasa manusia:

23514 -> "Stok tidak mencukupi untuk melakukan transaksi ini."

23505 -> "Nomor dokumen ini sudah digunakan."

☁️ BAGIAN 6: Infrastruktur & DevSecOps

18. Eksposur Kunci API (Miskonfigurasi)

Observasi:
File client.ts di src/integrations/supabase biasanya mengekspor supabase client.
Risiko:
Jika SUPABASE_KEY (Anon Key) terekspos di repo publik (github), attacker bisa menggunakan API tersebut. Meskipun ada RLS, attacker bisa melakukan spam request (DDoS) ke API.
Solusi:
Pastikan .env tidak pernah di-commit (cek .gitignore). Gunakan variabel lingkungan di Vite (import.meta.env.VITE_SUPABASE_KEY).

19. Migrasi Database Manual (Resiko Drift)

Observasi:
Banyak file SQL di backend/supabase/migrations/ dan skrip PowerShell deploy-migrations.ps1.
Masalah:
Jika developer lupa menjalankan skrip deploy setelah menarik update dari git, schema database lokal akan berbeda dengan kode backend, menyebabkan error runtime yang aneh.
Solusi:
Tambahkan check integritas schema saat aplikasi start, atau gunakan tool migrasi otomatis di pipeline CI/CD (GitHub Actions) untuk deploy ke staging/prod.

20. Edge Function Cold Start

Observasi:
Banyak logika pindah ke Edge Functions (backend/supabase/functions/).
Risiko:
Edge functions memiliki "Cold Start" jika jarang dipanggil. User pertama di pagi hari mungkin mengalami loading 2-3 detik lebih lama saat melakukan Post Sales Invoice.
Solusi:
Gunakan Keep-Warm script (cron job sederhana) yang memanggil fungsi dummy setiap 10 menit selama jam kerja operasional.

🐛 BAGIAN 7: Code Quality & Reliability (Frontend)

21. Race Condition pada Data Fetching (Bug Asinkron)

Lokasi: Hooks (src/hooks/useSales.ts dll).
Observasi:
Jika hooks menggunakan useEffect untuk fetch data tanpa cleanup atau pembatalan (abort):

User filter "Customer A" (Request 1 - Lambat).

User ganti filter "Customer B" (Request 2 - Cepat).

Request 2 selesai (UI tampilkan B).

Request 1 selesai (UI ditimpa oleh A).
Solusi:
Gunakan AbortController pada fetch atau library seperti React Query yang menangani ini otomatis.

22. Date Parsing Hazard (Cross-Browser Bug)

Lokasi: src/lib/utils.ts.
Observasi:
Parsing string tanggal SQL (YYYY-MM-DD) menggunakan konstruktor new Date() berperilaku berbeda di Safari vs Chrome.

Chrome: Menganggap UTC (seringkali).

Safari: Menganggap ISO-8601 (Local Time).

Akibat: Tanggal faktur yang seharusnya "1 Januari" bisa tampil "31 Desember" di iPhone user.
Solusi:
Gunakan library date-fns fungsi parseISO yang konsisten di semua browser, jangan gunakan new Date(string).

23. Context Re-render Storm (Performance)

Lokasi: src/contexts/AppContext.tsx.
Observasi:
Jika value context dibuat inline: <Context.Provider value={{ state, dispatch }}>.
Setiap kali parent re-render, objek value dibuat baru, memaksa semua komponen consumer re-render, meskipun datanya sama.
Solusi:
Bungkus value context dengan useMemo.

24. Hardcoded Locale & Currency

Lokasi: src/lib/utils.ts.
Observasi:
Formatter kemungkinan besar di-hardcode ke id-ID dan IDR.

new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })


Risiko:
Jika aplikasi perlu mendukung Multi-Company dengan mata uang USD atau SGD, kode ini harus di-refactor massal.
Solusi:
Terima parameter locale dan currency pada fungsi format, atau ambil dari userSettings.

📉 BAGIAN 8: Database Performance & Testing

25. Missing Foreign Key Indexes (Performance Killer)

Observasi:
PostgreSQL tidak secara otomatis membuat index pada kolom Foreign Key.
Contoh: Tabel raw_material_ledger memiliki material_id.
Masalah:
Saat Anda membuka halaman "Detail Material" untuk melihat riwayat stok, database melakukan scan ke tabel ledger. Tanpa index pada material_id, ini menjadi Sequential Scan. Semakin banyak data, semakin lambat halaman detail material.
Solusi:
Cek semua file migrasi dan pastikan setiap kolom berakhiran _id memiliki index:

CREATE INDEX idx_ledger_material ON raw_material_ledger(material_id);


26. Risiko "ON DELETE CASCADE" pada Transaksi (Audit Loss)

Observasi:
Cek migrasi 022_sales_orders.sql. Apakah relasi sales_order_items menggunakan ON DELETE CASCADE?
Masalah:
Jika admin menghapus header sales_orders, item-item di dalamnya ikut hilang tanpa jejak. Untuk aplikasi finansial, data transaksi tidak boleh hilang walau dibatalkan.
Solusi:
Gunakan ON DELETE RESTRICT untuk mencegah penghapusan jika ada data terkait, atau gunakan mekanisme Soft Delete (deleted_at column) untuk menandai data batal.

27. Test Coverage Gap (Reliability Risk)

Observasi:
Folder src/test/ hanya berisi smoke.test.ts.
Logika kompleks seperti kalkulasi total di CreateSalesOrder (diskon, pajak, subtotal) ada di Frontend tapi tidak di-test unit.
Risiko:
Developer refactor komponen, tidak sengaja merusak logika diskon. Bug ini lolos ke production karena "Smoke Test" hanya mengecek apakah halaman bisa dibuka, bukan apakah hitungannya benar.
Solusi:
Tambahkan unit test menggunakan Vitest/Jest khusus untuk fungsi utilitas matematika di Frontend.

🚀 BAGIAN 9: Advanced Frontend & Security Hardening

28. Bundle Size Bloat (Critical UX)

Observasi:
Struktur App.tsx tampaknya mengimpor semua halaman secara langsung (static import).
import SalesOrders from './pages/sales/SalesOrders';
Masalah:
Saat user membuka halaman Login, browser dipaksa mengunduh seluruh aplikasi (termasuk modul Produksi, Akuntansi, dll). Ini menyebabkan waktu loading awal yang lambat, terutama di jaringan seluler.
Solusi:
Gunakan Code Splitting dengan React.lazy() dan Suspense.

const SalesOrders = React.lazy(() => import('./pages/sales/SalesOrders'));
// Bungkus Routes dengan <Suspense fallback={<Loading />}>


29. RLS "Permissive Fix" Risk (Security Breach)

Observasi:
File backend/supabase/migrations/046_relax_coa_constraints.sql dan 032_fix_permissions.sql ada.
Risiko:
Seringkali developer menggunakan create policy "allow all" on table for all using (true); untuk memperbaiki error "Permission Denied" dengan cepat.
Jika ini terjadi pada tabel products atau customers, maka satu tenant bisa melihat data tenant lain hanya dengan mengetahui URL API-nya.
Solusi:
Audit ulang semua RLS Policy. Pastikan setiap tabel publik memiliki filter using (company_id = auth.user_company_id()).

30. Zombie Event Listeners (Memory Leak)

Lokasi: Hooks seperti use-mobile.tsx.
Observasi:
Jika hooks menambahkan event listener ke window atau document:

useEffect(() => {
  const handler = () => ...;
  window.addEventListener('resize', handler);
  // JIKA INI HILANG, MEMORY LEAK TERJADI:
  return () => window.removeEventListener('resize', handler);
}, []);


Risiko:
Setiap kali komponen di-mount/unmount, listener baru dibuat tapi yang lama tidak dibuang. Setelah navigasi 10 halaman, aplikasi menjadi sangat lambat.

31. Unsafe Type Casting (TypeScript)

Observasi:
Banyak penggunaan as unknown as Type di layer integrasi Supabase untuk memaksakan tipe data agar cocok.
Masalah:
Ini menipu compiler. Jika struktur database berubah (misal: kolom status dihapus), TypeScript tidak akan menampilkan error, tapi aplikasi akan crash di runtime (undefined is not an object).
Solusi:
Gunakan Zod untuk memvalidasi data yang masuk dari API di runtime, daripada hanya mengandalkan casting statis.