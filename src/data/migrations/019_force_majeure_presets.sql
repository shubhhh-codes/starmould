-- Migration 019: Seed Force Majeure presets & ensure modular categories

INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default) VALUES
('force_majeure', 'Standard Clause Applicable', 'This Clause Is Applicable.', true),
('force_majeure', 'Comprehensive Force Majeure', 'Neither party shall be liable for delay or failure to perform obligations due to acts of God, strikes, fire, power outages, pandemic, government restrictions or circumstances beyond reasonable control.', false),
('force_majeure', 'Non-Applicable / Excluded', 'Not Applicable.', false);

-- Ensure 70% advance payment preset exists as requested by user
INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default)
SELECT 'payment', '70% Advance + 30% Before Dispatch', '[70% advance along with Purchase Order, balance 30% before dispatch / within __ days of invoice]. Payment by NEFT / RTGS / cheque in favour of Starmould Technology Pvt. Ltd.', false
WHERE NOT EXISTS (
  SELECT 1 FROM public.quotation_terms_presets 
  WHERE term_type = 'payment' AND title = '70% Advance + 30% Before Dispatch'
);
