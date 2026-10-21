-- Phase 3: Add foreign key constraints to public.vendors as NOT VALID, then VALIDATE
-- Part of: Split customers into customers + vendors (Starmould ERP)

-- Add foreign keys as NOT VALID
DO $$
BEGIN
    -- challan.vendorid
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_challan_vendorid') THEN
        ALTER TABLE public.challan
            ADD CONSTRAINT fk_challan_vendorid 
            FOREIGN KEY (vendorid) REFERENCES public.vendors(id) NOT VALID;
    END IF;

    -- challan.vendortid
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_challan_vendortid') THEN
        ALTER TABLE public.challan
            ADD CONSTRAINT fk_challan_vendortid 
            FOREIGN KEY (vendortid) REFERENCES public.vendors(id) NOT VALID;
    END IF;

    -- inward.vendorid
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inward_vendorid') THEN
        ALTER TABLE public.inward
            ADD CONSTRAINT fk_inward_vendorid 
            FOREIGN KEY (vendorid) REFERENCES public.vendors(id) NOT VALID;
    END IF;

    -- inward.vendortid
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inward_vendortid') THEN
        ALTER TABLE public.inward
            ADD CONSTRAINT fk_inward_vendortid 
            FOREIGN KEY (vendortid) REFERENCES public.vendors(id) NOT VALID;
    END IF;

    -- purchase.vname
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_purchase_vname') THEN
        ALTER TABLE public.purchase
            ADD CONSTRAINT fk_purchase_vname 
            FOREIGN KEY (vname) REFERENCES public.vendors(id) NOT VALID;
    END IF;

    -- dispatch.vendortid
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dispatch_vendortid') THEN
        ALTER TABLE public.dispatch
            ADD CONSTRAINT fk_dispatch_vendortid 
            FOREIGN KEY (vendortid) REFERENCES public.vendors(id) NOT VALID;
    END IF;
END $$;

-- Validate Constraints
ALTER TABLE public.challan VALIDATE CONSTRAINT fk_challan_vendorid;
ALTER TABLE public.challan VALIDATE CONSTRAINT fk_challan_vendortid;
ALTER TABLE public.inward VALIDATE CONSTRAINT fk_inward_vendorid;
ALTER TABLE public.inward VALIDATE CONSTRAINT fk_inward_vendortid;
ALTER TABLE public.purchase VALIDATE CONSTRAINT fk_purchase_vname;
ALTER TABLE public.dispatch VALIDATE CONSTRAINT fk_dispatch_vendortid;
