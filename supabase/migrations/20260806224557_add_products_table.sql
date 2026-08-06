create table products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  sku text,
  description text,
  price numeric(10, 2) not null default 0.00,
  cost numeric(10, 2) not null default 0.00,
  stock_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table products enable row level security;

create policy products_rw on products
  for all to authenticated
  using (private.is_org_member(org_id)) with check (private.is_org_member(org_id));
