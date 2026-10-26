-- Migration 018: Modular Category-wise Terms Presets

ALTER TABLE public.quotation_terms_presets
ADD COLUMN IF NOT EXISTS term_type VARCHAR(50) DEFAULT 'price',
ADD COLUMN IF NOT EXISTS content TEXT;

-- Clear previous test presets so we have clean, pristine data
DELETE FROM public.quotation_terms_presets;

-- 1. Price & GST Presets
INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default) VALUES
('price', 'Ex-Works Rajkot + 18% GST (Official)', 'Prices are in Indian Rupees (₹), firm and fixed, Ex-Works Rajkot. GST @ [18]% extra as applicable. Freight and transit insurance [extra at actuals / included].', true),
('price', 'Standard Ex-Works (Freight at actuals)', 'Ex-Works Rajkot, +18% GST Freight ,Transit Insurance At Actual.', false),
('price', 'Freight & Packing Included (Destination)', 'Prices are in Indian Rupees (₹), inclusive of standard packaging and freight up to destination. GST @ 18% extra as applicable.', false);

-- 2. Delivery Terms Presets
INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default) VALUES
('delivery', 'Standard PO & Advance Lead Time (Official)', '[__] days from receipt of a clear Purchase Order together with the advance payment; subject to material availability and production capacity.', true),
('delivery', 'Immediate / Ready Stock (1-2 Days)', 'Ready stock dispatch within 1-2 working days upon order confirmation & advance payment.', false),
('delivery', 'Standard Spares / Mesh (3-5 Days)', '3 to 5 working days from order confirmation & payment.', false),
('delivery', 'Tooling Fabrication (3-4 Weeks)', '3 to 4 Weeks from final 3D drawing approval & advance payment.', false),
('delivery', 'Complete Mould Set (5-6 Weeks)', '5 to 6 Weeks from drawing approval & advance payment receipt.', false);

-- 3. Payment Terms Presets
INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default) VALUES
('payment', '50% Advance + 50% Before Dispatch (Official)', '[50% advance along with Purchase Order, balance 50% before dispatch / within __ days of invoice]. Payment by NEFT / RTGS / cheque in favour of Starmould Technology Pvt. Ltd.', true),
('payment', '100% Advance Payment', '100% advance payment before dispatch of goods.', false),
('payment', '30% Advance + 70% Before Dispatch', '30% advance along with Purchase Order, balance 70% against proforma invoice prior to dispatch.', false),
('payment', 'Against Delivery / CAD', 'Payment 100% against delivery / document handover.', false);

-- 4. Validity Terms Presets
INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default) VALUES
('validity', '15 Days (Official)', 'This quotation is valid for [15] days from the date of issue. Prices and delivery are subject to change thereafter.', true),
('validity', '10 Days', '10 DAYS from the date of quotation.', false),
('validity', '30 Days', 'This quotation is valid for 30 days from the date of issue.', false);
