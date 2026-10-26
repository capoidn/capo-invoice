-- Capo Invoice: struktur database.
-- Jalankan sekali di Supabase > SQL Editor > New query > Run.

create table if not exists public.invoices (
  id          uuid primary key default gen_random_uuid(),
  inv         text not null unique,          -- nomor invoice, contoh INV/2026/0109/BNSM/0249
  tanggal     date,                          -- tanggal invoice
  bulan       text not null,                 -- bulan laporan, format YYYY-MM
  customer    text not null,
  total       bigint not null default 0,     -- total tagihan (Rp)
  po          bigint not null default 0,     -- total PO / modal ke supplier (Rp)
  catatan     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  nominal     bigint not null check (nominal > 0),
  tanggal     date,                          -- tanggal transfer masuk
  ket         text not null default '',      -- DP 50%, pelunasan, BCA, dst
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists payments_invoice_idx on public.payments(invoice_id);
create index if not exists invoices_bulan_idx on public.invoices(bulan);

-- updated_at otomatis
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists invoices_touch on public.invoices;
create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();

-- Keamanan: hanya user yang login (akun dibuat owner di Supabase) yang bisa baca/tulis.
alter table public.invoices enable row level security;
alter table public.payments enable row level security;

drop policy if exists "team all invoices" on public.invoices;
create policy "team all invoices" on public.invoices
  for all to authenticated using (true) with check (true);

drop policy if exists "team all payments" on public.payments;
create policy "team all payments" on public.payments
  for all to authenticated using (true) with check (true);
