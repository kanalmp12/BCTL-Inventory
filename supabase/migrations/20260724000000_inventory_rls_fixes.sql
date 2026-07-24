-- Allow authenticated users to update available_qty in inventory_items
-- This is required so students can update item quantities during checkout/return
drop policy if exists "Allow authenticated users to update item quantity" on public.inventory_items;
create policy "Allow authenticated users to update item quantity"
  on public.inventory_items for update
  to authenticated
  using (is_active = true)
  with check (is_active = true);
