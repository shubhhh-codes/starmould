# Star Mould ERP — Precision Manufacturing & Job-Shop System

Next-generation Manufacturing Execution System (MES) & ERP for Star Mould, migrated from legacy Laravel PHP to a modern Next.js 16 (Turbopack, TypeScript, Tailwind CSS) + Supabase (PostgreSQL) cloud stack.

> [!NOTE]
> Legacy PHP reference for migrated (Category A) modules is in `_archive/legacy-php/`.
> Files for not-yet-migrated features remain in their original locations — see [`MIGRATION_STATUS.md`](./MIGRATION_STATUS.md) for what's still pending.

---

## Project Structure

```
├── frontend/                # Next.js 16 App Router application
│   ├── src/
│   │   ├── app/             # Application routes & API handlers
│   │   ├── components/      # UI components, layout, and tables
│   │   └── lib/             # Supabase client, auth helpers, types
├── supabase/                # PostgreSQL schema & migration files
│   └── migrations/          # 001_init.sql through 006_subplate_stage_timestamps.sql
├── _archive/
│   └── legacy-php/          # Archived Category A legacy PHP controllers, models, views
├── MIGRATION_STATUS.md      # Comprehensive audit & migration status matrix
└── README.md
```

## Running the Application

```bash
cd frontend
npm install
npm run dev
```

For production builds:
```bash
cd frontend
npm run build
```
