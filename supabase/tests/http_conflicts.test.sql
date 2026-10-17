begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok(not has_function_privilege('anon',p.oid,'EXECUTE'),'Anonymous cannot invoke checked mutation '||p.proname)
 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('set_member_caci_if_current','publish_selection_checked','mark_confirmed_attendance','transfer_presidency_if_current');
select ok(has_function_privilege('authenticated',p.oid,'EXECUTE'),'Authenticated grant preserved for '||p.proname)
 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('set_member_caci_if_current','publish_selection_checked','mark_confirmed_attendance','transfer_presidency_if_current');
select ok(p.proconfig @> array['search_path=""'],'Pinned search_path preserved for '||p.proname)
 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('set_member_caci_if_current','publish_selection_checked','mark_confirmed_attendance','transfer_presidency_if_current');
select * from finish();rollback;
