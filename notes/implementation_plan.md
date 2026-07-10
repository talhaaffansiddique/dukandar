# Implementation Plan - Dukandar React Web Solution

Dukandar is a responsive, offline-first web-based store management system built with React, TypeScript, and Dexie.js (IndexedDB). It allows small businesses and shopkeepers to manage inventory, purchases, sales, expenses, salary, and reports directly from their web browser.

---

## Technical Stack & Architecture

- **Core Framework:** React 18+ (with TypeScript)
- **Build System:** Vite (for near-instant building and fast dev loops)
- **Database (Offline-First):** Dexie.js (a wrapper around IndexedDB) to provide reactive, transactional local database capabilities similar to Room in Kotlin.
- **Styling:** Custom Vanilla CSS with a CSS-variable-based design system supporting dark and light themes (Teal / Slate primary palette).
- **Icons:** Lucide React for consistent and crisp interface icons.
- **Charts:** Recharts (React charts) or lightweight SVG-based custom charts for beautiful KPI trends.
- **Exports:** Native browser printing with styled print sheets, and jsPDF for downloadable PDF invoices/payslips.

---

## Directory Structure

We will place the project in `C:\Antigravity\Waseem shop\dukandar-web`.

```
dukandar-web/
├── public/
│   └── favicon.svg
├── src/
│   ├── assets/          # Static assets, logos
│   ├── components/      # Shared components (Button, Input, Modal, Alert, TopBar, Sidebar, Cart)
│   ├── db/
│   │   └── database.ts  # Dexie DB configuration & helper functions
│   ├── hooks/           # Custom React hooks (useProduct, useCart, useAuth, etc.)
│   ├── styles/
│   │   ├── variables.css # Core design tokens (colors, spacing, typography)
│   │   ├── global.css    # Global resets and utility classes
│   │   ├── components.css # Component specific styles
│   │   └── screens/      # Styles for specific views
│   ├── views/           # Screens
│   │   ├── AuthScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── InventoryScreen.tsx
│   │   ├── PurchaseScreen.tsx
│   │   ├── SalesScreen.tsx
│   │   ├── OfficeScreen.tsx (Expenses, Employees, Salaries)
│   │   └── ReportsScreen.tsx
│   ├── App.tsx          # Router and app shell
│   ├── index.css        # Import tail of CSS files
│   └── main.tsx
├── package.json
└── tsconfig.json
```

---

## Database Schemas (IndexedDB with Dexie)

IndexedDB tables will mirror the Android SQLite tables:

1. **products:**
   - `id`: `++id` (auto-incrementing primary key)
   - `sku`: String (unique index)
   - `name`: String
   - `category`: String
   - `quantity`: Number
   - `purchasePrice`: Number
   - `sellingPrice`: Number
   - `minStockLevel`: Number
   - `averageCost`: Number

2. **purchases:**
   - `id`: `++id`
   - `productId`: Number (indexed, references product.id)
   - `supplierName`: String
   - `quantity`: Number
   - `purchasePrice`: Number
   - `tax`: Number
   - `invoiceNo`: String
   - `date`: Number (timestamp)

3. **sales:**
   - `id`: `++id`
   - `productId`: Number (indexed, references product.id)
   - `quantity`: Number
   - `sellingPrice`: Number
   - `profit`: Number
   - `customerName`: String
   - `date`: Number (timestamp)
   - `isReturn`: Number (0 or 1 for boolean filtering)

4. **expenses:**
   - `id`: `++id`
   - `category`: String (Rent, Utility, Fuel, Internet, Salary, Misc)
   - `amount`: Number
   - `description`: String
   - `date`: Number (timestamp)
   - `billImagePath`: String (supports local data URLs or file placeholders)

5. **employees:**
   - `id`: `++id`
   - `name`: String
   - `salaryRate`: Number
   - `status`: String (Active/Inactive)

6. **salaries:**
   - `id`: `++id`
   - `employeeId`: Number (indexed, references employee.id)
   - `amount`: Number
   - `bonus`: Number
   - `deduction`: Number
   - `advance`: Number
   - `date`: Number (timestamp)
   - `remarks`: String

7. **users:**
   - `id`: String (email as primary key)
   - `email`: String
   - `role`: String (ADMIN/STAFF)
   - `name`: String

---

## Business Logic Specifications

We will implement the calculations in JS/TS helper functions matching the Android Kotlin logic:

1. **Weighted Average Cost calculation on Purchase:**
   ```typescript
   const currentQty = product.quantity;
   const newQty = currentQty + quantity;
   const currentTotalCost = product.averageCost * currentQty;
   const newTotalCost = currentTotalCost + (purchasePrice * quantity);
   const newAverageCost = newQty > 0 ? newTotalCost / newQty : purchasePrice;
   ```
2. **Deduction and Profit calculation on Sales:**
   ```typescript
   const newQty = product.quantity - quantity;
   const profit = (sellingPrice - product.averageCost) * quantity;
   ```
3. **Sales Return calculation:**
   - Increments inventory quantity.
   - Logs a return transaction with `isReturn = true` and negative profit.
4. **Reorder Level (ROL) Alerts:**
   - Triggers warning alerts in the app shell and dashboard if `product.quantity <= product.minStockLevel`.
5. **Google Drive Cloud Sync Simulation:**
   - Simulates cloud backup by compiling the entire database state into a JSON object and downloading it as a backup file.
   - Simulates cloud restore by letting the user upload a Dukandar JSON backup file, validating its structure, and importing it into Dexie.

---

## UI Components & Design System

Since we are using **Vanilla CSS**, we will build a rich dark/light UI:
- **Design Tokens:** Defined in CSS variables (colours like `#0f172a` slate backgrounds, `#0d9488` teal accents, `#10b981` emerald successes, `#f43f5e` alerts, rounded card borders, clean shadows).
- **Responsive Layout:** Sidebar navigation on desktop, bottom navigation on mobile.
- **Interactive Cart:** Sales checkout screen includes a cart panel, editable selling prices, item-by-item removal, and customer name inputs.
- **Reporting Panel:** Advanced query options where data is filtered dynamically by custom dates, transaction type, or keywords, and downloadable as CSV.
- **Invoice Renderer:** Prints bills beautifully using CSS `@media print` rules, formatting thermal receipts (80mm) and A4 sheets perfectly.

---

## Verification Plan

### Automated Tests
- Verification of basic component render states using a mock workspace and building the project using `vite build` to guarantee compilation success.

### Manual Verification
1. Add a product, verify ROL alerts toggle when stock is depleted.
2. Log a purchase, verify that weighted average cost updates.
3. Add item to cart, change selling price, check out, and verify sales records/profits.
4. View/download CSV reports and PDF receipts.
5. Backup JSON data, clear browser state, import backup, and verify complete restoration.
