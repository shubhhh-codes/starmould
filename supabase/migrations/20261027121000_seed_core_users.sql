-- Seed authentic staff users from 002_data.sql so user assignments resolve correctly across all views
INSERT INTO public.users (id, name, email, role_id, status, username, initials, usertype, usersubtype) VALUES
  (1, 'Shivani', 'shivaniparmar559@gmail.com', 0, 1, 'shivani', 'SHP', 'Admin', 'Skilled MP'),
  (2, 'Akshay', 'akshay@star.in', 0, 1, 'Akshay', 'AKS', 'Admin', 'Skilled MP'),
  (4, 'Bhagirath', 'bhagirath@star.in', 1, 1, 'BHAGIRATH', 'BGR', 'Manager', 'Skilled MP'),
  (5, 'Yash Moliya', 'yash@star.in', 0, 1, 'Yash', 'YAM', 'Admin', 'Skilled MP'),
  (6, 'Prince Sojitra', 'prince@star.in', 4, 1, 'Prince', 'PRN', 'User', 'Skilled MP'),
  (7, 'Sagar Dangariya', 'sagar@star.in', 2, 1, 'Sagar', 'SGR', 'Supervisor', 'Skilled MP'),
  (8, 'Satish Jesadiya', 'satish@star.in', 4, 1, 'Satish', 'STS', 'User', 'Skilled MP'),
  (9, 'Divyesh Limbasiya', 'divyesh@star.in', 3, 1, 'Divyesh', 'DVS', 'Designer', 'Skilled MP'),
  (10, 'Hardik Jalu', 'hardik@star.in', 3, 1, 'Hardik', 'HRD', 'Designer', 'Skilled MP'),
  (11, 'Herika', 'herika@star.in', 4, 1, 'Herika', 'HR', 'User', 'Skilled MP'),
  (13, 'CMO_1270_1', 'cmo.1270_1@star.in', 4, 1, 'CMO_1270_1', 'CM1', 'User', 'Machine'),
  (14, 'Kmill-10', 'kmill10@star.in', 4, 1, 'kmill', 'KML', 'User', 'Machine'),
  (15, 'Mackino', 'Makino@star.in', 4, 1, 'makino', 'MKN', 'User', 'Machine'),
  (16, 'awea', 'awea@star.in', 4, 1, 'Awea', 'AWA', 'User', 'Machine'),
  (17, 'mighty', 'mighty@star.in', 4, 1, 'Mighty', 'MGT', 'User', 'Machine'),
  (18, 'Globle', 'globle@star.in', 4, 1, 'Globle', 'GLB', 'User', 'Machine'),
  (19, 'sahil Dhaduk', 'sahil@star.in', 2, 1, 'sahil', 'SHL', 'Supervisor', 'Skilled MP'),
  (20, 'amit busha', 'amit@star.in', 2, 1, 'amit', 'AMT', 'Supervisor', 'Skilled MP'),
  (21, 'CVM_1160_1', 'cvm.1160_1@star.in', 4, 1, 'CVM_1160_1', 'CV1', 'User', 'Machine'),
  (22, 'CMO_1270_2', 'cmo.1270_2@star.in', 4, 1, 'CMO_1270_2', 'CM2', 'User', 'Machine'),
  (23, 'CVM_1160_2', 'cvm.1160_2@star.in', 4, 1, 'CVM_1160_2', 'CV2', 'User', 'Machine'),
  (24, 'VIVEK KUMAR', 'vivek@star.in', 4, 1, 'Vivek Kumar', 'VVK', 'User', 'Skilled MP'),
  (25, 'DEVANG', 'devang@star.in', 4, 1, 'DEVANG', 'DVG', 'User', 'Skilled MP')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role_id = EXCLUDED.role_id,
  status = EXCLUDED.status,
  username = EXCLUDED.username,
  initials = EXCLUDED.initials,
  usertype = EXCLUDED.usertype,
  usersubtype = EXCLUDED.usersubtype;

SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM public.users), 25));
