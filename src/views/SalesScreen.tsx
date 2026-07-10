import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingCart, Search, User, Trash2, CheckCircle2, RotateCcw, Printer, X, LayoutGrid, List, History } from 'lucide-react';
import { db, recordSale, recordSalesReturn, generateNextInvoiceNo, formatPrice, type Product } from '../db/database';
import { jsPDF } from 'jspdf';
import { useTableSort, renderSortIcon } from '../hooks/useTableSort';
import CustomNumberInput from '../components/CustomNumberInput';

interface CartItem {
  product: Product;
  quantity: number;
  customPrice: number | ''; // support string empty on backspace
  customWarrantyValue?: number | ''; // override warranty value
  customWarrantyUnit?: 'Months' | 'Years'; // override warranty unit
}

export default function SalesScreen() {
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const allSales = useLiveQuery(() => db.sales.toArray()) || [];
  
  // Tabs: 0 = Sales Checkout, 1 = Sales Return, 2 = Sales History
  const [activeSubTab, setActiveSubTab] = useState(0);

  // Checkout State
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<{ [id: number]: CartItem }>({});
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [isCheckoutConfirmed, setIsCheckoutConfirmed] = useState(false);

  // Sales Return State
  const [returnProductId, setReturnProductId] = useState<number | ''>('');
  const [returnCustomer, setReturnCustomer] = useState('');
  const [returnQty, setReturnQty] = useState(0);
  const [returnPrice, setReturnPrice] = useState<number | ''>('');
  const [returnReceiptNo, setReturnReceiptNo] = useState('');

  // Printable Invoice state
  const [printableInvoice, setPrintableInvoice] = useState<{
    invoiceNo: string;
    customer: string;
    dateStr: string;
    items: { name: string; qty: number; price: number; warrantyValue?: number; warrantyUnit?: string }[];
    total: number;
  } | null>(null);

  // POS Catalog View Mode: 'kanban' or 'list'
  const [salesViewMode, setSalesViewMode] = useState<'kanban' | 'list'>(() => {
    return (localStorage.getItem('sales_view_mode') as 'kanban' | 'list') || 'kanban';
  });

  const changeViewMode = (mode: 'kanban' | 'list') => {
    setSalesViewMode(mode);
    localStorage.setItem('sales_view_mode', mode);
  };

  // Filter products for checkout
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Apply sorting hook to filtered products
  const { sortedData: sortedFilteredProducts, requestSort: requestProductSort, sortConfig: productSortConfig } = useTableSort(filteredProducts, {
    key: 'name',
    direction: 'asc'
  });

  // Load configuration toggles
  const isRefundOptional = localStorage.getItem('setting_pos_refund_optional_fields') !== 'false';
  const isWarrantyEditorEnabled = localStorage.getItem('setting_pos_cart_warranty_editor') !== 'false';
  const showTotalItemsCount = localStorage.getItem('setting_receipt_show_total_items') !== 'false';
  const checkoutPreviewEnabled = localStorage.getItem('setting_pos_checkout_preview') !== 'false';

  // Group sales for Sales History tab
  const previousInvoices = useMemo(() => {
    const invoiceMap: { [invoiceNo: string]: {
      invoiceNo: string;
      customer: string;
      date: number;
      dateStr: string;
      total: number;
      items: { name: string; qty: number; price: number; warrantyValue?: number; warrantyUnit?: string }[];
    }} = {};

    allSales.forEach(s => {
      if (!s.invoiceNo) return;
      if (s.isReturn === 1) return; // Only process actual sales

      const prod = products.find(p => p.id === s.productId);
      const prodName = prod ? prod.name : `Product #${s.productId}`;

      if (!invoiceMap[s.invoiceNo]) {
        invoiceMap[s.invoiceNo] = {
          invoiceNo: s.invoiceNo,
          customer: s.customerName || 'Walk-in Customer',
          date: s.date,
          dateStr: new Date(s.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          total: 0,
          items: [],
        };
      }
      
      invoiceMap[s.invoiceNo].total += s.quantity * s.sellingPrice;
      invoiceMap[s.invoiceNo].items.push({
        name: prodName,
        qty: s.quantity,
        price: s.sellingPrice,
        warrantyValue: s.warrantyValue,
        warrantyUnit: s.warrantyUnit,
      });
    });

    return Object.values(invoiceMap);
  }, [allSales, products]);

  // Apply sorting hook to previous invoices
  const { sortedData: sortedInvoices, requestSort: requestInvoiceSort, sortConfig: invoiceSortConfig } = useTableSort(previousInvoices, {
    key: 'date',
    direction: 'desc'
  });

  // Add to cart
  const handleAddToCart = (product: Product) => {
    if (!product.id) return;
    setCart(prev => {
      const existing = prev[product.id!];
      if (existing) {
        return {
          ...prev,
          [product.id!]: {
            ...existing,
            quantity: Math.min(existing.quantity + 1, product.quantity),
          }
        };
      }
      return {
        ...prev,
        [product.id!]: {
          product,
          quantity: Math.min(1, product.quantity),
          customPrice: product.sellingPrice,
          customWarrantyValue: product.warrantyValue !== undefined ? product.warrantyValue : '',
          customWarrantyUnit: product.warrantyUnit || 'Months'
        }
      };
    });
  };

  // Update Cart Price
  const handlePriceChange = (productId: number, price: number | '') => {
    setCart(prev => {
      if (!prev[productId]) return prev;
      return {
        ...prev,
        [productId]: {
          ...prev[productId],
          customPrice: price,
        }
      };
    });
  };

  // Update Cart Qty
  const handleQtyChange = (productId: number, qty: number) => {
    const stockMax = cart[productId]?.product.quantity || 0;
    const finalQty = Math.max(0, Math.min(qty, stockMax));
    
    setCart(prev => {
      if (finalQty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return {
        ...prev,
        [productId]: {
          ...prev[productId],
          quantity: finalQty,
        }
      };
    });
  };

  // Remove from Cart
  const handleRemoveFromCart = (productId: number) => {
    setCart(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  // Cart total sum
  const cartTotal = useMemo(() => {
    return Object.values(cart).reduce((sum, item) => {
      const rate = item.customPrice === '' ? 0 : item.customPrice;
      return sum + (item.quantity * rate);
    }, 0);
  }, [cart]);

  // Checkout Cart
  const handleCheckout = async () => {
    const items = Object.values(cart);
    if (items.length === 0) {
      alert('Your cart is empty.');
      return;
    }

    try {
      const dateVal = Date.now();
      const invoiceNo = await generateNextInvoiceNo();
      const finalCustomer = customerName.trim() || 'Walk-in Customer';
      
      const receiptItems: { name: string; qty: number; price: number; warrantyValue?: number; warrantyUnit?: string }[] = [];

      for (const item of items) {
        if (!item.product.id) continue;
        const rate = item.customPrice === '' ? 0 : item.customPrice;
        const wVal = item.customWarrantyValue === '' || item.customWarrantyValue === undefined 
          ? 0 
          : Number(item.customWarrantyValue);
        const wUnit = item.customWarrantyUnit || 'Months';
        const finalWVal = (wUnit === 'Months' && wVal > 12) ? 12 : wVal;

        receiptItems.push({
          name: item.product.name,
          qty: item.quantity,
          price: rate,
          warrantyValue: finalWVal,
          warrantyUnit: wUnit,
        });
      }

      if (checkoutPreviewEnabled) {
        // Show receipt overlay modal for preview confirmation first. Do not write to DB yet.
        setPrintableInvoice({
          invoiceNo,
          customer: finalCustomer,
          dateStr: new Date(dateVal).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          items: receiptItems,
          total: cartTotal,
        });
        setIsCheckoutConfirmed(false);
      } else {
        // Legacy Mode: Write to database immediately
        for (const item of items) {
          if (!item.product.id) continue;
          const rate = item.customPrice === '' ? 0 : item.customPrice;
          const wVal = item.customWarrantyValue === '' || item.customWarrantyValue === undefined 
            ? 0 
            : Number(item.customWarrantyValue);
          const wUnit = item.customWarrantyUnit || 'Months';
          const finalWVal = (wUnit === 'Months' && wVal > 12) ? 12 : wVal;

          await recordSale(
            item.product.id,
            finalCustomer,
            item.quantity,
            rate,
            invoiceNo,
            finalWVal,
            wUnit
          );
        }

        setPrintableInvoice({
          invoiceNo,
          customer: finalCustomer,
          dateStr: new Date(dateVal).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          items: receiptItems,
          total: cartTotal,
        });
        setIsCheckoutConfirmed(true);
        setCart({});
        setCustomerName('Walk-in Customer');
      }
    } catch (err) {
      console.error(err);
      alert('Error during checkout.');
    }
  };

  // Confirm and log transaction from overlay
  const handleConfirmCheckout = async () => {
    if (!printableInvoice) return;
    const items = Object.values(cart);
    try {
      for (const item of items) {
        if (!item.product.id) continue;
        const rate = item.customPrice === '' ? 0 : item.customPrice;
        const wVal = item.customWarrantyValue === '' || item.customWarrantyValue === undefined 
          ? 0 
          : Number(item.customWarrantyValue);
        const wUnit = item.customWarrantyUnit || 'Months';
        const finalWVal = (wUnit === 'Months' && wVal > 12) ? 12 : wVal;

        await recordSale(
          item.product.id,
          printableInvoice.customer,
          item.quantity,
          rate,
          printableInvoice.invoiceNo,
          finalWVal,
          wUnit
        );
      }
      setIsCheckoutConfirmed(true);
      setCart({});
      setCustomerName('Walk-in Customer');
    } catch (err) {
      console.error(err);
      alert('Failed to complete sale transaction.');
    }
  };

  // Close modal overlay
  const handleCloseModal = () => {
    setPrintableInvoice(null);
    setIsCheckoutConfirmed(false);
  };

  // Print Invoice using jsPDF (download)
  const handleDownloadPDF = (invoice: typeof printableInvoice) => {
    if (!invoice) return;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 150]
    });

    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    
    doc.text('DUKANDAR RETAIL SHOP', 40, 10, { align: 'center' });
    doc.text('Bill / Invoice Receipt', 40, 15, { align: 'center' });
    doc.text('--------------------------------', 40, 19, { align: 'center' });
    
    doc.text(`Invoice: ${invoice.invoiceNo}`, 5, 24);
    doc.text(`Customer: ${invoice.customer}`, 5, 29);
    doc.text(`Date: ${invoice.dateStr}`, 5, 34);
    doc.text('--------------------------------', 40, 38, { align: 'center' });

    let y = 43;
    doc.text('Item             Qty   Price   Total', 5, y);
    y += 4;
    doc.text('--------------------------------', 40, y, { align: 'center' });
    y += 5;

    invoice.items.forEach(item => {
      // Avoid page clipping by checking page bounds
      if (y > 135) {
        doc.addPage([80, 150], 'portrait');
        doc.setFont('courier', 'normal');
        doc.setFontSize(10);
        y = 10;
        doc.text('--------------------------------', 40, y, { align: 'center' });
        y += 5;
      }

      const nameCrop = item.name.substring(0, 12).padEnd(12);
      const qtyStr = item.qty.toString().padStart(4);
      const priceStr = formatPrice(item.price).padStart(7);
      const totalStr = formatPrice(item.qty * item.price).padStart(7);
      doc.text(`${nameCrop} ${qtyStr} ${priceStr} ${totalStr}`, 5, y);
      y += 5;

      if (item.warrantyValue && item.warrantyValue > 0) {
        doc.text(`  Warranty: ${item.warrantyValue} ${item.warrantyUnit}`, 5, y);
        y += 5;
      }
    });

    if (y > 135) {
      doc.addPage([80, 150], 'portrait');
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      y = 10;
    }

    y += 2;
    doc.text('--------------------------------', 40, y, { align: 'center' });
    y += 5;

    if (showTotalItemsCount) {
      const totalItems = invoice.items.reduce((sum, item) => sum + item.qty, 0);
      doc.text(`TOTAL ITEMS COUNT: ${totalItems}`, 5, y);
      y += 5;
      doc.text('--------------------------------', 40, y, { align: 'center' });
      y += 5;
    }
    
    doc.setFont('courier', 'bold');
    doc.text(`GRAND TOTAL: Rs. ${formatPrice(invoice.total)}`, 5, y);
    doc.setFont('courier', 'normal');
    y += 6;
    doc.text('Thank You For Shopping!', 40, y, { align: 'center' });
    y += 4;
    doc.text('Powered by Dukandar', 40, y, { align: 'center' });

    doc.save(`${invoice.invoiceNo}.pdf`);
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  // Submit Returns
  const handleSalesReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isRefundOptional) {
      if (!returnProductId || !returnCustomer || returnQty <= 0 || returnPrice === '') {
        alert('Please fill out all required return details.');
        return;
      }
    } else {
      if (!returnProductId || returnQty <= 0) {
        alert('Please select a product and enter returned quantity.');
        return;
      }
    }

    try {
      const selectedProd = products.find(p => p.id === Number(returnProductId));
      const finalCustomer = returnCustomer.trim() || 'Walk-in Customer';
      const finalPrice = returnPrice === '' 
        ? (selectedProd?.sellingPrice || 0) 
        : Number(returnPrice);

      await recordSalesReturn(
        Number(returnProductId),
        finalCustomer,
        returnQty,
        finalPrice,
        returnReceiptNo.trim() || undefined
      );

      alert('Sales Return logged successfully. Stock replenished.');
      setReturnProductId('');
      setReturnCustomer('');
      setReturnQty(0);
      setReturnPrice('');
      setReturnReceiptNo('');
    } catch (err) {
      console.error(err);
      alert('Failed to log sales return.');
    }
  };

  const handleReturnProductChange = (prodId: number | '') => {
    setReturnProductId(prodId);
    if (prodId !== '') {
      const prod = products.find(p => p.id === prodId);
      if (prod) {
        setReturnPrice(prod.sellingPrice);
      }
    } else {
      setReturnPrice('');
    }
  };

  const totalItemsCount = printableInvoice
    ? printableInvoice.items.reduce((sum, item) => sum + item.qty, 0)
    : 0;

  return (
    <div className="main-content">
      {/* Tab Navigation header */}
      <div className="tab-headers">
        <button 
          className={`tab-header ${activeSubTab === 0 ? 'active' : ''}`}
          onClick={() => setActiveSubTab(0)}
        >
          <ShoppingCart size={16} style={{ marginRight: '6px' }} />
          Sales Register (Checkout)
        </button>
        <button 
          className={`tab-header ${activeSubTab === 1 ? 'active' : ''}`}
          onClick={() => setActiveSubTab(1)}
        >
          <RotateCcw size={16} style={{ marginRight: '6px' }} />
          Customer Sales Returns
        </button>
        <button 
          className={`tab-header ${activeSubTab === 2 ? 'active' : ''}`}
          onClick={() => setActiveSubTab(2)}
        >
          <History size={16} style={{ marginRight: '6px' }} />
          Sales History (Previous Receipts)
        </button>
      </div>

      {activeSubTab === 0 ? (
        /* SALES CHECKOUT PANEL */
        <div className="sales-layout">
          {/* Products lookup grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="filter-bar" style={{ padding: '0.85rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search 
                  size={18} 
                  style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)' 
                  }} 
                />
                <input
                  type="text"
                  className="input-control"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Search by SKU/Barcode or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '0.15rem' }}>
                <button
                  type="button"
                  className={`btn btn-icon ${salesViewMode === 'kanban' ? 'active' : ''}`}
                  style={{ padding: '0.35rem', backgroundColor: salesViewMode === 'kanban' ? 'var(--primary-light)' : 'transparent', color: salesViewMode === 'kanban' ? 'var(--primary)' : 'var(--text-secondary)' }}
                  onClick={() => changeViewMode('kanban')}
                  title="Kanban Grid View"
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  type="button"
                  className={`btn btn-icon ${salesViewMode === 'list' ? 'active' : ''}`}
                  style={{ padding: '0.35rem', backgroundColor: salesViewMode === 'list' ? 'var(--primary-light)' : 'transparent', color: salesViewMode === 'list' ? 'var(--primary)' : 'var(--text-secondary)' }}
                  onClick={() => changeViewMode('list')}
                  title="Compact List View"
                >
                  <List size={18} />
                </button>
              </div>
            </div>

            {salesViewMode === 'kanban' ? (
              <div className="grid-cols-3" style={{ gap: '1rem' }}>
                {sortedFilteredProducts.length === 0 ? (
                  <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No matches found. Check SKU or register product in Inventory.
                  </div>
                ) : (
                  sortedFilteredProducts.map(p => {
                    const outOfStock = p.quantity <= 0;
                    const displaySku = p.sku.startsWith('AUTO-SKU-') ? 'None' : p.sku;
                    return (
                      <div 
                        key={p.id} 
                        className={`card ${outOfStock ? 'out-of-stock' : ''}`}
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '0.5rem', 
                          opacity: outOfStock ? 0.6 : 1,
                          cursor: outOfStock ? 'not-allowed' : 'pointer'
                        }}
                        onClick={() => !outOfStock && handleAddToCart(p)}
                      >
                        <div className="flex-between">
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                            {displaySku === 'None' ? '' : `SKU: ${displaySku}`}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </h4>
                        <div className="flex-between" style={{ marginTop: '0.5rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.05rem' }}>
                            Rs. {formatPrice(p.sellingPrice)}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: outOfStock ? 'var(--danger)' : 'var(--text-secondary)' }}>
                            {outOfStock ? 'Out of Stock' : `${p.quantity.toFixed(2)} left`}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="table-container" style={{ margin: 0, padding: 0, border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th onClick={() => requestProductSort('sku')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        Barcode / SKU {renderSortIcon('sku', productSortConfig)}
                      </th>
                      <th onClick={() => requestProductSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        Product Name {renderSortIcon('name', productSortConfig)}
                      </th>
                      <th onClick={() => requestProductSort('quantity')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        Stock Qty {renderSortIcon('quantity', productSortConfig)}
                      </th>
                      <th onClick={() => requestProductSort('sellingPrice')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        Retail Price {renderSortIcon('sellingPrice', productSortConfig)}
                      </th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFilteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                          No matches found. Check SKU or register product in Inventory.
                        </td>
                      </tr>
                    ) : (
                      sortedFilteredProducts.map(p => {
                        const outOfStock = p.quantity <= 0;
                        const displaySku = p.sku.startsWith('AUTO-SKU-') ? 'None' : p.sku;
                        return (
                          <tr key={p.id} style={{ opacity: outOfStock ? 0.6 : 1 }}>
                            <td style={{ fontWeight: 600, color: displaySku === 'None' ? 'var(--text-tertiary)' : 'inherit' }}>
                              {displaySku}
                            </td>
                            <td style={{ fontWeight: 500 }}>{p.name}</td>
                            <td style={{ fontWeight: 600 }}>
                              <span style={{ color: outOfStock ? 'var(--danger)' : 'inherit' }}>
                                {p.quantity.toFixed(2)}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                              Rs. {formatPrice(p.sellingPrice)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                {cart[p.id!] && (
                                  <button
                                    type="button"
                                    className="btn btn-danger"
                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                    onClick={() => handleQtyChange(p.id!, cart[p.id!].quantity - 1)}
                                  >
                                    Remove
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                  onClick={() => handleAddToCart(p)}
                                  disabled={outOfStock}
                                >
                                  Add
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="cart-panel">
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div className="flex-gap">
                <ShoppingCart size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.1rem' }}>Sales Cart</h3>
              </div>
              <span className="badge badge-info">{Object.keys(cart).length} unique items</span>
            </div>

            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label>Customer Name</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User 
                  size={16} 
                  style={{ 
                    position: 'absolute', 
                    left: '10px', 
                    color: 'var(--text-tertiary)' 
                  }} 
                />
                <input
                  type="text"
                  className="input-control"
                  style={{ paddingLeft: '2.2rem', paddingRight: '2.2rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', fontSize: '0.9rem' }}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in Customer"
                />
                {customerName && (
                  <button
                    type="button"
                    onClick={() => setCustomerName('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                    title="Clear Customer Name"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Cart list scroll area */}
            <div className="cart-items-list">
              {Object.keys(cart).length === 0 ? (
                <div 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%', 
                    color: 'var(--text-tertiary)',
                    gap: '0.75rem'
                  }}
                >
                  <ShoppingCart size={40} />
                  <span style={{ fontSize: '0.9rem' }}>Select products on left to checkout</span>
                </div>
              ) : (
                Object.values(cart).map(item => (
                  <div className="cart-item" key={item.product.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 0.5rem', borderBottom: '1px solid var(--border-color)', gap: '0.5rem' }}>
                    <div className="cart-item-info" style={{ flex: 1, minWidth: 0 }}>
                      <span className="cart-item-name" style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.product.name}>
                        {item.product.name}
                      </span>
                      <div className="flex-gap" style={{ marginTop: '0.25rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rate:</span>
                        <input
                          type="number"
                          className="qty-input"
                          style={{ width: '80px', height: '24px', fontSize: '0.8rem', textAlign: 'left', padding: '0.15rem' }}
                          value={item.customPrice}
                          onChange={(e) => handlePriceChange(item.product.id!, e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>

                      {/* Warranty Editor */}
                      {isWarrantyEditorEnabled ? (
                        <div className="flex-gap" style={{ marginTop: '0.35rem', alignItems: 'center', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Warranty:</span>
                          <input
                            type="number"
                            min="0"
                            max={item.customWarrantyUnit === 'Months' ? 12 : undefined}
                            className="qty-input"
                            style={{ width: '50px', height: '24px', fontSize: '0.8rem', textAlign: 'center', padding: '0.15rem' }}
                            value={item.customWarrantyValue === undefined ? '' : item.customWarrantyValue}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                              const unit = item.customWarrantyUnit || 'Months';
                              const finalVal = (unit === 'Months' && val !== '' && val > 12) ? 12 : val;
                              setCart(prev => ({
                                ...prev,
                                [item.product.id!]: {
                                  ...prev[item.product.id!],
                                  customWarrantyValue: finalVal
                                }
                              }));
                            }}
                            placeholder="0"
                          />
                          <select
                            className="qty-input"
                            style={{ height: '24px', fontSize: '0.8rem', padding: '0.15rem' }}
                            value={item.customWarrantyUnit || 'Months'}
                            onChange={(e) => {
                              const unit = e.target.value as 'Months' | 'Years';
                              setCart(prev => {
                                const currentItem = prev[item.product.id!];
                                let val = currentItem.customWarrantyValue;
                                if (unit === 'Months' && val !== '' && val !== undefined && val > 12) {
                                  val = 12;
                                }
                                return {
                                  ...prev,
                                  [item.product.id!]: {
                                    ...currentItem,
                                    customWarrantyUnit: unit,
                                    customWarrantyValue: val
                                  }
                                };
                              });
                            }}
                          >
                            <option value="Months">Months</option>
                            <option value="Years">Years</option>
                          </select>
                        </div>
                      ) : (
                        item.product.warrantyValue !== undefined && item.product.warrantyValue > 0 && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Warranty: {item.product.warrantyValue} {item.product.warrantyUnit}
                          </div>
                        )
                      )}
                    </div>

                    <div className="cart-item-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button 
                        type="button"
                        className="btn btn-icon"
                        style={{ 
                          width: '26px', 
                          height: '26px', 
                          borderRadius: '50%', 
                          padding: 0, 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-secondary)',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleQtyChange(item.product.id!, item.quantity - 1)}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: 600, minWidth: '22px', textAlign: 'center', fontSize: '0.9rem' }}>
                        {item.quantity}
                      </span>
                      <button 
                        type="button"
                        className="btn btn-icon"
                        style={{ 
                          width: '26px', 
                          height: '26px', 
                          borderRadius: '50%', 
                          padding: 0, 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-secondary)',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleQtyChange(item.product.id!, item.quantity + 1)}
                      >
                        +
                      </button>
                      <button 
                        className="btn btn-icon" 
                        style={{ color: 'var(--danger)', padding: '0.2rem' }}
                        onClick={() => handleRemoveFromCart(item.product.id!)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart summary footer */}
            <div className="cart-summary">
              <div className="flex-between" style={{ fontSize: '0.9rem' }}>
                <span>Subtotal Items:</span>
                <span>{Object.values(cart).reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <div className="flex-between" style={{ fontSize: '1.2rem', fontWeight: 700, borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                <span>Grand Total:</span>
                <span style={{ color: 'var(--primary)' }}>Rs. {formatPrice(cartTotal)}</span>
              </div>
              
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem' }}
                onClick={handleCheckout}
                disabled={Object.keys(cart).length === 0}
              >
                <CheckCircle2 size={18} />
                Checkout & Print Invoice
              </button>
            </div>
          </div>
        </div>
      ) : activeSubTab === 1 ? (
        /* SALES RETURN FORM */
        <div style={{ maxWidth: '600px', margin: '0 auto' }} className="card">
          <div className="flex-gap" style={{ marginBottom: '1.5rem' }}>
            <RotateCcw size={20} style={{ color: 'var(--danger)' }} />
            <h3 style={{ fontSize: '1.2rem' }}>Record Sales Return</h3>
          </div>

          <form onSubmit={handleSalesReturnSubmit}>
            <div className="form-group">
              <label>Select Product *</label>
              <select
                className="input-control"
                value={returnProductId}
                onChange={(e) => handleReturnProductChange(Number(e.target.value) || '')}
                required
              >
                <option value="">-- Select Product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku.startsWith('AUTO-SKU-') ? '' : `(SKU: ${p.sku})`} - In-Stock: {p.quantity.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid-cols-2">
              <div className="form-group">
                <label>{isRefundOptional ? 'Customer Name (Optional)' : 'Customer Name *'}</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Walk-in Customer"
                  value={returnCustomer}
                  onChange={(e) => setReturnCustomer(e.target.value)}
                  required={!isRefundOptional}
                />
              </div>

              <div className="form-group">
                <label>Sales Receipt Number (Optional)</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. RCP-26-06-0001"
                  value={returnReceiptNo}
                  onChange={(e) => setReturnReceiptNo(e.target.value)}
                />
              </div>
            </div>

            <div className="grid-cols-2" style={{ alignItems: 'flex-start' }}>
              <div className="form-group">
                <label>Returned Quantity *</label>
                <CustomNumberInput
                  value={returnQty}
                  onChange={(val) => setReturnQty(val === '' ? 0 : Number(val))}
                  placeholder="e.g. 1"
                  min={0.01}
                  chips={[1, 2, 5, 10]}
                />
              </div>

              <div className="form-group">
                <label>{isRefundOptional ? 'Refund Unit Price (Optional)' : 'Refund Unit Price (Rs.) *'}</label>
                <CustomNumberInput
                  value={returnPrice}
                  onChange={(val) => setReturnPrice(val)}
                  placeholder={isRefundOptional && returnProductId !== '' ? `Default: Rs. ${formatPrice(products.find(p => p.id === Number(returnProductId))?.sellingPrice || 0)}` : "0.00"}
                  min={0}
                  chips={[10, 50, 100, 500]}
                />
              </div>
            </div>

            <div 
              style={{
                padding: '1rem',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-md)',
                backgroundColor: 'var(--bg-tertiary)',
                fontSize: '0.85rem',
                marginBottom: '1.5rem'
              }}
            >
              <div className="flex-between" style={{ fontWeight: 600, color: 'var(--danger)' }}>
                <span>Total Refund Due:</span>
                <span>
                  Rs. {formatPrice(
                    returnQty * 
                    (returnPrice === '' 
                      ? (products.find(p => p.id === Number(returnProductId))?.sellingPrice || 0) 
                      : returnPrice)
                  )}
                </span>
              </div>
            </div>

            <button type="submit" className="btn btn-danger" style={{ width: '100%' }}>
              <RotateCcw size={18} />
              Process Return & Replenish Stock
            </button>
          </form>
        </div>
      ) : (
        /* SALES HISTORY PANEL */
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={22} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Previous Transactions Registry</h3>
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Invoices found: <strong>{sortedInvoices.length}</strong>
            </span>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th onClick={() => requestInvoiceSort('invoiceNo')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Invoice No {renderSortIcon('invoiceNo', invoiceSortConfig)}
                  </th>
                  <th onClick={() => requestInvoiceSort('customer')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Customer Name {renderSortIcon('customer', invoiceSortConfig)}
                  </th>
                  <th onClick={() => requestInvoiceSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Date & Time {renderSortIcon('date', invoiceSortConfig)}
                  </th>
                  <th onClick={() => requestInvoiceSort('total')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Total Amount {renderSortIcon('total', invoiceSortConfig)}
                  </th>
                  <th>Items Purchased</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No transactions logged yet. Complete checkouts to view history.
                    </td>
                  </tr>
                ) : (
                  sortedInvoices.map((inv) => (
                    <tr key={inv.invoiceNo}>
                      <td style={{ fontWeight: 600 }}>{inv.invoiceNo}</td>
                      <td>{inv.customer}</td>
                      <td>{inv.dateStr}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        Rs. {formatPrice(inv.total)}
                      </td>
                      <td style={{ fontSize: '0.85rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inv.items.map(i => `${i.name} (x${i.qty})`).join(', ')}>
                        {inv.items.map(i => `${i.name} (x${i.qty})`).join(', ')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => {
                            setPrintableInvoice({
                              invoiceNo: inv.invoiceNo,
                              customer: inv.customer,
                              dateStr: inv.dateStr,
                              items: inv.items,
                              total: inv.total,
                            });
                            setIsCheckoutConfirmed(true);
                          }}
                        >
                          Reprint
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* POPUP & HIDDEN LAYOUT: Printable Invoice Bill */}
      {printableInvoice && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Printer size={18} style={{ color: 'var(--primary)' }} /> 
                {isCheckoutConfirmed ? 'Bill Generated' : 'Proposed Invoice (Preview)'}
              </h3>
              <button className="btn btn-icon" onClick={handleCloseModal}>
                <X size={18} />
              </button>
            </div>

            {/* Print Confirmation Banner */}
            {!isCheckoutConfirmed && (
              <div 
                style={{ 
                  padding: '0.75rem', 
                  backgroundColor: 'var(--warning-light)', 
                  color: 'var(--warning)', 
                  border: '1px solid var(--warning)', 
                  borderRadius: 'var(--border-radius-md)', 
                  textAlign: 'center', 
                  marginBottom: '1rem', 
                  fontSize: '0.8rem', 
                  fontWeight: 600 
                }}
              >
                PROPOSED INVOICE PREVIEW - CLICK CONFIRM TO TRANSACT
              </div>
            )}

            {/* Simulated Receipt Preview */}
            <div 
              id="bill-receipt-content"
              style={{
                padding: '1rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 'var(--border-radius-sm)',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#1e293b',
                lineHeight: 1.4,
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px' }}>
                DUKANDAR SHOP
              </div>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                Receipt / Cash Memo
              </div>
              <div>Invoice No : {printableInvoice.invoiceNo}</div>
              <div>Customer   : {printableInvoice.customer || 'Walk-in Customer'}</div>
              <div>Date       : {printableInvoice.dateStr}</div>
              <div style={{ borderBottom: '1px dashed #475569', margin: '8px 0' }}></div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '4px' }}>
                <span>Item (Qty)</span>
                <span>Total</span>
              </div>
              {printableInvoice.items.map((item, idx) => (
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '6px' }} key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ flex: 1 }}>{item.name} (x{item.qty})</span>
                    <span>Rs. {formatPrice(item.qty * item.price)}</span>
                  </div>
                  {item.warrantyValue !== undefined && item.warrantyValue > 0 && (
                    <div style={{ fontSize: '0.65rem', color: '#64748b', paddingLeft: '8px', fontStyle: 'italic' }}>
                      Warranty: {item.warrantyValue} {item.warrantyUnit}
                    </div>
                  )}
                </div>
              ))}
              
              <div style={{ borderBottom: '1px dashed #475569', margin: '8px 0' }}></div>
              
              {showTotalItemsCount && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '4px', marginBottom: '4px', borderBottom: '1px dashed #475569', paddingBottom: '6px' }}>
                  <span>TOTAL ITEMS COUNT:</span>
                  <span>{totalItemsCount}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.85rem' }}>
                <span>GRAND TOTAL:</span>
                <span>Rs. {formatPrice(printableInvoice.total)}</span>
              </div>
              <div style={{ borderBottom: '1px dashed #475569', margin: '8px 0' }}></div>
              <div style={{ textAlign: 'center', marginTop: '10px', color: 'var(--text-secondary)' }}>
                Thank You For Your Business!
              </div>
            </div>

            {/* Action Buttons */}
            {!isCheckoutConfirmed ? (
              <div className="grid-cols-2" style={{ marginTop: '1.5rem', gap: '0.75rem' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.85rem', padding: '0.6rem' }}
                  onClick={handleCloseModal}
                >
                  Cancel Checkout
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ fontSize: '0.85rem', padding: '0.6rem' }}
                  onClick={handleConfirmCheckout}
                >
                  Confirm & Sell
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem' }}>
                <div className="grid-cols-2" style={{ gap: '0.75rem' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ fontSize: '0.85rem', padding: '0.6rem' }}
                    onClick={() => handleDownloadPDF(printableInvoice)}
                  >
                    Download PDF
                  </button>
                  <button 
                    className="btn btn-primary" 
                    style={{ fontSize: '0.85rem', padding: '0.6rem' }}
                    onClick={handleBrowserPrint}
                  >
                    <Printer size={16} /> Print Receipt
                  </button>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem', marginTop: '0.25rem' }}
                  onClick={handleCloseModal}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden browser print area */}
      {printableInvoice && (
        <div className="print-receipt printable-area">
          <div className="print-receipt-center">
            <strong>DUKANDAR STORE</strong><br/>
            Receipt / Cash Bill
          </div>
          <div className="print-receipt-divider"></div>
          <div className="print-receipt-row"><span>Bill No:</span> <span>{printableInvoice.invoiceNo}</span></div>
          <div className="print-receipt-row"><span>Customer:</span> <span>{printableInvoice.customer || 'Walk-in Customer'}</span></div>
          <div className="print-receipt-row"><span>Date:</span> <span>{printableInvoice.dateStr}</span></div>
          <div className="print-receipt-divider"></div>
          <div className="print-receipt-row" style={{ fontWeight: 'bold' }}>
            <span>Item (Qty x Rate)</span>
            <span>Total</span>
          </div>
          {printableInvoice.items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', marginBottom: '4px' }}>
              <div className="print-receipt-row">
                <span>{item.name} (x{item.qty} @ Rs.{formatPrice(item.price)})</span>
                <span>Rs. {formatPrice(item.qty * item.price)}</span>
              </div>
              {item.warrantyValue !== undefined && item.warrantyValue > 0 && (
                <div style={{ fontSize: '10px', paddingLeft: '10px', fontStyle: 'italic' }}>
                  Warranty: {item.warrantyValue} {item.warrantyUnit}
                </div>
              )}
            </div>
          ))}
          <div className="print-receipt-divider"></div>
          
          {showTotalItemsCount && (
            <>
              <div className="print-receipt-row" style={{ fontSize: '11px' }}>
                <span>Total Items Count:</span>
                <span>{totalItemsCount}</span>
              </div>
              <div className="print-receipt-divider"></div>
            </>
          )}

          <div className="print-receipt-row" style={{ fontWeight: 'bold', fontSize: '13px' }}>
            <span>GRAND TOTAL:</span>
            <span>Rs. {formatPrice(printableInvoice.total)}</span>
          </div>
          <div className="print-receipt-divider"></div>
          <div className="print-receipt-center" style={{ marginTop: '10px' }}>
            Thank You For Shopping!<br/>
            Powered by Dukandar App
          </div>
        </div>
      )}
    </div>
  );
}
