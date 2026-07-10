import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownToLine, ShoppingBag, TrendingUp, DollarSign, Tag, Layers, ChevronDown } from 'lucide-react';
import { db, formatPrice } from '../db/database';
import { useTableSort, renderSortIcon } from '../hooks/useTableSort';
import { jsPDF } from 'jspdf';

interface ReportsScreenProps {
  userEmail: string;
  userName: string;
  userRole: 'OWNER' | 'ADMIN' | 'EMPLOYEE';
}

interface LedgerItem {
  id: string;
  date: number;
  type: 'SALE' | 'RETURN' | 'PURCHASE' | 'EXPENSE';
  title: string;
  amount: number;
  profitOrCost: number; 
}

const MONTHS = [
  { value: '', label: 'All Months' },
  { value: '0', label: 'January' },
  { value: '1', label: 'February' },
  { value: '2', label: 'March' },
  { value: '3', label: 'April' },
  { value: '4', label: 'May' },
  { value: '5', label: 'June' },
  { value: '6', label: 'July' },
  { value: '7', label: 'August' },
  { value: '8', label: 'September' },
  { value: '9', label: 'October' },
  { value: '10', label: 'November' },
  { value: '11', label: 'December' },
];

export default function ReportsScreen(_props: ReportsScreenProps) {
  // Tabs: 0 = Sales Report, 1 = Product Purchase Report, 2 = General Ledger
  const [activeReportTab, setActiveReportTab] = useState(() => {
    const savedTab = localStorage.getItem('reports_active_tab');
    if (savedTab !== null) {
      localStorage.removeItem('reports_active_tab');
      return Number(savedTab);
    }
    return 0;
  });

  const [isExportOpen, setIsExportOpen] = useState(false);

  // Queries
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const purchases = useLiveQuery(() => db.purchases.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];

  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [ledgerType, setLedgerType] = useState<'ALL' | 'SALE' | 'RETURN' | 'PURCHASE' | 'EXPENSE'>('ALL');

  // Filter overrides from dashboard
  useEffect(() => {
    const todayFilter = localStorage.getItem('reports_filter_today') === 'true';
    if (todayFilter) {
      const todayStr = new Date().toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
      localStorage.removeItem('reports_filter_today');
    }

    const ledgerTypeFilter = localStorage.getItem('reports_filter_ledger_type');
    if (ledgerTypeFilter) {
      setLedgerType(ledgerTypeFilter as any);
      localStorage.removeItem('reports_filter_ledger_type');
    }
  }, [activeReportTab]);

  // Helper product names map
  const productMap = useMemo(() => {
    const map: { [key: number]: string } = {};
    products.forEach(p => {
      if (p.id) map[p.id] = p.name;
    });
    return map;
  }, [products]);

  // Date/Month Filtering Helper
  const matchDateAndMonth = (timestamp: number) => {
    const d = new Date(timestamp);
    if (startDate) {
      const start = new Date(startDate).getTime();
      if (timestamp < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1);
      if (timestamp > end) return false;
    }
    if (selectedMonth !== '') {
      if (d.getMonth() !== Number(selectedMonth)) return false;
    }
    return true;
  };

  // ==================== 1. SALES REPORT VIEW LOGIC ====================
  const salesReportData = useMemo(() => {
    return sales
      .filter(s => {
        // Date / Month filter
        if (!matchDateAndMonth(s.date)) return false;
        // Product filter
        if (selectedProductId !== '' && s.productId !== Number(selectedProductId)) return false;
        return true;
      })
      .map(s => {
        const amount = s.quantity * s.sellingPrice;
        const isRet = s.isReturn === 1;
        return {
          id: s.id!,
          date: s.date,
          invoiceNo: s.invoiceNo || 'N/A',
          type: isRet ? 'RETURN' : 'SALE',
          productId: s.productId,
          productName: productMap[s.productId] || 'Deleted Product',
          customerName: s.customerName,
          quantity: isRet ? -s.quantity : s.quantity,
          price: s.sellingPrice,
          total: isRet ? -amount : amount,
          profit: s.profit
        };
      });
  }, [sales, startDate, endDate, selectedMonth, selectedProductId, productMap]);

  // Apply Sorting to Sales Report
  const { sortedData: sortedSalesReport, requestSort: requestSortSales, sortConfig: sortConfigSales } = useTableSort(salesReportData, {
    key: 'date',
    direction: 'desc'
  });

  const salesSummary = useMemo(() => {
    let revenue = 0;
    let profit = 0;
    let unitsSold = 0;
    salesReportData.forEach(s => {
      revenue += s.total;
      profit += s.profit;
      unitsSold += s.quantity;
    });
    return { revenue, profit, unitsSold };
  }, [salesReportData]);

  // ==================== 2. PRODUCT PURCHASE REPORT VIEW LOGIC ====================
  const purchaseReportData = useMemo(() => {
    return purchases
      .filter(p => {
        // Date / Month filter
        if (!matchDateAndMonth(p.date)) return false;
        // Product filter
        if (selectedProductId !== '' && p.productId !== Number(selectedProductId)) return false;
        // Supplier filter
        if (selectedSupplierName !== '' && p.supplierName.toLowerCase() !== selectedSupplierName.toLowerCase()) return false;
        return true;
      })
      .map(p => {
        const totalCost = (p.quantity * p.purchasePrice) + p.tax;
        return {
          id: p.id!,
          date: p.date,
          invoiceNo: p.invoiceNo || 'N/A',
          productId: p.productId,
          productName: productMap[p.productId] || 'Deleted Product',
          supplierName: p.supplierName,
          quantity: p.quantity,
          price: p.purchasePrice,
          tax: p.tax,
          total: totalCost
        };
      });
  }, [purchases, startDate, endDate, selectedMonth, selectedProductId, selectedSupplierName, productMap]);

  // Apply Sorting to Purchase Report
  const { sortedData: sortedPurchaseReport, requestSort: requestSortPurchase, sortConfig: sortConfigPurchase } = useTableSort(purchaseReportData, {
    key: 'date',
    direction: 'desc'
  });

  const purchaseSummary = useMemo(() => {
    let cost = 0;
    let unitsPurchased = 0;
    purchaseReportData.forEach(p => {
      cost += p.total;
      unitsPurchased += p.quantity;
    });
    return {
      cost,
      unitsPurchased,
      avgPrice: unitsPurchased > 0 ? (cost / unitsPurchased) : 0
    };
  }, [purchaseReportData]);

  // ==================== 3. GENERAL LEDGER VIEW LOGIC ====================
  const ledgerItems = useMemo(() => {
    const items: LedgerItem[] = [];

    // Sales and Returns
    sales.forEach(s => {
      const amount = s.quantity * s.sellingPrice;
      const isRet = s.isReturn === 1;
      items.push({
        id: `sale-${s.id}`,
        date: s.date,
        type: isRet ? 'RETURN' : 'SALE',
        title: `${isRet ? 'Sales Return' : 'Customer Sale'} - ${productMap[s.productId] || 'Product'} (x${s.quantity})`,
        amount: isRet ? -amount : amount,
        profitOrCost: s.profit,
      });
    });

    // Purchases
    purchases.forEach(p => {
      const amount = (p.quantity * p.purchasePrice) + p.tax;
      items.push({
        id: `purchase-${p.id}`,
        date: p.date,
        type: 'PURCHASE',
        title: `Supplier Purchase - ${productMap[p.productId] || 'Product'} (x${p.quantity})`,
        amount: amount,
        profitOrCost: amount,
      });
    });

    // Expenses
    expenses.forEach(e => {
      items.push({
        id: `expense-${e.id}`,
        date: e.date,
        type: 'EXPENSE',
        title: `Expense [${e.category}] - ${e.description}`,
        amount: e.amount,
        profitOrCost: e.amount,
      });
    });

    return items;
  }, [sales, purchases, expenses, productMap]);

  const filteredLedger = useMemo(() => {
    return ledgerItems.filter(item => {
      if (!matchDateAndMonth(item.date)) return false;
      if (ledgerType !== 'ALL' && item.type !== ledgerType) return false;
      return true;
    });
  }, [ledgerItems, startDate, endDate, selectedMonth, ledgerType]);

  const { sortedData: sortedLedger, requestSort: requestSortLedger, sortConfig: sortConfigLedger } = useTableSort(filteredLedger, {
    key: 'date',
    direction: 'desc'
  });

  const ledgerSummary = useMemo(() => {
    let salesRevenue = 0;
    let salesProfit = 0;
    let purchaseCost = 0;
    let operatingExpense = 0;

    sortedLedger.forEach(item => {
      if (item.type === 'SALE') {
        salesRevenue += item.amount;
        salesProfit += item.profitOrCost;
      } else if (item.type === 'RETURN') {
        salesRevenue += item.amount;
        salesProfit += item.profitOrCost;
      } else if (item.type === 'PURCHASE') {
        purchaseCost += item.amount;
      } else if (item.type === 'EXPENSE') {
        operatingExpense += item.amount;
      }
    });

    return {
      revenue: salesRevenue,
      grossProfit: salesProfit,
      expenses: operatingExpense,
      purchaseCost,
      netProfit: salesProfit - operatingExpense
    };
  }, [sortedLedger]);

  // ==================== CSV EXPORTERS ====================
  const handleExportSalesCSV = () => {
    if (sortedSalesReport.length === 0) {
      alert('No sales data to export.');
      return;
    }
    const headers = ['Date', 'Invoice No', 'Product Name', 'Customer Name', 'Sold Qty', 'Retail Price (Rs.)', 'Total Sale (Rs.)', 'Profit (Rs.)'];
    const rows = sortedSalesReport.map(s => [
      new Date(s.date).toLocaleDateString(),
      s.invoiceNo,
      `"${s.productName.replace(/"/g, '""')}"`,
      `"${s.customerName.replace(/"/g, '""')}"`,
      s.quantity,
      formatPrice(s.price),
      formatPrice(s.total),
      formatPrice(s.profit)
    ]);
    downloadCSV(headers, rows, 'Sales_Report');
  };

  const handleExportPurchaseCSV = () => {
    if (sortedPurchaseReport.length === 0) {
      alert('No purchase data to export.');
      return;
    }
    const headers = ['Date', 'Invoice No', 'Product Name', 'Supplier Name', 'Purchased Qty', 'Purchase Price (Rs.)', 'Tax (Rs.)', 'Total Cost (Rs.)'];
    const rows = sortedPurchaseReport.map(p => [
      new Date(p.date).toLocaleDateString(),
      p.invoiceNo,
      `"${p.productName.replace(/"/g, '""')}"`,
      `"${p.supplierName.replace(/"/g, '""')}"`,
      p.quantity,
      formatPrice(p.price),
      formatPrice(p.tax),
      formatPrice(p.total)
    ]);
    downloadCSV(headers, rows, 'Purchase_Report');
  };

  const handleExportLedgerCSV = () => {
    if (sortedLedger.length === 0) {
      alert('No ledger data to export.');
      return;
    }
    const headers = ['Date', 'Transaction Type', 'Description Details', 'Amount (Rs.)', 'Profit/Expense impact (Rs.)'];
    const rows = sortedLedger.map(item => [
      new Date(item.date).toLocaleDateString(),
      item.type,
      `"${item.title.replace(/"/g, '""')}"`,
      formatPrice(item.amount),
      formatPrice(item.profitOrCost)
    ]);
    downloadCSV(headers, rows, 'General_Ledger');
  };

  const downloadCSV = (headers: string[], rows: any[][], fileName: string) => {
    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Dukandar_${fileName}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSalesPDF = () => {
    if (sortedSalesReport.length === 0) {
      alert('No sales data to export.');
      return;
    }
    const doc = new jsPDF();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.text('Dukandar - Sales Report', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    let y = 32;
    doc.setFont('helvetica', 'bold');
    doc.text('Date       Invoice No     Product Name         Qty      Price       Total       Profit', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text('-------------------------------------------------------------------------------------------------------------', 14, y + 3);
    y += 8;

    sortedSalesReport.forEach(s => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const dateStr = new Date(s.date).toLocaleDateString().padEnd(10);
      const invStr = s.invoiceNo.padEnd(14);
      const nameStr = s.productName.substring(0, 18).padEnd(20);
      const qtyStr = s.quantity.toFixed(1).padStart(5);
      const priceStr = formatPrice(s.price).padStart(10);
      const totalStr = formatPrice(s.total).padStart(11);
      const profitStr = formatPrice(s.profit).padStart(11);
      doc.text(`${dateStr} ${invStr} ${nameStr} ${qtyStr} ${priceStr} ${totalStr} ${profitStr}`, 14, y);
      y += 6;
    });

    doc.save(`Dukandar_Sales_Report_${Date.now()}.pdf`);
  };

  const handleExportPurchasePDF = () => {
    if (sortedPurchaseReport.length === 0) {
      alert('No purchase data to export.');
      return;
    }
    const doc = new jsPDF();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.text('Dukandar - Product Purchase Report', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    let y = 32;
    doc.setFont('helvetica', 'bold');
    doc.text('Date       Invoice No     Product Name         Supplier          Qty      Price       Total', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text('-------------------------------------------------------------------------------------------------------------', 14, y + 3);
    y += 8;

    sortedPurchaseReport.forEach(p => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const dateStr = new Date(p.date).toLocaleDateString().padEnd(10);
      const invStr = p.invoiceNo.padEnd(14);
      const nameStr = p.productName.substring(0, 18).padEnd(20);
      const supplierStr = p.supplierName.substring(0, 14).padEnd(16);
      const qtyStr = p.quantity.toFixed(1).padStart(5);
      const priceStr = formatPrice(p.price).padStart(10);
      const totalStr = formatPrice(p.total).padStart(11);
      doc.text(`${dateStr} ${invStr} ${nameStr} ${supplierStr} ${qtyStr} ${priceStr} ${totalStr}`, 14, y);
      y += 6;
    });

    doc.save(`Dukandar_Purchase_Report_${Date.now()}.pdf`);
  };

  const handleExportLedgerPDF = () => {
    if (sortedLedger.length === 0) {
      alert('No ledger data to export.');
      return;
    }
    const doc = new jsPDF();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.text('Dukandar - General Ledger Report', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    let y = 32;
    doc.setFont('helvetica', 'bold');
    doc.text('Date       Type       Description Details                           Amount', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text('-------------------------------------------------------------------------------------------------------------', 14, y + 3);
    y += 8;

    sortedLedger.forEach(item => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const dateStr = new Date(item.date).toLocaleDateString().padEnd(10);
      const typeStr = item.type.padEnd(10);
      const titleStr = item.title.substring(0, 42).padEnd(45);
      const amountStr = formatPrice(item.amount).padStart(12);
      doc.text(`${dateStr} ${typeStr} ${titleStr} ${amountStr}`, 14, y);
      y += 6;
    });

    doc.save(`Dukandar_General_Ledger_${Date.now()}.pdf`);
  };

  return (
    <div className="main-content">
      {/* Header section */}
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '1.85rem' }}>Reports & Analytics</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Filter sales records, review product purchases, and view profit-loss ledgers.
          </p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="tab-headers">
        <button className={`tab-header ${activeReportTab === 0 ? 'active' : ''}`} onClick={() => setActiveReportTab(0)}>
          Sales Report
        </button>
        <button className={`tab-header ${activeReportTab === 1 ? 'active' : ''}`} onClick={() => setActiveReportTab(1)}>
          Product Purchase Report
        </button>
        <button className={`tab-header ${activeReportTab === 2 ? 'active' : ''}`} onClick={() => setActiveReportTab(2)}>
          General Ledger Feed
        </button>
      </div>

      {/* GLOBAL SEARCH / FILTERS BAR */}
      <div className="filter-bar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div className="filter-input-group">
          <label>From</label>
          <input
            type="date"
            className="input-control"
            style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="filter-input-group">
          <label>To</label>
          <input
            type="date"
            className="input-control"
            style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="filter-input-group">
          <label>Month-wise</label>
          <select
            className="input-control"
            style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', width: '130px' }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Product Filter - Visible in Sales and Purchases */}
        {activeReportTab !== 2 && (
          <div className="filter-input-group">
            <label>Product</label>
            <select
              className="input-control"
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', width: '155px' }}
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Supplier Filter - Visible only in Purchases */}
        {activeReportTab === 1 && (
          <div className="filter-input-group">
            <label>Supplier</label>
            <select
              className="input-control"
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', width: '150px' }}
              value={selectedSupplierName}
              onChange={(e) => setSelectedSupplierName(e.target.value)}
            >
              <option value="">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Ledger Type - Visible only in General Ledger */}
        {activeReportTab === 2 && (
          <div className="filter-input-group">
            <label>Tx Type</label>
            <select
              className="input-control"
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', width: '120px' }}
              value={ledgerType}
              onChange={(e) => setLedgerType(e.target.value as any)}
            >
              <option value="ALL">All Entries</option>
              <option value="SALE">Sales only</option>
              <option value="RETURN">Returns only</option>
              <option value="PURCHASE">Purchases only</option>
              <option value="EXPENSE">Expenses only</option>
            </select>
          </div>
        )}

        {/* Export Options Dropdown */}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button 
            type="button" 
            className="btn btn-secondary flex-gap" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={() => setIsExportOpen(prev => !prev)}
          >
            <ArrowDownToLine size={16} /> Export Options <ChevronDown size={14} />
          </button>
          
          {isExportOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: '0.25rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-md)',
              boxShadow: 'var(--shadow-md)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              minWidth: '160px',
              padding: '0.25rem 0'
            }}>
              <button 
                type="button" 
                className="nav-item" 
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 0 }}
                onClick={() => {
                  setIsExportOpen(false);
                  if (activeReportTab === 0) handleExportSalesCSV();
                  else if (activeReportTab === 1) handleExportPurchaseCSV();
                  else handleExportLedgerCSV();
                }}
              >
                Excel (CSV)
              </button>
              <button 
                type="button" 
                className="nav-item" 
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 0 }}
                onClick={() => {
                  setIsExportOpen(false);
                  if (activeReportTab === 0) handleExportSalesPDF();
                  else if (activeReportTab === 1) handleExportPurchasePDF();
                  else handleExportLedgerPDF();
                }}
              >
                PDF Document
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RENDER ACTIVE TAB */}
      {activeReportTab === 0 && (
        /* ==================== TAB 0: SALES REPORT ==================== */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Sales KPI cards */}
            <div className="grid-cols-3" style={{ gap: '1rem' }}>
              <div className="kpi-card" style={{ '--kpi-color': 'var(--success)', '--kpi-bg': 'var(--success-light)' } as any}>
                <div className="kpi-icon-wrapper"><TrendingUp size={20} /></div>
                <div className="kpi-info">
                  <span className="kpi-label">Sales Revenue</span>
                  <span className="kpi-value" style={{ color: 'var(--success)' }}>Rs. {formatPrice(salesSummary.revenue)}</span>
                </div>
              </div>

              <div className="kpi-card" style={{ '--kpi-color': 'var(--primary)', '--kpi-bg': 'var(--primary-light)' } as any}>
                <div className="kpi-icon-wrapper"><DollarSign size={20} /></div>
                <div className="kpi-info">
                  <span className="kpi-label">Sales Profit</span>
                  <span className="kpi-value" style={{ color: 'var(--primary)' }}>Rs. {formatPrice(salesSummary.profit)}</span>
                </div>
              </div>

              <div className="kpi-card" style={{ '--kpi-color': 'var(--warning)', '--kpi-bg': 'var(--warning-light)' } as any}>
                <div className="kpi-icon-wrapper"><Tag size={20} /></div>
                <div className="kpi-info">
                  <span className="kpi-label">Units Traded</span>
                  <span className="kpi-value">{salesSummary.unitsSold.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Sales Table */}
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th onClick={() => requestSortSales('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Date {renderSortIcon('date', sortConfigSales)}
                    </th>
                    <th onClick={() => requestSortSales('invoiceNo')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Invoice No {renderSortIcon('invoiceNo', sortConfigSales)}
                    </th>
                    <th onClick={() => requestSortSales('productName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Product {renderSortIcon('productName', sortConfigSales)}
                    </th>
                    <th onClick={() => requestSortSales('customerName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Customer {renderSortIcon('customerName', sortConfigSales)}
                    </th>
                    <th onClick={() => requestSortSales('quantity')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      Qty {renderSortIcon('quantity', sortConfigSales)}
                    </th>
                    <th onClick={() => requestSortSales('price')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      Unit Price {renderSortIcon('price', sortConfigSales)}
                    </th>
                    <th onClick={() => requestSortSales('total')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      Total Sale {renderSortIcon('total', sortConfigSales)}
                    </th>
                    <th onClick={() => requestSortSales('profit')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      Profit {renderSortIcon('profit', sortConfigSales)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSalesReport.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        No sales found matching search filters.
                      </td>
                    </tr>
                  ) : (
                    sortedSalesReport.map(s => {
                      const isReturn = s.type === 'RETURN';
                      return (
                        <tr key={s.id}>
                          <td>{new Date(s.date).toLocaleDateString()}</td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.invoiceNo}</span>
                          </td>
                          <td style={{ fontWeight: 500 }}>
                            {s.productName} 
                            {isReturn && <span style={{ marginLeft: '4px', fontSize: '0.7rem' }} className="badge badge-danger">RETURN</span>}
                          </td>
                          <td>{s.customerName}</td>
                          <td style={{ textAlign: 'right', fontWeight: 500 }}>{s.quantity.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>Rs. {formatPrice(s.price)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: isReturn ? 'var(--danger)' : 'var(--success)' }}>
                            {isReturn ? '-' : ''}Rs. {formatPrice(Math.abs(s.total))}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: s.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {s.profit >= 0 ? '+' : ''}Rs. {formatPrice(s.profit)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick info card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Sales Insights</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              This report captures all point-of-sale customer checkouts and returns. Profits are computed in real-time by subtracting the product's weighted average cost from the selling price.
            </p>
          </div>
        </div>
      )}

      {activeReportTab === 1 && (
        /* ==================== TAB 1: PURCHASE REPORT ==================== */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Purchase KPI cards */}
            <div className="grid-cols-3" style={{ gap: '1rem' }}>
              <div className="kpi-card" style={{ '--kpi-color': 'var(--danger)', '--kpi-bg': 'var(--danger-light)' } as any}>
                <div className="kpi-icon-wrapper"><ShoppingBag size={20} /></div>
                <div className="kpi-info">
                  <span className="kpi-label">Total Outlay</span>
                  <span className="kpi-value" style={{ color: 'var(--danger)' }}>Rs. {formatPrice(purchaseSummary.cost)}</span>
                </div>
              </div>

              <div className="kpi-card" style={{ '--kpi-color': 'var(--primary)', '--kpi-bg': 'var(--primary-light)' } as any}>
                <div className="kpi-icon-wrapper"><Layers size={20} /></div>
                <div className="kpi-info">
                  <span className="kpi-label">Units Purchased</span>
                  <span className="kpi-value">{purchaseSummary.unitsPurchased.toFixed(2)}</span>
                </div>
              </div>

              <div className="kpi-card" style={{ '--kpi-color': 'var(--warning)', '--kpi-bg': 'var(--warning-light)' } as any}>
                <div className="kpi-icon-wrapper"><DollarSign size={20} /></div>
                <div className="kpi-info">
                  <span className="kpi-label">Avg Unit Cost</span>
                  <span className="kpi-value">Rs. {formatPrice(purchaseSummary.avgPrice)}</span>
                </div>
              </div>
            </div>

            {/* Purchase Table */}
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th onClick={() => requestSortPurchase('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Date {renderSortIcon('date', sortConfigPurchase)}
                    </th>
                    <th onClick={() => requestSortPurchase('invoiceNo')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Invoice No {renderSortIcon('invoiceNo', sortConfigPurchase)}
                    </th>
                    <th onClick={() => requestSortPurchase('productName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Product {renderSortIcon('productName', sortConfigPurchase)}
                    </th>
                    <th onClick={() => requestSortPurchase('supplierName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Supplier {renderSortIcon('supplierName', sortConfigPurchase)}
                    </th>
                    <th onClick={() => requestSortPurchase('quantity')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      Qty {renderSortIcon('quantity', sortConfigPurchase)}
                    </th>
                    <th onClick={() => requestSortPurchase('price')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      Unit Cost {renderSortIcon('price', sortConfigPurchase)}
                    </th>
                    <th onClick={() => requestSortPurchase('tax')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      Tax {renderSortIcon('tax', sortConfigPurchase)}
                    </th>
                    <th onClick={() => requestSortPurchase('total')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      Total Cost {renderSortIcon('total', sortConfigPurchase)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPurchaseReport.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        No purchases found matching search filters.
                      </td>
                    </tr>
                  ) : (
                    sortedPurchaseReport.map(p => (
                      <tr key={p.id}>
                        <td>{new Date(p.date).toLocaleDateString()}</td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.invoiceNo}</span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{p.productName}</td>
                        <td>{p.supplierName}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>{p.quantity.toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>Rs. {formatPrice(p.price)}</td>
                        <td style={{ textAlign: 'right' }}>Rs. {formatPrice(p.tax)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                          Rs. {formatPrice(p.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick info card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Supplier Insights</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              This report compiles all incoming inventory purchases and updates unit costs centrally. Taxes and flat shipping values added on check-in are incorporated here.
            </p>
          </div>
        </div>
      )}

      {activeReportTab === 2 && (
        /* ==================== TAB 2: GENERAL LEDGER FEED ==================== */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th onClick={() => requestSortLedger('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Date {renderSortIcon('date', sortConfigLedger)}
                    </th>
                    <th onClick={() => requestSortLedger('type')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Type {renderSortIcon('type', sortConfigLedger)}
                    </th>
                    <th onClick={() => requestSortLedger('title')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Transaction Description {renderSortIcon('title', sortConfigLedger)}
                    </th>
                    <th onClick={() => requestSortLedger('amount')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                      Total (Rs.) {renderSortIcon('amount', sortConfigLedger)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLedger.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        No ledger transactions found matching selected filters.
                      </td>
                    </tr>
                  ) : (
                    sortedLedger.map(item => {
                      const isExpenseType = item.type === 'PURCHASE' || item.type === 'EXPENSE' || item.type === 'RETURN';
                      return (
                        <tr key={item.id}>
                          <td>{new Date(item.date).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge ${
                              item.type === 'SALE' ? 'badge-success' :
                              item.type === 'RETURN' ? 'badge-danger' :
                              item.type === 'PURCHASE' ? 'badge-info' : 'badge-warning'
                             }`}>
                              {item.type}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500 }}>{item.title}</td>
                          <td 
                            style={{ 
                              textAlign: 'right', 
                              fontWeight: 600, 
                              color: isExpenseType ? 'var(--danger)' : 'var(--success)'
                            }}
                          >
                            {isExpenseType ? '-' : '+'}Rs. {formatPrice(Math.abs(item.amount))}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* P&L Financial Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignSelf: 'start' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Profit & Loss Sheet</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Summary calculated from filtered ledger items.
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="flex-between">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Net Revenues:</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                  Rs. {formatPrice(ledgerSummary.revenue)}
                </span>
              </div>
              
              <div className="flex-between">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Cost of Goods Sold (COGS):</span>
                <span style={{ fontWeight: 600 }}>
                  Rs. {formatPrice(ledgerSummary.revenue - ledgerSummary.grossProfit)}
                </span>
              </div>
              
              <div style={{ borderBottom: '1px solid var(--border-color)' }}></div>
              
              <div className="flex-between">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Gross Sales Profit:</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                  Rs. {formatPrice(ledgerSummary.grossProfit)}
                </span>
              </div>

              <div className="flex-between">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Operating Expenses:</span>
                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>
                  Rs. {formatPrice(ledgerSummary.expenses)}
                </span>
              </div>
              
              <div style={{ borderBottom: '2px solid var(--border-color)', margin: '4px 0' }}></div>
              
              <div className="flex-between" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                <span>NET BUSINESS PROFIT:</span>
                <span style={{ color: ledgerSummary.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  Rs. {formatPrice(ledgerSummary.netProfit)}
                </span>
              </div>
            </div>

            <div 
              style={{ 
                padding: '0.75rem', 
                fontSize: '0.75rem', 
                backgroundColor: 'var(--bg-tertiary)', 
                borderRadius: 'var(--border-radius-sm)', 
                color: 'var(--text-secondary)',
                textAlign: 'center',
                lineHeight: 1.4
              }}
            >
              COGS calculates from Weighted Average cost of products dynamically.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
