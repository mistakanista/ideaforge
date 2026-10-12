-- =====================================================================
-- IdeaForge: admins add and edit categories (US-5, step 3)
-- Based on 20261010192020_idea.sql, where categories were read-only for everybody.
--
-- Rules:
--   - only active admins can add or change categories (RLS)
--   - a category is never deleted, it is marked inactive (is_active = false);
--     inactive categories cannot be chosen for new ideas, existing ideas keep theirs
--   - name, description and is_active can be changed; category_id and sort_order cannot
--   - names stay unique (ignoring case, unique index ux_category_name)
--   - the database trims name and description and puts a new category at the end of the list
-- =====================================================================

-- Column privileges: category_id (generated) and sort_order are not writable through the API
grant insert (name, description, is_active), update (name, description, is_active)
  on public.category to authenticated;

create function public.category_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.name := trim(new.name);
  new.description := nullif(trim(new.description), '');

  if tg_op = 'INSERT' and new.sort_order = 0 then
    new.sort_order := coalesce((select max(sort_order) from public.category), 0) + 1;
  end if;

  return new;
end $$;

create trigger trg_category_check
  before insert or update on public.category
  for each row execute function public.category_check();

-- Trigger functions are not meant to be called through the API
revoke execute on function public.category_check() from public, anon, authenticated;

create policy "Admins can add categories"
  on public.category for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can change categories"
  on public.category for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

comment on table public.category is 'Idea categories, maintained by admins; never deleted, inactive categories cannot be chosen for new ideas.';
