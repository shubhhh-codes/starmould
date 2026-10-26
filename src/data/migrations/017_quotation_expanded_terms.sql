-- Migration 017: Expanded Terms (Order Confirmation, Warranty, Jurisdiction)

ALTER TABLE public.quotation_terms_presets
ADD COLUMN IF NOT EXISTS order_confirmation TEXT DEFAULT 'Manufacturing starts only after receipt of advance payment and a written Purchase Order.',
ADD COLUMN IF NOT EXISTS warranty_terms TEXT DEFAULT '[__ months] against manufacturing defects only; excludes misuse, mishandling, overloading or external damage.',
ADD COLUMN IF NOT EXISTS jurisdiction_terms TEXT DEFAULT 'Subject to Rajkot, Gujarat jurisdiction only.';

ALTER TABLE public.quotations
ADD COLUMN IF NOT EXISTS order_confirmation TEXT DEFAULT 'Manufacturing starts only after receipt of advance payment and a written Purchase Order.',
ADD COLUMN IF NOT EXISTS warranty_terms TEXT DEFAULT '[__ months] against manufacturing defects only; excludes misuse, mishandling, overloading or external damage.',
ADD COLUMN IF NOT EXISTS jurisdiction_terms TEXT DEFAULT 'Subject to Rajkot, Gujarat jurisdiction only.';

-- Insert the Official StarMould Preset matching customer requirements
INSERT INTO public.quotation_terms_presets (
    title,
    price_terms,
    delivery_terms,
    payment_terms,
    validity_terms,
    order_confirmation,
    warranty_terms,
    jurisdiction_terms,
    force_majeure,
    is_default
)
VALUES (
    'Official StarMould Standard Preset',
    'Prices are in Indian Rupees (₹), firm and fixed, Ex-Works Rajkot. GST @ [18]% extra as applicable. Freight and transit insurance [extra at actuals / included].',
    '[__] days from receipt of a clear Purchase Order together with the advance payment; subject to material availability and production capacity.',
    '[50% advance along with Purchase Order, balance 50% before dispatch / within __ days of invoice]. Payment by NEFT / RTGS / cheque in favour of Starmould Technology Pvt. Ltd.',
    'This quotation is valid for [15] days from the date of issue. Prices and delivery are subject to change thereafter.',
    'Manufacturing starts only after receipt of advance payment and a written Purchase Order.',
    '[__ months] against manufacturing defects only; excludes misuse, mishandling, overloading or external damage.',
    'Subject to Rajkot, Gujarat jurisdiction only.',
    'This Clause Is Applicable.',
    true
)
ON CONFLICT DO NOTHING;
