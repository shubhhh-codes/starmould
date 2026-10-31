-- Seed core system accounts: Super Admin, Akshay (Admin), and Designer
INSERT INTO public.users (id, name, email, role_id, status, username, initials, usertype, usersubtype, password_hash, must_change_password) VALUES
  (1, 'Super Admin', 'admin@star.in', 0, 1, 'admin', 'ADM', 'Admin', 'Skilled MP', '$2y$10$S0OedclCp5Au1TYDwbDQJOBfMo.wsxIl2BPMCGM/000/7drfdI78W', false),
  (2, 'Akshay', 'akshay@star.in', 0, 1, 'Akshay', 'AKS', 'Admin', 'Skilled MP', '$2y$10$S0OedclCp5Au1TYDwbDQJOBfMo.wsxIl2BPMCGM/000/7drfdI78W', false),
  (26, 'designer', 'designer@test.com', 3, 1, 'designer', 'DESIG', 'Designer', 'Skilled MP', '$2y$10$S0OedclCp5Au1TYDwbDQJOBfMo.wsxIl2BPMCGM/000/7drfdI78W', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role_id = EXCLUDED.role_id,
  status = EXCLUDED.status,
  username = EXCLUDED.username,
  initials = EXCLUDED.initials,
  usertype = EXCLUDED.usertype,
  usersubtype = EXCLUDED.usersubtype,
  password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
  must_change_password = EXCLUDED.must_change_password;

SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM public.users), 30));
