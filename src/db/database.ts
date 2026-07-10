import Dexie, { type Table } from 'dexie';

export interface Product {
  id?: number;
  sku: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  minStockLevel: number;
  averageCost: number;
  warrantyValue?: number;
  warrantyUnit?: 'Months' | 'Years';
  images?: string[]; // Up to 3 base64 image strings
}

export interface Purchase {
  id?: number;
  productId: number;
  supplierName: string;
  quantity: number;
  purchasePrice: number;
  tax: number;
  invoiceNo: string;
  date: number; // timestamp
  invoiceImagePath?: string; // Attachment Base64 data URL
}

export interface Sale {
  id?: number;
  productId: number;
  quantity: number;
  sellingPrice: number;
  profit: number;
  customerName: string;
  date: number; // timestamp
  isReturn: number; // 0 = sale, 1 = return
  invoiceNo?: string;
  warrantyValue?: number;
  warrantyUnit?: string;
}

export interface Expense {
  id?: number;
  category: string; // Rent, Utility, Fuel, Internet, Salary, Misc
  amount: number;
  description: string;
  date: number; // timestamp
  billImagePath?: string; // Data URL / Base64 for receipt images
}

export interface Employee {
  id?: number;
  name: string;
  salaryRate: number;
  status: string; // "Active" | "Inactive"
}

export interface Salary {
  id?: number;
  employeeId: number;
  amount: number;
  bonus: number;
  deduction: number;
  advance: number;
  date: number; // timestamp
  remarks: string;
}

export interface User {
  id: string; // email as key
  email: string;
  role: 'OWNER' | 'ADMIN' | 'EMPLOYEE'; // updated in 1.03
  name: string;
  password?: string; // added in 1.03 for password resets
}

export interface Contact {
  name: string;
  phone: string;
}

export interface Supplier {
  id?: number;
  name: string;
  contacts: Contact[]; // coupled contacts list (added in 1.03)
  address: string;
}

class DukandarDatabase extends Dexie {
  products!: Table<Product, number>;
  purchases!: Table<Purchase, number>;
  sales!: Table<Sale, number>;
  expenses!: Table<Expense, number>;
  employees!: Table<Employee, number>;
  salaries!: Table<Salary, number>;
  users!: Table<User, string>;
  suppliers!: Table<Supplier, number>;

  constructor() {
    // Keep DukandarDatabaseV102 database name so existing UAT data is preserved
    super('DukandarDatabaseV102');
    this.version(1).stores({
      products: '++id, &sku, name',
      purchases: '++id, productId, supplierName, date',
      sales: '++id, productId, customerName, date, isReturn, invoiceNo',
      expenses: '++id, category, date',
      employees: '++id, name, status',
      salaries: '++id, employeeId, date',
      users: 'id, email, role',
      suppliers: '++id, &name',
    });
  }
}

export const db = new DukandarDatabase();

// --- Formatting Utilities ---

/**
 * Truncates currency values to exactly 2 decimal places without rounding off.
 * e.g., 10.999 becomes 10.99 instead of 11.00
 */
export function formatPrice(val: number): string {
  const multiplier = 100;
  const truncated = Math.trunc(val * multiplier) / multiplier;
  return truncated.toFixed(2);
}

// --- Repository Business Logic Operations ---

/**
 * Record a purchase: Updates product stock and average cost, then saves the purchase record.
 */
export async function recordPurchase(
  productId: number,
  supplierName: string,
  quantity: number,
  purchasePrice: number,
  tax: number,
  invoiceNo: string,
  invoiceImagePath?: string
): Promise<void> {
  await db.transaction('rw', [db.products, db.purchases], async () => {
    const product = await db.products.get(productId);
    if (!product) throw new Error('Product not found');

    const currentQty = product.quantity;
    const newQty = currentQty + quantity;

    const currentTotalCost = product.averageCost * currentQty;
    const newTotalCost = currentTotalCost + (purchasePrice * quantity);
    const newAverageCost = newQty > 0 ? newTotalCost / newQty : purchasePrice;

    // Update product stock and average cost
    await db.products.update(productId, {
      quantity: newQty,
      purchasePrice: purchasePrice, // latest purchase price
      averageCost: newAverageCost,
    });

    // Record purchase transaction
    await db.purchases.add({
      productId,
      supplierName,
      quantity,
      purchasePrice,
      tax,
      invoiceNo,
      date: Date.now(),
      invoiceImagePath,
    });
  });
}

/**
 * Record a sale: Deducts product stock and records profit, then saves the sale record.
 */
export async function recordSale(
  productId: number,
  customerName: string,
  quantity: number,
  sellingPrice: number,
  invoiceNo: string,
  warrantyValue?: number,
  warrantyUnit?: string
): Promise<boolean> {
  return await db.transaction('rw', [db.products, db.sales], async () => {
    const product = await db.products.get(productId);
    if (!product) return false;

    const newQty = product.quantity - quantity;
    const profit = (sellingPrice - product.averageCost) * quantity;

    // Update product stock
    await db.products.update(productId, {
      quantity: newQty,
    });

    // Insert sale record
    await db.sales.add({
      productId,
      quantity,
      sellingPrice,
      profit,
      customerName,
      date: Date.now(),
      isReturn: 0,
      invoiceNo,
      warrantyValue,
      warrantyUnit,
    });

    return true;
  });
}

/**
 * Record a sales return: Increments product stock and logs a negative profit sales record.
 */
export async function recordSalesReturn(
  productId: number,
  customerName: string,
  quantity: number,
  sellingPrice: number,
  invoiceNo?: string
): Promise<void> {
  await db.transaction('rw', [db.products, db.sales], async () => {
    const product = await db.products.get(productId);
    if (!product) throw new Error('Product not found');

    const newQty = product.quantity + quantity;
    const profit = (sellingPrice - product.averageCost) * quantity;

    // Update product stock
    await db.products.update(productId, {
      quantity: newQty,
    });

    // Insert return record (negative quantity/profit)
    await db.sales.add({
      productId,
      quantity,
      sellingPrice,
      profit: -profit, // negative profit for sales returns
      customerName: customerName || 'Walk-in Customer',
      date: Date.now(),
      isReturn: 1, // 1 stands for sales return
      invoiceNo: invoiceNo || `RET-${Date.now().toString().slice(-6)}`,
    });
  });
}

/**
 * Perform manual stock adjustment.
 */
export async function adjustStockManual(
  productId: number,
  qtyAdjustment: number
): Promise<void> {
  await db.transaction('rw', db.products, async () => {
    const product = await db.products.get(productId);
    if (!product) throw new Error('Product not found');

    const newQty = product.quantity + qtyAdjustment;
    await db.products.update(productId, {
      quantity: newQty < 0 ? 0 : newQty,
    });
  });
}

/**
 * Utility: Generates the next sequential invoice number matching YY-MM-XXXX format.
 * Suffix increments globally by 1 for each transaction and does not reset daily.
 * Example format: 26-06-0001
 */
export async function generateNextInvoiceNo(): Promise<string> {
  const today = new Date();
  const yearStr = String(today.getFullYear()).slice(-2); // last 2 digits of year
  const monthStr = String(today.getMonth() + 1).padStart(2, '0'); // 2 digits formatted month
  
  const monthlyReset = localStorage.getItem('setting_pos_receipt_id_monthly_reset') !== 'false';
  const prefix = monthlyReset ? `RCP-${yearStr}-${monthStr}-` : `${yearStr}-${monthStr}-`;

  // Fetch all transactions logged this month
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const endOfMonth = nextMonthDate.getTime() - 1;

  const monthSales = await db.sales
    .where('date')
    .between(startOfMonth, endOfMonth)
    .toArray();

  // Find unique invoice numbers matching prefix
  const uniqueInvoices = new Set<string>();
  monthSales.forEach(s => {
    if (s.invoiceNo && s.invoiceNo.startsWith(prefix)) {
      uniqueInvoices.add(s.invoiceNo);
    }
  });

  // Calculate maximum sequence suffix
  let maxSeq = 0;
  uniqueInvoices.forEach(inv => {
    const parts = inv.split('-');
    const suffix = Number(parts[parts.length - 1]);
    if (!isNaN(suffix) && suffix > maxSeq) {
      maxSeq = suffix;
    }
  });

  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Automatically syncs the current IndexedDB state to the simulated Google Drive cloud container (localStorage).
 */
export async function autoSyncCloud(email?: string): Promise<void> {
  const activeEmail = email || localStorage.getItem('current_user_email');
  if (!activeEmail) return;

  try {
    const jsonStr = await exportDatabaseBackup();
    localStorage.setItem(`gdrive_backup_${activeEmail.toLowerCase()}`, jsonStr);
    localStorage.setItem(`gdrive_backup_time_${activeEmail.toLowerCase()}`, String(Date.now()));
  } catch (err) {
    console.error('Cloud auto-sync background error:', err);
  }
}

// Register Dexie hooks on all tables to run autoSyncCloud 200ms after any write completes
let syncTimeout: any = null;
const triggerCloudSync = () => {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    autoSyncCloud().catch(err => console.error('Auto sync error:', err));
  }, 300);
};

db.tables.forEach(table => {
  table.hook('creating', () => { triggerCloudSync(); });
  table.hook('updating', () => { triggerCloudSync(); });
  table.hook('deleting', () => { triggerCloudSync(); });
});

/**
 * Export full database as a JSON string for Cloud Sync simulation.
 */
export async function exportDatabaseBackup(): Promise<string> {
  const products = await db.products.toArray();
  const purchases = await db.purchases.toArray();
  const sales = await db.sales.toArray();
  const expenses = await db.expenses.toArray();
  const employees = await db.employees.toArray();
  const salaries = await db.salaries.toArray();
  const users = await db.users.toArray();
  const suppliers = await db.suppliers.toArray();

  return JSON.stringify({
    version: 1.10,
    products,
    purchases,
    sales,
    expenses,
    employees,
    salaries,
    users,
    suppliers,
  }, null, 2);
}

/**
 * Import a full database JSON state for Cloud Sync simulation.
 */
export async function restoreDatabaseBackup(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  if (data.version !== 1.10 && data.version !== 1.09 && data.version !== 1.08 && data.version !== 1.07 && data.version !== 1.06 && data.version !== 1.05 && data.version !== 1.04 && data.version !== 1.03 && data.version !== 1.02 && data.version !== 1) {
    throw new Error('Incompatible database snapshot file.');
  }

  await db.transaction('rw', [
    db.products,
    db.purchases,
    db.sales,
    db.expenses,
    db.employees,
    db.salaries,
    db.users,
    db.suppliers,
  ], async () => {
    // Clear all existing data first
    await db.products.clear();
    await db.purchases.clear();
    await db.sales.clear();
    await db.expenses.clear();
    await db.employees.clear();
    await db.salaries.clear();
    await db.users.clear();
    await db.suppliers.clear();

    // Import products
    if (Array.isArray(data.products)) {
      for (const p of data.products) {
        await db.products.add(p);
      }
    }

    // Import purchases
    if (Array.isArray(data.purchases)) {
      for (const p of data.purchases) {
        await db.purchases.add(p);
      }
    }

    // Import sales
    if (Array.isArray(data.sales)) {
      for (const s of data.sales) {
        await db.sales.add(s);
      }
    }

    // Import expenses
    if (Array.isArray(data.expenses)) {
      for (const e of data.expenses) {
        await db.expenses.add(e);
      }
    }

    // Import employees
    if (Array.isArray(data.employees)) {
      for (const emp of data.employees) {
        await db.employees.add(emp);
      }
    }

    // Import salaries
    if (Array.isArray(data.salaries)) {
      for (const sal of data.salaries) {
        await db.salaries.add(sal);
      }
    }

    // Import users
    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        await db.users.add(u);
      }
    }

    // Import suppliers
    if (Array.isArray(data.suppliers)) {
      for (const sup of data.suppliers) {
        await db.suppliers.add(sup);
      }
    }
  });
}
