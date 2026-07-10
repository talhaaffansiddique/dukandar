# Dukandar Web - Version 1.06 Release Notes

Welcome to Dukandar Web Version 1.06! This release introduces a comprehensive Settings & Feature Toggles Panel, enhanced POS checkout previews, customizable receipt formats, dashboard statistics widgets, and advanced PDF reports.

## What's New in v1.06

### 1. Settings & Feature Toggles Panel (Reversion Control)
* Added a new **Receipt & App Settings** panel to the sidebar dashboard.
* Contains toggle configurations to turn any new feature on or off dynamically:
  * **Show Total Items Count on Receipt**
  * **Dashboard Date/Time Widget**
  * **Clickable Dashboard KPI Cards**
  * **Weekly Trend Multi-Chart Selector**
  * **POS Checkout Preview Confirmation**
  * **POS Refund Optional Inputs**
  * **Monthly Suffix Sequence Reset (`RCP-YY-MM-XXXX`)**
  * **Cart Warranty Override Editor**
* If you want to revert any option, simply disable it in the Settings panel; the app instantly falls back to legacy behaviors!

### 2. Dashboard Statistics & Interactive Charts
* **Date & Clock Widget**: Added a medium-sized local clock in the top-right header of the dashboard (e.g. `Mon, Jun 15, 2026, 4:30 PM`).
* **Interactive KPI Cards**: Make cards for Total Sales, Sales Count, Net Profit, and Expenses clickable. Clicking navigates directly to reports pre-filtered to the correct categories.
* **Weekly Trend Chart Toggles**: Selectable buttons on the trend card top-right allow changing graph layouts between Area, Bar (Column), and Pie chart styles instantly.

### 3. POS Checkout Preview & Confirmation Modal
* Clicking checkout opens a **proposed invoice (preview)** overlay modal showing the receipt preview.
* Clicking outside the template backdrop or clicking **Cancel** returns to the cart without completing the transaction.
* Clicking **Confirm & Sell** logs the transaction, clears the cart, and enables print/download functions.

### 4. Compact POS List View "Remove" Button
* In compact list mode, a **Remove** button is displayed next to **Add**. Clicking it decrements the product quantity in the cart or removes it when it reaches zero.

### 5. Cart Warranty Editor
* Displays product warranty inline inside the sales cart.
* Allows cashiers to override warranty values and units (Months/Years) directly in the cart before checking out.

### 6. POS Sales Returns Form Adjustments
* Customer Name, Refund Price, and a new Sales Receipt Number are now optional (non-mandatory) inputs.
* If Customer Name is omitted, it defaults to 'Walk-in Customer'. If Refund Price is blank, it defaults to the product's selling price.

### 7. Sales History Registry & Reprinting
* Added a **Sales History (Previous Receipts)** tab.
* Lists all completed checkout invoices with columns for Invoice No, Customer, Date, Total, and Items.
* Supports full column sorting. Clicking **Reprint** opens the printable invoice preview for reprint or download.

### 8. Advanced Reports Exports
* All report tabs (Sales, Purchases, and General Ledger) now support dual exports:
  1. **Export to CSV (Excel)**
  2. **Export to PDF**: Compiles clean, tabular, multi-page PDFs using `jsPDF`.

### 9. GitHub Pages Deploy Configuration
* Added `"homepage"` and scripts (`predeploy`, `deploy`) to `package.json` utilizing `gh-pages` for hosting.
