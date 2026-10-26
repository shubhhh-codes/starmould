-- Migration 020: Clean Reset & Professional Presets Seed

TRUNCATE TABLE public.quotation_terms_presets RESTART IDENTITY CASCADE;

-- 1. PRICE TERMS PRESETS
INSERT INTO public.quotation_terms_presets (term_type, title, content, price_terms, is_default, updated_at) VALUES
('price', 'Ex-Works Rajkot + 18% GST (Official)', 
 'Prices are in Indian Rupees (₹), firm and fixed, Ex-Works Rajkot. GST @ 18% extra as applicable at the time of invoicing. Freight, transit insurance, and local handling charges are extra at actuals.',
 'Prices are in Indian Rupees (₹), firm and fixed, Ex-Works Rajkot. GST @ 18% extra as applicable at the time of invoicing. Freight, transit insurance, and local handling charges are extra at actuals.',
 true, NOW()),

('price', 'Ex-Works Rajkot (Freight Extra at Actuals)', 
 'Prices are Ex-Works Rajkot factory. GST @ 18% extra as applicable. Freight and transit insurance shall be arranged by customer or billed extra at actuals.',
 'Prices are Ex-Works Rajkot factory. GST @ 18% extra as applicable. Freight and transit insurance shall be arranged by customer or billed extra at actuals.',
 false, NOW()),

('price', 'FOR Destination (Freight & Insurance Included)', 
 'Prices are on Free on Road (FOR) destination basis, inclusive of standard packaging, freight, and transit insurance up to customer site. GST @ 18% extra as applicable.',
 'Prices are on Free on Road (FOR) destination basis, inclusive of standard packaging, freight, and transit insurance up to customer site. GST @ 18% extra as applicable.',
 false, NOW()),

('price', 'GST Included in Base Price (Composite)', 
 'Prices quoted are inclusive of 18% GST. Standard packing included; freight and unloading at destination are to the customer''s account.',
 'Prices quoted are inclusive of 18% GST. Standard packing included; freight and unloading at destination are to the customer''s account.',
 false, NOW());

-- 2. DELIVERY TERMS PRESETS
INSERT INTO public.quotation_terms_presets (term_type, title, content, delivery_terms, is_default, updated_at) VALUES
('delivery', 'Tooling & Mould Fabrication (3-4 Weeks)', 
 'Dispatch within 3 to 4 weeks from the date of receiving written Purchase Order, advance payment, and final 3D drawing/sample approval; subject to production capacity and material availability.',
 'Dispatch within 3 to 4 weeks from the date of receiving written Purchase Order, advance payment, and final 3D drawing/sample approval; subject to production capacity and material availability.',
 true, NOW()),

('delivery', 'Production Mould Set (5-6 Weeks)', 
 'Dispatch within 5 to 6 weeks from final drawing approval and clear advance payment receipt.',
 'Dispatch within 5 to 6 weeks from final drawing approval and clear advance payment receipt.',
 false, NOW()),

('delivery', 'Ready Stock / Standard Spares (1-2 Days)', 
 'Ready stock items will be dispatched within 1 to 2 working days upon receipt of confirmed Purchase Order and payment.',
 'Ready stock items will be dispatched within 1 to 2 working days upon receipt of confirmed Purchase Order and payment.',
 false, NOW()),

('delivery', 'Tooling Spares & Mesh Replacement (4-7 Days)', 
 'Mesh, spare plates, and tooling consumables will be dispatched within 4 to 7 working days from order confirmation.',
 'Tooling Spares & Mesh Replacement (4-7 Days)',
 false, NOW()),

('delivery', 'Partial Phased Delivery Schedule', 
 'Delivery will be executed in agreed phased lots starting 3 weeks from advance receipt, with subsequent lots dispatched every 10 working days.',
 'Delivery will be executed in agreed phased lots starting 3 weeks from advance receipt, with subsequent lots dispatched every 10 working days.',
 false, NOW());

-- 3. PAYMENT TERMS PRESETS
INSERT INTO public.quotation_terms_presets (term_type, title, content, payment_terms, is_default, updated_at) VALUES
('payment', '50% Advance + 50% Before Dispatch (Official)', 
 '50% advance payment along with official Purchase Order, and balance 50% against Proforma Invoice prior to dispatch. Payment by RTGS / NEFT in favour of Starmould Technology Pvt. Ltd.',
 '50% advance payment along with official Purchase Order, and balance 50% against Proforma Invoice prior to dispatch. Payment by RTGS / NEFT in favour of Starmould Technology Pvt. Ltd.',
 true, NOW()),

('payment', '70% Advance + 30% Before Dispatch (Custom Tooling)', 
 '70% advance payment along with Purchase Order, and balance 30% against Proforma Invoice prior to dispatch. Payment by RTGS / NEFT in favour of Starmould Technology Pvt. Ltd.',
 '70% advance payment along with Purchase Order, and balance 30% against Proforma Invoice prior to dispatch. Payment by RTGS / NEFT in favour of Starmould Technology Pvt. Ltd.',
 false, NOW()),

('payment', '100% Advance Against Proforma Invoice', 
 '100% advance payment against Proforma Invoice prior to dispatch. Payment by RTGS / NEFT in favour of Starmould Technology Pvt. Ltd.',
 '100% advance payment against Proforma Invoice prior to dispatch. Payment by RTGS / NEFT in favour of Starmould Technology Pvt. Ltd.',
 false, NOW()),

('payment', '30% Advance + 70% Within 15 Days (Approved Accounts)', 
 '30% advance with Purchase Order, balance 70% within 15 days of dispatch / delivery. Subject to credit pre-approval.',
 '30% advance with Purchase Order, balance 70% within 15 days of dispatch / delivery. Subject to credit pre-approval.',
 false, NOW()),

('payment', '30 Days Net Credit (Corporate Accounts)', 
 '100% payment within 30 days from invoice date via RTGS / NEFT. Late payments shall attract interest @ 18% per annum.',
 '100% payment within 30 days from invoice date via RTGS / NEFT. Late payments shall attract interest @ 18% per annum.',
 false, NOW());

-- 4. VALIDITY PRESETS
INSERT INTO public.quotation_terms_presets (term_type, title, content, validity_terms, is_default, updated_at) VALUES
('validity', '15 Days from Issue Date (Official)', 
 'This quotation is valid for 15 days from the date of issue. Prices and delivery schedules are subject to review and confirmation thereafter.',
 'This quotation is valid for 15 days from the date of issue. Prices and delivery schedules are subject to review and confirmation thereafter.',
 true, NOW()),

('validity', '30 Days from Issue Date (Project Validity)', 
 'This quotation remains valid for 30 calendar days from the date of issue, after which rates and lead times may be revised.',
 'This quotation remains valid for 30 calendar days from the date of issue, after which rates and lead times may be revised.',
 false, NOW()),

('validity', '7 Days (Volatile Material Rates)', 
 'This quotation is valid for 7 days only due to fluctuations in raw material costs. Orders placed after this period require price revalidation.',
 'This quotation is valid for 7 days only due to fluctuations in raw material costs. Orders placed after this period require price revalidation.',
 false, NOW());

-- 5. FORCE MAJEURE PRESETS
INSERT INTO public.quotation_terms_presets (term_type, title, content, force_majeure, is_default, updated_at) VALUES
('force_majeure', 'Standard Clause Applicable (Official)', 
 'This Clause Is Applicable.',
 'This Clause Is Applicable.',
 true, NOW()),

('force_majeure', 'Comprehensive Force Majeure Clause', 
 'Neither party shall be held responsible for delays or failure to perform obligations arising from acts of God, natural calamities, fire, flood, labor strikes, power grid failures, statutory regulations, pandemics, or unforeseen events beyond reasonable management control.',
 'Neither party shall be held responsible for delays or failure to perform obligations arising from acts of God, natural calamities, fire, flood, labor strikes, power grid failures, statutory regulations, pandemics, or unforeseen events beyond reasonable management control.',
 false, NOW()),

('force_majeure', 'Not Applicable / Excluded', 
 'Not Applicable.',
 'Not Applicable.',
 false, NOW());
