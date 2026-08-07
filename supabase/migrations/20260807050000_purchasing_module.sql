create type po_status as enum ('draft', 'ordered', 'received', 'cancelled');

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  tax_id text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  po_number text not null,
  status po_status not null default 'draft',
  total_amount numeric(10, 2) not null default 0.00,
  expected_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  po_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity integer not null default 1,
  unit_price numeric(10, 2) not null default 0.00,
  created_at timestamptz not null default now()
);

alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;

create policy suppliers_rw on suppliers
  for all to authenticated
  using (private.is_org_member(org_id)) with check (private.is_org_member(org_id));

create policy purchase_orders_rw on purchase_orders
  for all to authenticated
  using (private.is_org_member(org_id)) with check (private.is_org_member(org_id));

create policy purchase_order_items_rw on purchase_order_items
  for all to authenticated
  using (private.is_org_member(org_id)) with check (private.is_org_member(org_id));
