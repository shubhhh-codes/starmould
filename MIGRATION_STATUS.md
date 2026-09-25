# Star Mould ERP — Migration Status & Legacy Inventory Audit

Generated: 2026-09-25

### Summary of Legacy Inventory vs New Next.js / Supabase Stack
- **Category A (Fully Migrated & Verified)**: 157 files (Archived to _archive/legacy-php/)
- **Category B (Migrated but Pending Click-Through QA)**: 12 files (Retained in active location for QA reference)
- **Category C (Not Yet Migrated / Out-of-Scope Gaps)**: 6 files (Retained in active location as backlog)

| File | Category | Notes |
| :--- | :---: | :--- |
| app/Console/Kernel.php | **A** | Migrated core framework artifact |
| app/Exceptions/Handler.php | **A** | Migrated core framework artifact |
| app/Exports/ExportDispatchChallan.php | **A** | Migrated to frontend/src/app/export & /api/export (Verified) |
| app/Exports/ExportMould.php | **A** | Migrated to frontend/src/app/export & /api/export (Verified) |
| app/Exports/ExportMouldreg.php | **A** | Migrated to frontend/src/app/export & /api/export (Verified) |
| app/Exports/ExportOutward.php | **A** | Migrated to frontend/src/app/export & /api/export (Verified) |
| app/Exports/ExportPendingoutward.php | **A** | Migrated to frontend/src/app/export & /api/export (Verified) |
| app/Exports/ExportPurchase.php | **A** | Migrated to frontend/src/app/export & /api/export (Verified) |
| app/Exports/ExportPurchaserec.php | **A** | Migrated to frontend/src/app/export & /api/export (Verified) |
| app/Http/Controllers/Auth/ConfirmPasswordController.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| app/Http/Controllers/Auth/ForgotPasswordController.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| app/Http/Controllers/Auth/LoginController.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| app/Http/Controllers/Auth/RegisterController.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| app/Http/Controllers/Auth/ResetPasswordController.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| app/Http/Controllers/Auth/VerificationController.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| app/Http/Controllers/ChallanController.php | **A** | Migrated to frontend/src/app/challan & /api/challan (Verified) |
| app/Http/Controllers/Controller.php | **A** | Migrated core framework artifact |
| app/Http/Controllers/CustomerController.php | **A** | Migrated to frontend/src/app/customer & /api/customers (Verified) |
| app/Http/Controllers/ExpenseController.php | **A** | Migrated to frontend/src/app/expense & /api/expense (Verified) |
| app/Http/Controllers/ExportController.php | **A** | Migrated to frontend/src/app/export & /api/export (Verified) |
| app/Http/Controllers/GramController.php | **A** | Migrated to frontend/src/app/gram & /api/gram (Verified) |
| app/Http/Controllers/HomeController.php | **A** | Migrated to frontend/src/app/page.tsx (Dashboard & pipeline stats, Verified) |
| app/Http/Controllers/PrintAdminController.php | **A** | Migrated to frontend/src/app/printing & /api/printing (Merged PrintAdmin, Verified) |
| app/Http/Controllers/PrintingController.php | **A** | Migrated to frontend/src/app/printing & /api/printing (Merged PrintAdmin, Verified) |
| app/Http/Controllers/PurchaseController.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| app/Http/Controllers/PurchaseInwardController.php | **A** | Migrated to frontend/src/app/purchase-inward & /api/purchase-inward (Verified) |
| app/Http/Controllers/ReportController.php | **A** | Migrated to frontend/src/app/report & /api/report (Verified) |
| app/Http/Controllers/SampleController.php | **A** | Migrated to frontend/src/app/sample & /api/sample (Verified) |
| app/Http/Controllers/ScanAdminController.php | **A** | Migrated to frontend/src/app/scanning & /api/scanning (Merged ScanAdmin, Verified) |
| app/Http/Controllers/ScanningController.php | **A** | Migrated to frontend/src/app/scanning & /api/scanning (Merged ScanAdmin, Verified) |
| app/Http/Controllers/SubplateController.php | **A** | Migrated to frontend/src/app/subplate & /api/subplate (Verified 9-stage tracking) |
| app/Http/Controllers/UserController.php | **A** | Migrated to frontend/src/app/user & /api/users (Verified) |
| app/Http/Controllers/WorkController.php | **A** | Migrated to frontend/src/app/work & /api/worklog (Verified) |
| app/Http/Kernel.php | **A** | Migrated core framework artifact |
| app/Http/Middleware/Authenticate.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| app/Http/Middleware/EncryptCookies.php | **A** | Migrated core framework artifact |
| app/Http/Middleware/Localization.php | **A** | Migrated core framework artifact |
| app/Http/Middleware/PreventRequestsDuringMaintenance.php | **A** | Migrated core framework artifact |
| app/Http/Middleware/RedirectIfAuthenticated.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| app/Http/Middleware/TrimStrings.php | **A** | Migrated core framework artifact |
| app/Http/Middleware/TrustHosts.php | **A** | Migrated core framework artifact |
| app/Http/Middleware/TrustProxies.php | **A** | Migrated core framework artifact |
| app/Http/Middleware/VerifyCsrfToken.php | **A** | Migrated core framework artifact |
| app/Models/ChallanItemsModel.php | **A** | Migrated to frontend/src/app/challan & /api/challan (Verified) |
| app/Models/ChallanModel.php | **A** | Migrated to frontend/src/app/challan & /api/challan (Verified) |
| app/Models/ChallanViewModel.php | **A** | Migrated to frontend/src/app/challan & /api/challan (Verified) |
| app/Models/CustomerModel.php | **A** | Migrated to frontend/src/app/customer & /api/customers (Verified) |
| app/Models/ExpenseModel.php | **A** | Migrated to frontend/src/app/expense & /api/expense (Verified) |
| app/Models/GramModel.php | **A** | Migrated to frontend/src/app/gram & /api/gram (Verified) |
| app/Models/PrintingModel.php | **A** | Migrated to frontend/src/app/printing & /api/printing (Merged PrintAdmin, Verified) |
| app/Models/PurchaseInwardItemsModel.php | **A** | Migrated to frontend/src/app/purchase-inward & /api/purchase-inward (Verified) |
| app/Models/PurchaseInwardModel.php | **A** | Migrated to frontend/src/app/purchase-inward & /api/purchase-inward (Verified) |
| app/Models/PurchaseItemsModel.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| app/Models/PurchaseModel.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| app/Models/PurchaseViewModel.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| app/Models/ScanningModel.php | **A** | Migrated to frontend/src/app/scanning & /api/scanning (Merged ScanAdmin, Verified) |
| app/Models/SubplateModel.php | **A** | Migrated to frontend/src/app/subplate & /api/subplate (Verified 9-stage tracking) |
| app/Models/User.php | **A** | Migrated to frontend/src/app/user & /api/users (Verified) |
| app/Models/UserModel.php | **A** | Migrated to frontend/src/app/user & /api/users (Verified) |
| app/Models/ViewModel.php | **A** | Migrated core framework artifact |
| app/Models/ViewPurchaseModel.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| app/Models/WorkModel.php | **A** | Migrated to frontend/src/app/work & /api/worklog (Verified) |
| app/Providers/AppServiceProvider.php | **A** | Migrated core framework artifact |
| app/Providers/AuthServiceProvider.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| app/Providers/BroadcastServiceProvider.php | **A** | Migrated core framework artifact |
| app/Providers/EventServiceProvider.php | **A** | Migrated core framework artifact |
| app/Providers/RouteServiceProvider.php | **A** | Migrated core framework artifact |
| app/Rules/UppercaseUnique.php | **A** | Migrated core framework artifact |
| database/migrations/2014_10_12_000000_create_users_table.php | **A** | Schema fully migrated to supabase/migrations/001-006 (Verified) |
| database/migrations/2014_10_12_100000_create_password_resets_table.php | **A** | Schema fully migrated to supabase/migrations/001-006 (Verified) |
| database/migrations/2019_08_19_000000_create_failed_jobs_table.php | **A** | Schema fully migrated to supabase/migrations/001-006 (Verified) |
| database/migrations/2019_12_14_000001_create_personal_access_tokens_table.php | **A** | Schema fully migrated to supabase/migrations/001-006 (Verified) |
| database/migrations/2022_08_17_063750_create_scanning_models_table.php | **A** | Migrated to frontend/src/app/scanning & /api/scanning (Merged ScanAdmin, Verified) |
| database/migrations/2022_09_15_055333_create_gram_models_table.php | **A** | Schema fully migrated to supabase/migrations/001-006 (Verified) |
| database/migrations/2023_04_04_125400_create_expense_models_table.php | **A** | Schema fully migrated to supabase/migrations/001-006 (Verified) |
| database/migrations/2023_04_26_115137_create_subplate_models_table.php | **A** | Migrated to frontend/src/app/subplate & /api/subplate (Verified 9-stage tracking) |
| database/migrations/2023_05_27_113310_create_challan_models_table.php | **A** | Migrated to frontend/src/app/challan & /api/challan (Verified) |
| database/migrations/2023_07_06_122219_create_view_models_table.php | **A** | Schema fully migrated to supabase/migrations/001-006 (Verified) |
| database/migrations/2023_07_15_111230_create_challan_view_models_table.php | **A** | Migrated to frontend/src/app/challan & /api/challan (Verified) |
| database/migrations/2023_09_22_172254_create_purchase_models_table.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| database/migrations/2023_09_25_115251_create_purchase_items_models_table.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| database/migrations/2023_09_25_141421_create_purchase_view_models_table.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| database/migrations/2023_09_25_165733_create_view_purchase_models_table.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| database/migrations/2023_09_25_170533_create_purchase_inward_models_table.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| database/migrations/2023_09_25_170917_create_purchase_inward_items_models_table.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| resources/views/auth-confirm-mail-2.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth-confirm-mail.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth-email-verification-2.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth-email-verification.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth-lock-screen-2.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth-lock-screen.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth-login-2.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth-login.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth-recoverpw-2.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth-recoverpw.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth-register-2.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth-register.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth-two-step-verification-2.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth-two-step-verification.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth/login.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth/passwords/confirm.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth/passwords/email.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth/passwords/reset.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth/register.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth/verify.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth1/login.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth1/passwords/confirm.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth1/passwords/email.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth1/passwords/reset.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth1/register.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/auth1/verify.blade.php | **A** | Migrated to frontend/src/app/login & /api/auth/* with AuthProvider (Verified) |
| resources/views/challan/index.blade.php | **A** | Migrated to frontend/src/app/challan & /api/challan (Verified) |
| resources/views/challan/outwardlist.blade.php | **A** | Migrated to frontend/src/app/challan & /api/challan (Verified) |
| resources/views/challan/printlist.blade.php | **A** | Migrated to frontend/src/app/challan & /api/challan (Verified) |
| resources/views/challan/printlistimage.blade.php | **A** | Migrated to frontend/src/app/challan & /api/challan (Verified) |
| resources/views/components/breadcrumb.blade.php | **A** | Layouts migrated to frontend/src/components/layout (Sidebar, Topbar, AppLayout) |
| resources/views/customer/index.blade.php | **A** | Migrated to frontend/src/app/page.tsx (Dashboard & pipeline stats, Verified) |
| resources/views/errors/404.blade.php | **A** | Migrated core framework artifact |
| resources/views/expense/index.blade.php | **A** | Migrated to frontend/src/app/page.tsx (Dashboard & pipeline stats, Verified) |
| resources/views/gram/index.blade.php | **A** | Migrated to frontend/src/app/page.tsx (Dashboard & pipeline stats, Verified) |
| resources/views/index.blade.php | **A** | Migrated to frontend/src/app/page.tsx (Dashboard & pipeline stats, Verified) |
| resources/views/index1.blade.php | **A** | Migrated to frontend/src/app/page.tsx (Dashboard & pipeline stats, Verified) |
| resources/views/layouts-horizontal.blade.php | **A** | Layouts migrated to frontend/src/components/layout (Sidebar, Topbar, AppLayout) |
| resources/views/layouts/footer.blade.php | **A** | Layouts migrated to frontend/src/components/layout (Sidebar, Topbar, AppLayout) |
| resources/views/layouts/head-css.blade.php | **A** | Layouts migrated to frontend/src/components/layout (Sidebar, Topbar, AppLayout) |
| resources/views/layouts/horizontal.blade.php | **A** | Layouts migrated to frontend/src/components/layout (Sidebar, Topbar, AppLayout) |
| resources/views/layouts/master-layouts.blade.php | **A** | Layouts migrated to frontend/src/components/layout (Sidebar, Topbar, AppLayout) |
| resources/views/layouts/master-without-nav.blade.php | **A** | Layouts migrated to frontend/src/components/layout (Sidebar, Topbar, AppLayout) |
| resources/views/layouts/master.blade.php | **A** | Layouts migrated to frontend/src/components/layout (Sidebar, Topbar, AppLayout) |
| resources/views/layouts/right-sidebar.blade.php | **A** | Layouts migrated to frontend/src/components/layout (Sidebar, Topbar, AppLayout) |
| resources/views/layouts/sidebar.blade.php | **A** | Layouts migrated to frontend/src/components/layout (Sidebar, Topbar, AppLayout) |
| resources/views/layouts/topbar.blade.php | **A** | Layouts migrated to frontend/src/components/layout (Sidebar, Topbar, AppLayout) |
| resources/views/layouts/vendor-scripts.blade.php | **A** | Layouts migrated to frontend/src/components/layout (Sidebar, Topbar, AppLayout) |
| resources/views/printadmin/index.blade.php | **A** | Migrated to frontend/src/app/printing & /api/printing (Merged PrintAdmin, Verified) |
| resources/views/printing/index.blade.php | **A** | Migrated to frontend/src/app/printing & /api/printing (Merged PrintAdmin, Verified) |
| resources/views/printuser/index.blade.php | **A** | Migrated to frontend/src/app/printing & /api/printing (Merged PrintAdmin, Verified) |
| resources/views/purchase/index.blade.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| resources/views/purchase/pendingpurchaselist.blade.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| resources/views/purchase/printlist.blade.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| resources/views/purchase/purchaseitems.blade.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| resources/views/purchase/purchaselist.blade.php | **A** | Migrated to frontend/src/app/purchase & /api/purchases (Verified) |
| resources/views/report/index.blade.php | **A** | Migrated to frontend/src/app/page.tsx (Dashboard & pipeline stats, Verified) |
| resources/views/rework/index.blade.php | **A** | Migrated to frontend/src/app/sample & /api/sample (Verified) |
| resources/views/sample/index.blade.php | **A** | Migrated to frontend/src/app/page.tsx (Dashboard & pipeline stats, Verified) |
| resources/views/scanadmin/index.blade.php | **A** | Migrated to frontend/src/app/scanning & /api/scanning (Merged ScanAdmin, Verified) |
| resources/views/scanning/dashboarddata.blade.php | **A** | Migrated to frontend/src/app/scanning & /api/scanning (Merged ScanAdmin, Verified) |
| resources/views/scanning/edit.blade.php | **A** | Migrated to frontend/src/app/scanning & /api/scanning (Merged ScanAdmin, Verified) |
| resources/views/scanning/index.blade.php | **A** | Migrated to frontend/src/app/scanning & /api/scanning (Merged ScanAdmin, Verified) |
| resources/views/subplate/index.blade.php | **A** | Migrated to frontend/src/app/subplate & /api/subplate (Verified 9-stage tracking) |
| resources/views/user/index.blade.php | **A** | Migrated to frontend/src/app/page.tsx (Dashboard & pipeline stats, Verified) |
| resources/views/work/index.blade.php | **A** | Migrated to frontend/src/app/work & /api/worklog (Verified) |
| resources/views/work/pendingwork.blade.php | **A** | Migrated to frontend/src/app/work & /api/worklog (Verified) |
| resources/views/work/printlist.blade.php | **A** | Migrated to frontend/src/app/work & /api/worklog (Verified) |
| resources/views/work/workdata.blade.php | **A** | Migrated to frontend/src/app/work & /api/worklog (Verified) |
| routes/channels.php | **A** | All web routes migrated to Next.js App Router (Verified) |
| routes/console.php | **A** | All web routes migrated to Next.js App Router (Verified) |
| routes/web.php | **A** | All web routes migrated to Next.js App Router (Verified) |
| app/Http/Controllers/DispatchController.php | **B** | Structurally migrated to frontend/src/app/dispatch; needs manual click-through QA |
| app/Http/Controllers/InwardController.php | **B** | Structurally migrated to frontend/src/app/inward; needs manual click-through QA |
| app/Models/DispatchItemsModel.php | **B** | Structurally migrated to frontend/src/app/dispatch; needs manual click-through QA |
| app/Models/DispatchModel.php | **B** | Structurally migrated to frontend/src/app/dispatch; needs manual click-through QA |
| app/Models/DispatchViewModel.php | **B** | Structurally migrated to frontend/src/app/dispatch; needs manual click-through QA |
| app/Models/InwardItemsModel.php | **B** | Structurally migrated to frontend/src/app/inward; needs manual click-through QA |
| app/Models/InwardModel.php | **B** | Structurally migrated to frontend/src/app/inward; needs manual click-through QA |
| resources/views/dispatch/index.blade.php | **B** | Migrated but pending deep verification |
| resources/views/dispatch/printlist.blade.php | **B** | Migrated but pending deep verification |
| resources/views/dispatch/printlist.blade/printlist.blade.php | **B** | Migrated but pending deep verification |
| resources/views/inward/index.blade.php | **B** | Structurally migrated to frontend/src/app/inward; needs manual click-through QA |
| resources/views/inward/printlist.blade.php | **B** | Structurally migrated to frontend/src/app/inward; needs manual click-through QA |
| app/Http/Controllers/BackupController.php | **C** | Legacy mysqldump controller; automated in Supabase Postgres daily WAL backups |
| app/Http/Controllers/ExpenseController0.php | **C** | Dead/duplicate legacy controller file |
| app/Http/Controllers/PdfController.php | **C** | Generates 5 document types (Challan, Inward, Worklog, Dispatch, Purchase); Next.js print route exists in frontend/src/app/print/[type]/[id] and api/print-doc; full parity QA pending |
| resources/views/backup/index.blade.php | **C** | Legacy backup view |
| resources/views/shivani.blade.php | **C** | Legacy developer test view |
| routes/api.php | **C** | Legacy Laravel Sanctum mobile endpoints (out of scope for web MVP; retained for future mobile reference) |
