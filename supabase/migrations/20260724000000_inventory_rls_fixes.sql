-- 1. Allow authenticated users to update available_qty in inventory_items
drop policy if exists "Allow authenticated users to update item quantity" on public.inventory_items;
create policy "Allow authenticated users to update item quantity"
  on public.inventory_items for update
  to authenticated
  using (is_active = true)
  with check (is_active = true);

-- 2. Ensure inventory_photos bucket is public
insert into storage.buckets (id, name, public)
values ('inventory_photos', 'inventory_photos', true)
on conflict (id) do update set public = true;

-- 3. Allow uploads (INSERT) to inventory_photos bucket in storage.objects
drop policy if exists "Allow uploads to inventory_photos" on storage.objects;
create policy "Allow uploads to inventory_photos"
  on storage.objects for insert
  with check (bucket_id = 'inventory_photos');

-- 4. Allow public reads (SELECT) from inventory_photos bucket
drop policy if exists "Allow reads from inventory_photos" on storage.objects;
create policy "Allow reads from inventory_photos"
  on storage.objects for select
  using (bucket_id = 'inventory_photos');

-- 5. Allow updates (UPDATE) to inventory_photos bucket
drop policy if exists "Allow updates to inventory_photos" on storage.objects;
create policy "Allow updates to inventory_photos"
  on storage.objects for update
  using (bucket_id = 'inventory_photos');
