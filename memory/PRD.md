# CashierPro (by R I Billing Pro) - Supermarket POS + Online Store

## Problem Statement
Full-stack retail platform combining an in-store POS (with Milestone Y50 Bluetooth thermal printer support) and an online shop with wishlist, cart, checkout (COD / UPI QR), order tracking, and admin fulfillment. Two roles: **admin** (owner) and **user** (customer).

## User Choices (locked)
- Backend: FastAPI + MongoDB (managed)
- Auth: JWT email/password (Bearer in localStorage)
- Admin credentials: `smallbiz743@gmail.com` / `Admin@123`
- Payment for online: **Simulated QR + COD** (no real gateway)
- Thermal print: Real Web Bluetooth ESC/POS for Milestone Y50 (Chrome/Edge desktop) with print-to-PDF fallback
- Charts: **Recharts**
- Theme: **White liquid-glass UI** with indigo→violet accents
- Branding: **"Built by R I Billing Pro"** in footer everywhere + inside every printed receipt

## Architecture
- **Backend** (`/app/backend/server.py`)
  - Collections: `users`, `products`, `orders`, `wishlist`
  - Auth: `/api/auth/{register,login,me,profile}` with bcrypt + JWT (7-day access)
  - Products: `/api/products` (list/create/update/delete + `/barcode/{code}` + `/import` CSV)
  - Orders: `/api/orders` (channel = POS or ONLINE; POS→CONFIRMED/PAID, ONLINE+COD→PENDING/UNPAID, ONLINE+UPI→PENDING/PAID) + `PATCH /{id}/status` (admin)
  - Wishlist: `/api/wishlist` CRUD
  - Stats: `/api/stats/{summary,report}` (report has 24-hour today/yesterday buckets + top 5 products)
  - Startup: seeds 87 products + admin user idempotently
- **Frontend** (`/app/frontend/src/`)
  - `Landing → /login /register`
  - **User routes** (`UserShell`): `/shop /wishlist /cart /checkout /orders /account`
  - **Admin routes** (`AdminShell`): `/admin/pos /admin/orders /admin/reports /admin/inventory`
  - Contexts: `AuthProvider` (JWT), `CartProvider` (localStorage)
  - Bluetooth: `lib/bluetooth.js` speaks ESC/POS to Milestone Y50 (58mm) over Web Bluetooth GATT
  - Theme: `index.css` sets liquid-glass backgrounds (radial gradients + backdrop-blur cards)

## Implemented (2026-02, iteration 2)
- Custom JWT auth (admin + public user), signup form, protected routes
- Public storefront: browse, wishlist, cart, checkout with UPI QR / COD
- User: My Orders with 4-step visual tracker (PENDING → CONFIRMED → SHIPPED → DELIVERED), Account editor
- Admin: Orders board with status/payment update buttons, cancel, live filters
- Sales Reports with Recharts line chart (Today vs Yesterday) + Top 5 sellers + delta%
- Inventory CSV import + template download + create/edit/delete
- POS retained: barcode scan input, category filter, cart, discount, tax, cash-change, UPI/Card, customer info
- Real Web Bluetooth ESC/POS print to Milestone Y50 (Chrome/Edge desktop) + browser print fallback
- White liquid-glass theme (indigo/violet accents, blurred glass cards, radial gradient background, subtle floating orbs)
- "Built by R I Billing Pro" footer everywhere + printed on receipt (screen + thermal ESC/POS)

## Implemented (2026-09, iteration 3)
- Rebranded POS to **GS** with custom glossy **GS logo** (SVG gradient tile) across Landing, Login, Register, User & Admin shells
- Receipt header now prints "GS SUPERMARKET" (screen + thermal ESC/POS)
- Admin **Settings** page (`/admin/settings`): payment gateway picker (Simulated / Stripe / Razorpay with key-readiness badges) + SMS toggle
- Backend `/api/settings` (GET public, PUT admin-only); Twilio SMS helper wired to order status changes (SHIPPED / DELIVERED / PAID / CANCELLED) with Indian +91 normalization and graceful skip when keys are missing
- `twilio==9.11.1` installed; requirements.txt refreshed

## Atlas Migration (blocked)
- User provided Atlas URI for cluster0.kbamsbe.mongodb.net (db: `cashierpro`)
- TLS handshake rejected (`tlsv1 alert internal error`) — pod egress IP **34.170.12.145** is NOT in Atlas Network Access allowlist
- Backend rolled back to local MongoDB (`test_database`) to keep app live
- Action: user must add `34.170.12.145/32` (or `0.0.0.0/0`) in Atlas → Security → Network Access, then say "done" and I'll flip MONGO_URL + migrate data

## Implemented (2026-10, iteration 4 — RBAC + dummy data)
- **3-tier RBAC** enforced end-to-end (backend `require_owner` / `require_staff` deps + frontend `ProtectedRoute` with `staffOnly` / `ownerOnly` / `customerOnly`)
  - **Owner**: full access — POS, Orders, Reports, Inventory, Settings, product CRUD, status/payment updates
  - **Cashier**: log in to admin console with POS-only sidebar; can scan barcodes, add to cart, create receipts; **403** on product create/update/delete, status update, reports, settings
  - **Public user (`user`)**: shop / cart / wishlist / checkout / own orders / account only; **403** on any admin API
- Legacy role `admin` auto-migrated to `owner` on startup (idempotent)
- Seeded default staff:
  - Owner: `smallbiz743@gmail.com / Admin@123`
  - Cashier: `cashier@gs.com / Cashier@123`
- **10 dummy records per menu** seeded idempotently:
  - 10 new products (barcodes `GS0001`–`GS0010`, incl. GS Premium Basmati, GS Organic Honey, Amul Butter/Paneer, Lays, Bingo, Real, Colgate, Dettol) — total ≈97
  - 10 customer accounts (Aarav, Priya, Rohan, Ananya, Kabir, Meera, Aditya, Isha, Vihaan, Diya — all `Demo@1234`)
  - 10 orders across statuses (PENDING/CONFIRMED/SHIPPED/DELIVERED × POS/ONLINE × CASH/UPI/CARD/COD)
  - 10 wishlist items (one per dummy customer)
- Admin shell: role-aware sidebar (POS-only for cashier), role badge in header (Owner=indigo, Cashier=emerald)
- Login page: shows all three credential paths (owner, cashier, customer signup)

## Backlog / Next
- P1: Real payment gateway (Stripe/Razorpay) toggle
- P1: Order confirmation email (Resend integration)
- P1: SMS notifications on status changes (Twilio)
- P2: Customer loyalty tier + auto-discount
- P2: Multi-outlet + per-cashier login logs
- P1: Complete Atlas switch once IP is whitelisted (add data copy from local Mongo)
- P1: Razorpay live checkout flow once RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are added
- P1: Twilio live SMS once keys are added (toggle already in Settings)
- P2: Migrate `@app.on_event` to lifespan handlers
