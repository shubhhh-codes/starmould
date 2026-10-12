# Star Mould ERP — Precision Tooling & Manufacturing

Cloud-native enterprise resource planning system for high-precision mould manufacturing, workpiece progression, scanning, printing, and procurement.

---

## 🛠️ Technology Stack
- **Framework:** Next.js 16 (App Router with Turbopack & React 19)
- **Database & Auth:** Supabase (PostgreSQL with Row Level Security & Storage)
- **State & Data Fetching:** TanStack React Query v5 & Lightweight Reactive External Store
- **UI & Motion:** Tailwind CSS v4, Lucide Icons, Custom Reusable UI Components
- **TypeScript:** Strict type-checking with end-to-end type safety

---

## 📂 Repository Structure
```
starmould/
├── src/
│   ├── app/                    # Next.js App Router (UI routes & REST API route handlers)
│   ├── components/             # Reusable UI & Layout Components
│   │   ├── dashboard/          # Production Pipeline & Mould Register tables
│   │   ├── layout/             # Sidebar, Topbar, App Shell
│   │   ├── providers/          # Query, Auth, Permissions, Error Listeners
│   │   └── ui/                 # Atomic design components (Combobox, ContextMenu, Modal, Toast)
│   ├── data/
│   │   └── migrations/         # Direct runtime migration scripts
│   └── lib/
│       ├── api/                # Modular client & unified response handlers
│       ├── config/             # Type-safe runtime environment validation
│       ├── permissions/        # RBAC role access control rules
│       ├── query/              # TanStack Query keys, hooks & prefetch strategies
│       ├── state/              # Centralized reactive store (Toasts, Navigation)
│       └── supabase/           # Client & Admin database connectors
├── public/                     # Static assets, branding logos, SVG icons
├── scripts/                    # Database migration & automated regression test scripts
├── supabase/                   # Supabase database schema migrations
├── docs/                       # Project documentation, handoffs, and audit reports
├── .env.example                # Template of required environment variables
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Project dependencies & scripts
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20 or higher
- **npm**: v10 or higher
- **Supabase Project**: Managed or local Supabase instance

### 2. Environment Setup
Copy the example environment configuration file to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in the values in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET` (Minimum 32 characters HMAC secret)
- `DATABASE_URL` (Direct postgres connection string for migrations)

### 3. Install Dependencies
```bash
npm ci
```

### 4. Running Database Migrations
To execute the schema updates and database setup:
```bash
node scripts/run-migrations.mjs
```

### 5. Development Server
Run the local Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Production Build & Quality Checks
```bash
npm run lint         # Check code quality and style
npx tsc --noEmit     # Strict TypeScript typechecking
npm run build        # Build production bundle
npm run start        # Start production server
```

---

## ☁️ Deployment Note (Vercel)
> [!IMPORTANT]
> Since the Next.js application has been moved to the root of the repository, ensure your **Vercel Project Settings > General > Root Directory** is set to `.` (root directory) rather than `frontend`.
