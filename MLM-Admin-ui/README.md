# MLM Admin UI (Next.js)

A Next.js 14 (App Router) frontend implementing an admin-style dashboard for the MLM system, with reusable UI components, Tailwind-based styling, and static-to-Next page conversions for multiple modules (TopUp, Renewal Request, Course Master).

## Tech Stack
- Next.js App Router (TypeScript-ready)
- React 18
- Tailwind CSS (utility-first)
- Component-scoped CSS only where needed

## Quick Start
1) Install dependencies
```
pnpm install
# or npm install
# or yarn
```
2) Run dev server
```
pnpm dev
# http://localhost:3002
```
3) Production build
```
pnpm build && pnpm start
```

## Project Structure (selected)
```
MLM-Admin-ui/
  src/
    app/
      layout.tsx
      page.tsx
      top-up/
        activation-request/page.tsx
        activation-history/page.tsx
        gateway-activation/page.tsx
      renewal-request/
        new-request/page.tsx
        request-history/page.tsx
      course-master/
        course-module/page.tsx
        course-vedios/page.tsx
    components/
      sidebar.tsx
      ui/
        Card.tsx
        DataTable.tsx
        FiltersBar.tsx
        Pagination.tsx
        ActionButtons.tsx
        StatusBadge.tsx
```

## Reusable UI Components
- **Card**: `title?`, `toolbarRight?` (use with `ToolbarButton`)
- **DataTable<Row>**: `columns`, `rows`, `renderActions?`, `actionsHeader?`, `minWidthPx?` (sticky header, horizontal scroll)
- **FiltersBar**: layout container with `SearchInput`, `TextInput`, `PrimaryButton`, `SecondaryButton`
- **Pagination**: `page`, `pageSize`, `total`, `onPageChange`, `onPageSizeChange?`, `pageSizeOptions?`
- **ActionButtons**: `ApproveReject`, `ViewButton`, `EditButton`, `DeleteButton` (rounded-square outline, icon/outline same family, filled on hover)
- **StatusBadge**: simple status chip (`active | expired | rejected | pending`)

## Styling
- Prefer Tailwind utilities
- Keep look consistent with shared components (cards, tables, buttons)

## Pages Ported from Static HTML
- TopUp: Activation Request, Activation History, Gateway Activation
- Renewal Request: New Request, Request History
- Course Master: Course Module, Course Videos

## Routing
- Sidebar links map to `src/app` routes (lowercase paths)

## Conventions
- Components: `src/components/ui/*` (generic) and `src/components/*` (global)
- Pages compose shared components; keep page logic thin
- Use `"use client"` only when needed (hooks, styled-jsx)

## Dev Tips
- New table page: define `Row`, create `columns`, provide `rows`, add optional filters + pagination
- Reuse icons from `ActionButtons.tsx` for consistency

## Linting & Troubleshooting
- Lints should be clean; fix TypeScript warnings promptly
- If styled-jsx is used, ensure the page is a Client Component (`"use client"`)
- Verify sidebar link casing matches route folders

## License
Proprietary – internal project use only
