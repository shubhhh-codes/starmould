-- Migration 021: Drop redundant legacy columns & cleanly restructure quotation_terms_presets

DROP TABLE IF EXISTS public.quotation_terms_presets CASCADE;

CREATE TABLE public.quotation_terms_presets (
  id SERIAL PRIMARY KEY,
  term_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_quotation_terms_presets_type ON public.quotation_terms_presets(term_type);

-- 1. PRICE TERMS (Clean, Structured)
INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default) VALUES
('price', 'Ex-Works Rajkot + 18% GST (Official)', 
 'Prices are in Indian Rupees (₹), firm and fixed, Ex-Works Rajkot. GST @ 18% extra as applicable at the time of invoicing. Freight, transit insurance, and local handling charges are extra at actuals.', 
 true),
('price', 'Ex-Works Rajkot (Freight Extra at Actuals)', 
 'Prices are Ex-Works Rajkot factory. GST @ 18% extra as applicable. Freight and transit insurance shall be arranged by customer or billed extra at actuals.', 
 false),
('price', 'FOR Destination (Freight & Insurance Included)', 
 'Prices are on Free on Road (FOR) destination basis, inclusive of standard packaging, freight, and transit insurance up to customer site. GST @ 18% extra as applicable.', 
 false),
('price', 'GST Included in Base Price (Composite)', 
 'Prices quoted are inclusive of 18% GST. Standard packing included; freight and unloading at destination are to the customer''s account.', 
 false);

-- 2. DELIVERY TERMS (Clean, Structured)
INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default) VALUES
('delivery', 'Tooling & Mould Fabrication (3-4 Weeks)', 
 'Dispatch within 3 to 4 weeks from the date of receiving written Purchase Order, advance payment, and final 3D drawing/sample approval; subject to production capacity and material availability.', 
 true),
('delivery', 'Production Mould Set (5-6 Weeks)', 
 'Dispatch within 5 to 6 weeks from final drawing approval and clear advance payment receipt.', 
 false),
('delivery', 'Ready Stock / Standard Spares (1-2 Days)', 
 'Ready stock items will be dispatched within 1 to 2 working days upon receipt of confirmed Purchase Order and payment.', 
 false),
('delivery', 'Tooling Spares & Mesh Replacement (4-7 Days)', 
 'Mesh, spare plates, and tooling consumables will be dispatched within 4 to 7 working days from order confirmation.', 
 false),
('delivery', 'Partial Phased Delivery Schedule', 
 'Delivery will be executed in agreed phased lots starting 3 weeks from advance receipt, with subsequent lots dispatched every 10 working days.', 
 false);

-- 3. PAYMENT TERMS (Clean, Structured)
INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default) VALUES
('payment', '50% Advance + 50% Before Dispatch (Official)', 
 '50% advance payment along with official Purchase Order, and balance 50% against Proforma Invoice prior to dispatch. Payment by RTGS / NEFT in favour of Starmould Technology Pvt. Ltd.', 
 true),
('payment', '70% Advance + 30% Before Dispatch (Custom Tooling)', 
 '70% advance payment along with Purchase Order, and balance 30% against Proforma Invoice prior to dispatch. Payment by RTGS / NEFT in favour of Starmould Technology Pvt. Ltd.', 
 false),
('payment', '100% Advance Against Proforma Invoice', 
 '100% advance payment against Proforma Invoice prior to dispatch. Payment by RTGS / NEFT in favour of Starmould Technology Pvt. Ltd.', 
 false),
('payment', '30% Advance + 70% Within 15 Days (Approved Accounts)', 
 '30% advance with Purchase Order, balance 70% within 15 days of dispatch / delivery. Subject to credit pre-approval.', 
 false),
('payment', '30 Days Net Credit (Corporate Accounts)', 
 '100% payment within 30 days from invoice date via RTGS / NEFT. Late payments shall attract interest @ 18% per annum.', 
 false);

-- 4. VALIDITY TERMS (Clean, Structured)
INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default) VALUES
('validity', '15 Days from Issue Date (Official)', 
 'This quotation is valid for 15 days from the date of issue. Prices and delivery schedules are subject to review and confirmation thereafter.', 
 true),
('validity', '30 Days from Issue Date (Project Validity)', 
 'This quotation remains valid for 30 calendar days from the date of issue, after which rates and lead times may be revised.', 
 false),
('validity', '7 Days (Volatile Material Rates)', 
 'This quotation is valid for 7 days only due to fluctuations in raw material costs. Orders placed after this period require price revalidation.', 
 false);

-- 5. FORCE MAJEURE (Clean, Structured)
INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default) VALUES
('force_majeure', 'Standard Clause Applicable (Official)', 
 'This Clause Is Applicable.', 
 true),
('force_majeure', 'Comprehensive Force Majeure Clause', 
 'Neither party shall be held responsible for delays or failure to perform obligations arising from acts of God, natural calamities, fire, flood, labor strikes, power grid failures, statutory regulations, pandemics, or unforeseen events beyond reasonable management control.', 
 false),
('force_majeure', 'Not Applicable / Excluded', 
 'Not Applicable.', 
 false);
