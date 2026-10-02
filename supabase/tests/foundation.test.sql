begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

select has_schema('public', 'The application schema exists');
select ok(
  not has_schema_privilege('anon', 'public', 'CREATE'),
  'Anonymous requests cannot create database objects'
);
select ok(
  not has_schema_privilege('authenticated', 'public', 'CREATE'),
  'Authenticated requests cannot create database objects'
);

-- Temporary fixtures prove future migrations must explicitly opt into API
-- privileges. The enclosing transaction removes them after the test.
create table public.foundation_permission_probe (id integer primary key);
create sequence public.foundation_sequence_probe;
create function public.foundation_function_probe() returns integer
  language sql as $$ select 1 $$;

select ok(
  not has_table_privilege('anon', 'public.foundation_permission_probe', 'SELECT'),
  'Future tables are not readable anonymously by default'
);
select ok(
  not has_table_privilege('authenticated', 'public.foundation_permission_probe', 'SELECT'),
  'Future tables require explicit authenticated read grants'
);
select ok(
  not has_sequence_privilege('anon', 'public.foundation_sequence_probe', 'USAGE'),
  'Future sequences are not usable anonymously by default'
);
select ok(
  not has_sequence_privilege('authenticated', 'public.foundation_sequence_probe', 'USAGE'),
  'Future sequences require explicit authenticated grants'
);
select ok(
  not has_function_privilege('anon', 'public.foundation_function_probe()', 'EXECUTE'),
  'Future functions are not executable anonymously by default'
);
select ok(
  not has_function_privilege('authenticated', 'public.foundation_function_probe()', 'EXECUTE'),
  'Future functions require explicit authenticated execute grants'
);

select * from finish();
rollback;
