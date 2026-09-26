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

## Backlog / Next
- P1: Real payment gateway (Stripe/Razorpay) toggle
- P1: Order confirmation email (Resend integration)
- P1: SMS notifications on status changes (Twilio)
- P2: Customer loyalty tier + auto-discount
- P2: Multi-outlet + per-cashier login logs
- P2: Migrate `@app.on_event` to lifespan handlers
