-- PHASE 7 STEP A: Moving Average Schema Implementation

-- 1. Add columns to products
ALTER TABLE public.products
ADD COLUMN average_cost numeric(19, 4) NOT NULL DEFAULT 0.0000,
ADD COLUMN total_inventory_value numeric(19, 4) NOT NULL DEFAULT 0.0000;

-- Add constraints to products
ALTER TABLE public.products
ADD CONSTRAINT products_average_cost_check CHECK (average_cost >= 0),
ADD CONSTRAINT products_total_inventory_value_check CHECK (total_inventory_value >= 0);

-- 2. Add columns to inventory_transactions
ALTER TABLE public.inventory_transactions
ADD COLUMN unit_cost numeric(19, 4) DEFAULT NULL,
ADD COLUMN total_cost numeric(19, 4) DEFAULT NULL;

-- Add constraints to inventory_transactions
ALTER TABLE public.inventory_transactions
ADD CONSTRAINT inventory_transactions_unit_cost_check CHECK (unit_cost IS NULL OR unit_cost >= 0),
ADD CONSTRAINT inventory_transactions_total_cost_check CHECK (total_cost IS NULL OR total_cost >= 0);

-- 3. Data Integrity: Prevent direct API updates to average_cost and total_inventory_value
CREATE OR REPLACE FUNCTION public.check_product_cost_readonly()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.average_cost IS DISTINCT FROM OLD.average_cost OR NEW.total_inventory_value IS DISTINCT FROM OLD.total_inventory_value) THEN
        IF current_setting('app.bypass_cost_readonly', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'P0004: average_cost and total_inventory_value are system-calculated and cannot be modified directly.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_cost_readonly ON public.products;
CREATE TRIGGER trg_products_cost_readonly
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.check_product_cost_readonly();
