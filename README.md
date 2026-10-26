# Capo Invoice

Web laporan invoice bulanan Capo: status **belum bayar / baru DP / lunas**, sisa piutang, total PO, dan margin (tagihan − PO). Anak-anak input invoice dan pembayaran langsung di web, owner tinggal buka.

- **Website**: HTML + JS biasa, di-hosting gratis di GitHub Pages.
- **Database + login**: Supabase (gratis). Hanya akun yang dibuat owner yang bisa masuk.

```
index.html               halaman utama
style.css                tampilan
app.js                   logika (hitung status, margin, simpan data)
config.js                alamat database (diisi di langkah 2)
supabase/schema.sql      struktur tabel + keamanan
supabase/seed_sept_2026.sql  data laporan September 2026 (65 invoice)
```

---

## Setup sekali (±20 menit)

### 1. Bikin database di Supabase
1. Daftar di https://supabase.com, lalu klik **New project**. Kasih nama `capo-invoice`, pilih region **Southeast Asia (Singapore)**, dan simpan password database-nya.
2. Tunggu project selesai dibuat, lalu buka menu **SQL Editor** dan klik **New query**.
3. Copy semua isi `supabase/schema.sql`, paste, lalu klik **Run**.
4. Bikin query baru lagi. Copy semua isi `supabase/seed_sept_2026.sql`, paste, lalu klik **Run**. Data September masuk.

### 2. Sambungkan website ke database
1. Di Supabase, buka **Project Settings → API**.
2. Copy **Project URL** dan **anon public key**.
3. Buka `config.js` dan ganti `ISI_PROJECT_URL` dan `ISI_ANON_PUBLIC_KEY` dengan dua nilai itu.

> Anon key aman ditaruh di GitHub, karena data tetap terkunci oleh login. **Service role key jangan pernah** dimasukkan ke file mana pun.

### 3. Kunci pendaftaran dan bikin akun tim
1. Di Supabase, buka **Authentication → Sign In / Providers**. Matikan **Allow new users to sign up**, supaya orang luar nggak bisa daftar sendiri.
2. Buka **Authentication → Users** dan klik **Add user → Create new user**. Isi email dan password, centang **Auto Confirm User**.
3. Ulangi untuk lu sendiri dan tiap anak. Kasih password-nya ke masing-masing langsung, jangan lewat grup.

### 4. Upload ke GitHub dan nyalakan GitHub Pages
1. Bikin repo baru di GitHub, misalnya `capo-invoice`.
2. Upload semua file di folder ini (lewat **Add file → Upload files** atau `git push`).
3. Buka repo, lalu **Settings → Pages**. Di bagian Source pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
4. Tunggu 1–2 menit. Webnya jadi di `https://<username-github>.github.io/capo-invoice/`.
5. Di Supabase, buka **Authentication → URL Configuration** dan isi **Site URL** dengan alamat itu.

Selesai. Buka alamatnya, login, terus pilih **September 2026**.

---

## Cara pakai harian (buat anak-anak)

1. **Invoice terbit:** klik **+ Invoice baru**, isi nomor, tanggal, customer, total tagihan, dan **total PO**.
2. **Ada transfer masuk:** klik baris invoice-nya, isi nominal dan tanggal transfer, lalu klik **Simpan pembayaran**. Kalau langsung lunas, klik **Isi sisa (lunas)**.
3. **PO berubah:** klik invoice, pilih **Edit invoice**, lalu ganti total PO.
4. **Tiap Senin:** beresin semua yang muncul di kotak **Perlu dicek**.

## Buat owner

- Pilih bulan di kanan atas. Ringkasan di halaman itu sudah jadi laporan bulanannya.
- Pilih **Semua piutang** untuk lihat semua tagihan yang belum lunas dari bulan mana pun.
- Klik **Unduh CSV** kalau butuh file Excel buat accounting.

## Update tampilan / fitur

Edit file di repo, commit, dan GitHub Pages update sendiri dalam 1–2 menit. Data nggak ikut berubah, karena data tersimpan di Supabase, bukan di GitHub.

## Catatan data September 2026

- Invoice `0259` Ms Magie tercatat dobel di PDF, jadi di sini cuma dimasukkan sekali. Akibatnya margin turun Rp11.885.510 dari versi PDF.
- Invoice `0301` (PT Agung) dan `0297` (Mr Kevin Jasa) belum ada PO-nya.
- PO Victor Tandra (`0309`) sama persis dengan Mr Chris (`0315`), yaitu Rp7.544.790. Perlu dicek, kemungkinan salah copy.
- Pembayaran lama dicatat sebagai satu baris "s/d laporan Sept" karena di PDF nggak ada tanggal transfernya.
