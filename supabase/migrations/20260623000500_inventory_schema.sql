-- Create inventory_items table
create table if not exists public.inventory_items (
  id text primary key,
  name_th text not null,
  name_en text not null,
  category text not null,
  location text not null,
  total_qty integer not null default 1,
  available_qty integer not null default 1,
  is_many boolean not null default false,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create inventory_transactions table
create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  item_id text not null references public.inventory_items(id) on delete cascade,
  quantity integer not null default 1,
  borrow_date timestamptz not null default now(),
  expected_return_date date not null,
  actual_return_date timestamptz,
  status text not null default 'borrowed' check (status in ('borrowed', 'returned', 'overdue')),
  reason text not null,
  checkout_photo_url text,
  return_photo_url text,
  return_condition text check (return_condition in ('สภาพดี', 'ได้รับความเสียหาย', 'ใช้แล้วหมดไป')),
  return_notes text,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;

-- Policies for inventory_items
drop policy if exists "Allow all users to read active items" on public.inventory_items;
create policy "Allow all users to read active items"
  on public.inventory_items for select
  using (is_active = true);

drop policy if exists "Allow staff and admin to manage items" on public.inventory_items;
create policy "Allow staff and admin to manage items"
  on public.inventory_items for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('staff', 'admin')
    )
  );

-- Policies for inventory_transactions
drop policy if exists "Allow students to view their own transactions" on public.inventory_transactions;
create policy "Allow students to view their own transactions"
  on public.inventory_transactions for select
  using (
    exists (
      select 1 from public.students s
      where s.id = student_id and s.profile_id = auth.uid()
    )
  );

drop policy if exists "Allow students to borrow items" on public.inventory_transactions;
create policy "Allow students to borrow items"
  on public.inventory_transactions for insert
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_id and s.profile_id = auth.uid()
    )
  );

drop policy if exists "Allow students to return their borrowed items" on public.inventory_transactions;
create policy "Allow students to return their borrowed items"
  on public.inventory_transactions for update
  using (
    exists (
      select 1 from public.students s
      where s.id = student_id and s.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_id and s.profile_id = auth.uid()
    )
  );

drop policy if exists "Allow staff and admin to manage all transactions" on public.inventory_transactions;
create policy "Allow staff and admin to manage all transactions"
  on public.inventory_transactions for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('staff', 'admin')
    )
  );

-- Function to clean up old transaction photos after 30 days
create or replace function public.cleanup_old_transaction_photos()
returns void as $$
begin
  update public.inventory_transactions
  set checkout_photo_url = null,
      return_photo_url = null
  where status = 'returned'
    and actual_return_date < now() - interval '30 days'
    and (checkout_photo_url is not null or return_photo_url is not null);
end;
$$ language plpgsql security definer;
