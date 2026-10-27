-- Seed roles table to ensure foreign key constraint public.users(role_id) REFERENCES public.roles(id) is satisfied
INSERT INTO public.roles (id, name, display_name, description) VALUES
(0, 'admin', 'Admin', 'Full administrative access across all modules and financial settings'),
(1, 'manager', 'Manager', 'Procurement, movement documents, dispatch, and reports access'),
(2, 'supervisor', 'Supervisor', 'Floor and workshop supervision, worklog, and QC approval'),
(3, 'designer', 'Designer', 'CAD/CAM design, plate programming, and scan assignments'),
(4, 'worker', 'Worker', 'Machine operator, workpiece progression, and personal worklog tracking'),
(5, 'purchase_incharge', 'Purchase Incharge', 'Raw material procurement, supplier orders, purchase inwards, and inventory receiving'),
(6, 'vmc', 'VMC Department', 'Machining floor, VMC work order execution, tool offsets, and program loading'),
(7, 'qc', 'Quality Checking (QC)', 'Inward inspection, in-process VMC dimension checks, and final dispatch QC sign-offs'),
(8, 'other', 'Other', 'General staff role'),
(9, 'dispatch', 'Dispatch', 'Delivery challans, transport vehicle coordination, client packaging, and gate passes'),
(10, 'programmer', 'Programmer', 'CAD/CAM NC programming, machining path generation, and cutting tool parameters')
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, 
    display_name = EXCLUDED.display_name, 
    description = EXCLUDED.description;

-- Reset sequence to ensure future insertions start properly
SELECT setval('roles_id_seq', GREATEST((SELECT MAX(id) FROM public.roles), 1));
