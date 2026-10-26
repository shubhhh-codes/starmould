<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project UI & Document Viewer Rules

## 1. Document / Voucher / PDF Canvas Scrolling & Zoom Standards
- **Normal Mouse Wheel**: Must ALWAYS scroll / pan naturally through the document vertically (or horizontally with Shift). **NEVER** bind mouse wheel directly to zoom without modifier keys.
- **Zoom In / Out**: Zoom via mouse wheel must **ONLY** occur when `Ctrl` (or `Cmd` on macOS) is held down (`e.ctrlKey || e.metaKey`), or via trackpad pinch-to-zoom.
- **Bounded Drag & Scroll Clamping**:
  - Documents that fit inside the container (e.g. single-page Purchase Orders) must stay horizontally centered and bounded vertically.
  - Multi-page documents (e.g. 5-page Quotations) must stop scrolling at the top margin (`y = 20px`) and stop at the bottom margin (`y = containerHeight - docHeight - 40px`). Documents must **NEVER** fly off-screen into an empty grey void.
- **Applies Uniformly**: Both Purchase Orders (`/print/purchase/*`) and Quotations (`/print/quotation/*`) share this exact virtual viewport interaction standard.

