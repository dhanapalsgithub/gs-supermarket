# Supermarket POS - CashierPro

## Problem Statement
Modern, responsive Supermarket POS billing screen. Two-column dashboard: product grid (left) + live billing cart (right). Barcode scan input auto-focused. Payment via Cash/UPI/Card. Bluetooth thermal printer simulation (Milestone Y50 - 58mm). Indigo accent palette.

## User Choices
- Backend: MongoDB via FastAPI (managed)
- Accent: Indigo
- Extra features: customer info capture, sales history / receipts log
- Real devices: Milestone Y50 (58mm Bluetooth thermal printer), USB HID barcode scanner
- Product data: 87 products seeded from user's inventory PDF

## Architecture
- **Backend** (`/app/backend/server.py`)
  - MongoDB collections: `products`, `sales`
  - Endpoints: `/api/products` (CRUD + search + category), `/api/products/barcode/{code}`, `/api/categories`, `/api/sales` (create/list/get), `/api/stats/summary`, `/api/seed`
  - Auto-seeds 87 products from `seed_data.py` on startup if empty
  - Stock auto-decrements on sale creation
- **Frontend** (`/app/frontend/src/`)
  - Routes: `/` POS, `/history` Sales, `/admin` Inventory
  - Fonts: Manrope (UI) + JetBrains Mono (numbers)
  - Dark theme with indigo (`#6366F1`) accents, category-tinted product cards
  - Auto-focus barcode/search input on POS; also refocuses after any non-input click

## Implemented (2026-02)
- Full POS with grid + cart, category chips, auto-focus scanner, +/- qty, delete, discount, tax(5%), grand total
- Payment modal with Cash (change calc + quick-fill 100/200/500/1000/2000), UPI (QR block), Card
- 58mm printable receipt with `window.print()` (`@media print` CSS)
- Milestone Y50 printer status modal (Connected/Disconnected toggle)
- Customer info capture (name/phone) attached to sale
- Sales history page with stats (revenue, bills, products); click row reopens receipt
- Inventory admin: create / edit / delete products with search
- Backend tests 10/10 passed; Frontend E2E 100% passed

## Backlog / Next
- P1: CSV/PDF product import UI in Admin
- P1: Configurable tax rate via `/api/config`
- P2: Real thermal print via Web Bluetooth API for Milestone Y50
- P2: Daily/weekly sales report + best-selling chart
- P2: Loyalty (member lookup by phone → auto-fill customer + discount)
