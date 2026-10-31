-- Seed authentic staff users from 002_data.sql so user assignments resolve correctly across all views
INSERT INTO public.users (id, name, email, role_id, status, username, initials, usertype, usersubtype, password_hash, must_change_password) VALUES
  (1, 'Super Admin', 'admin@star.in', 0, 1, 'admin', 'ADM', 'Admin', 'Skilled MP', '$2a$10$tZ2c6rK6z7B3gKz0fM5x8edclCp5Au1TYDwbDQJOBfMo.wsxIl2BP', false),
  (2, 'Akshay', 'akshay@star.in', 0, 1, 'Akshay', 'AKS', 'Admin', 'Skilled MP', '$2y$10$S0OedclCp5Au1TYDwbDQJOBfMo.wsxIl2BPMCGM/000/7drfdI78W', false),
  (3, 'Shivani', 'shivaniparmar559@gmail.com', 0, 1, 'shivani', 'SHP', 'Admin', 'Skilled MP', '$2y$10$aLTKAQN600Zi7UEPUFEN2OIqfJXxH6sJ4MBdAzv41sLN9G9LgktFu', false),
  (4, 'Bhagirath', 'bhagirath@star.in', 1, 1, 'BHAGIRATH', 'BGR', 'Manager', 'Skilled MP', '$2y$10$SyzjOCLz.GcZxfJg0ROhsOKdZjqpnRZOvyC6YbBShJvMzj.bGgrye', false),
  (5, 'Yash Moliya', 'yash@star.in', 0, 1, 'Yash', 'YAM', 'Admin', 'Skilled MP', '$2y$10$BggI.BN4dm1eBCEWBAiOdeZ9KBr4Q038lXzAQ8LWexXw9IDNuTtfa', false),
  (6, 'Prince Sojitra', 'prince@star.in', 4, 1, 'Prince', 'PRN', 'User', 'Skilled MP', '$2y$10$fHm9hVT9r7BPx7j6tm/9Wud5RabuyFYEF9G0uP4cdFeaELw7b3/b.', false),
  (7, 'Sagar Dangariya', 'sagar@star.in', 2, 1, 'Sagar', 'SGR', 'Supervisor', 'Skilled MP', '$2y$10$kMrgXOetnY02mYEo6zCP/uvsO5G.1Um/2As0ZaZ9ojKlxLCoMV/ai', false),
  (8, 'Satish Jesadiya', 'satish@star.in', 4, 1, 'Satish', 'STS', 'User', 'Skilled MP', '$2y$10$.RY9oC2nxOy2yF5TbfHU..OC/vcV88GiNRInA1wKnLtCBhJXaZV.u', false),
  (9, 'Divyesh Limbasiya', 'divyesh@star.in', 3, 1, 'Divyesh', 'DVS', 'Designer', 'Skilled MP', '$2y$10$nKPnUGrbw5AMKlWQDTwRN.hBTRyYWMASdeSduhHxoiVv7SDLeS/Su', false),
  (10, 'Hardik Jalu', 'hardik@star.in', 3, 1, 'Hardik', 'HRD', 'Designer', 'Skilled MP', '$2y$10$YfABn8cpoIeTmSFMhYUD3uij0.tUfBKQu4.9WYjN9r.qCx161WPjG', false),
  (11, 'Herika', 'herika@star.in', 4, 1, 'Herika', 'HR', 'User', 'Skilled MP', '$2y$10$RZTwmLPK.tAgWnROHfUG1uXWeOPU3OI4bMmm/WVLlCy2jN98MWPRS', false),
  (13, 'CMO_1270_1', 'cmo.1270_1@star.in', 4, 1, 'CMO_1270_1', 'CM1', 'User', 'Machine', '$2y$10$TNmC8SLwa2uLeiaKJ939z.jkWTOAAaC53qCbVhGXpDzG5qX8KOxwu', false),
  (14, 'Kmill-10', 'kmill10@star.in', 4, 1, 'kmill', 'KML', 'User', 'Machine', '$2y$10$UfCldY95FZcYn4Fpig5nHu3RVMgiYmzBF4nffaTvcn.qoUoeD8stO', false),
  (15, 'Mackino', 'Makino@star.in', 4, 1, 'makino', 'MKN', 'User', 'Machine', '$2y$10$J8dUrrMDAJ22GCuYJ0y6vOaCsIUf/PW/ScLpMqcXoGPwYGHV.pOU2', false),
  (16, 'awea', 'awea@star.in', 4, 1, 'Awea', 'AWA', 'User', 'Machine', '$2y$10$na1BKWcLany.6c/fw1X/0.88.q/1D2Hh2hUGHB8MjX7VlDH96KjNK', false),
  (17, 'mighty', 'mighty@star.in', 4, 1, 'Mighty', 'MGT', 'User', 'Machine', '$2y$10$uKtoKbZnxpWj0IlhqCOgy.T8Z.NhtgDUO9ft/RdFXD5cKjQlr5O.O', false),
  (18, 'Globle', 'globle@star.in', 4, 1, 'Globle', 'GLB', 'User', 'Machine', '$2y$10$k1gpiT6g7pR2TyuF6SX4rulfut1v6/DC6mBY8ETdS5VsnYRmqTb1u', false),
  (19, 'sahil Dhaduk', 'sahil@star.in', 2, 1, 'sahil', 'SHL', 'Supervisor', 'Skilled MP', '$2y$10$McPaXL./IoY4saqM9MtsDuaNWpnSOf7aVcpo1tUEeX1TWEquHIpsy', false),
  (20, 'amit busha', 'amit@star.in', 2, 1, 'amit', 'AMT', 'Supervisor', 'Skilled MP', '$2y$10$Tbdt70au2TF9dJKGTYOdAecXoMCKIeiDGiTFU.0uXFO0Z3PPBox82', false),
  (21, 'CVM_1160_1', 'cvm.1160_1@star.in', 4, 1, 'CVM_1160_1', 'CV1', 'User', 'Machine', '$2y$10$v9.VXmFpNER6CaOjg3V40.fyoTj72Riia3pZ31sJfHLR9Dwn9REma', false),
  (22, 'CMO_1270_2', 'cmo.1270_2@star.in', 4, 1, 'CMO_1270_2', 'CM2', 'User', 'Machine', '$2y$10$nWfhhSylARYSis7/8i26deioVMoxzU/Wf5EqplbMvdbJCTmkwjkvq', false),
  (23, 'CVM_1160_2', 'cvm.1160_2@star.in', 4, 1, 'CVM_1160_2', 'CV2', 'User', 'Machine', '$2y$10$B4SAG5vS8OhcON2V9GPDY.VrD2H/bQgJzhoRgBvlaJpqfIroDrDzu', false),
  (24, 'VIVEK KUMAR', 'vivek@star.in', 4, 1, 'Vivek Kumar', 'VVK', 'User', 'Skilled MP', '$2y$10$1DRn728GAZjxZw.gt8n.UurnkZIps4WdrRj/41m2AY3M7rTH0oO7S', false),
  (25, 'DEVANG', 'devang@star.in', 4, 1, 'DEVANG', 'DVG', 'User', 'Skilled MP', '$2y$10$I0XhNXpM5WGHi5Kx6f1of.I5sa1sdg48R.4R6uMbWWc4CkX7pAswa', false)
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

SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM public.users), 25));
