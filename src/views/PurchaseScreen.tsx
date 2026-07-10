import React, { useState, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, Calendar, User, FileText, ArrowUpRight, X, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { db, recordPurchase, formatPrice, type Product } from '../db/database';
import { useTableSort, renderSortIcon } from '../hooks/useTableSort';
import CustomNumberInput from '../components/CustomNumberInput';

interface PurchaseScreenProps {
  userRole: 'OWNER' | 'ADMIN' | 'EMPLOYEE';
}

// Custom Searchable Dropdown for Product selection (Combobox)
function ProductCombobox({
  products,
  value,
  onChange
}: {
  products: Product[];
  value: number | '';
  onChange: (id: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const selectedProduct = products.find(p => p.id === value);
  
  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <div style={{ position: 'relative' }}>
      <div 
        style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
        onFocus={() => setIsOpen(true)}
      >
        <input
          type="text"
          className="input-control"
          style={{ paddingRight: '2.5rem' }}
          placeholder="Type to search or click arrow..."
          value={isOpen ? search : (selectedProduct ? selectedProduct.name : '')}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ChevronDown 
          size={16} 
          style={{ 
            position: 'absolute', 
            right: '12px', 
            color: 'var(--text-tertiary)',
            pointerEvents: 'none'
          }} 
        />
      </div>
      
      {isOpen && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
            onClick={() => setIsOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '200px',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            marginTop: '4px'
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                No matches found
              </div>
            ) : (
              filtered.map(p => (
                <div
                  key={p.id}
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    backgroundColor: value === p.id ? 'var(--primary-light)' : 'transparent',
                    color: value === p.id ? 'var(--primary)' : 'inherit',
                  }}
                  onMouseDown={() => {
                    onChange(p.id!);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  {p.name} {p.sku.startsWith('AUTO-SKU-') ? '' : `(SKU: ${p.sku})`} - Qty: {p.quantity.toFixed(2)}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function PurchaseScreen({ userRole }: PurchaseScreenProps) {
  const purchases = useLiveQuery(() => db.purchases.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form Fields
  const [productId, setProductId] = useState<number | ''>('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [tax, setTax] = useState(0);

  // v1.07 Invoice Attachments States
  const [invoiceImage, setInvoiceImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showCloudPicker, setShowCloudPicker] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isPurchaseImagesEnabled = true;
  const simulateApk = localStorage.getItem('setting_simulate_apk') === 'true';
  const isMobileApk = !!(window as any).cordova || !!(window as any).Capacitor || simulateApk;

  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Webcam access error:', err);
      alert('Could not access camera. Please verify permissions.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const captureSnapshot = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        setInvoiceImage(canvas.toDataURL('image/jpeg'));
      }
      stopCamera();
    }
  };

  const isAdmin = userRole === 'ADMIN' || userRole === 'OWNER';

  // Helper: map product name from ID
  const productMap = useMemo(() => {
    const map: { [key: number]: string } = {};
    products.forEach(p => {
      if (p.id) map[p.id] = p.name;
    });
    return map;
  }, [products]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const pName = productMap[p.productId]?.toLowerCase() || '';
      const sName = p.supplierName.toLowerCase();
      const inv = p.invoiceNo.toLowerCase();
      const query = searchQuery.toLowerCase();
      return pName.includes(query) || sName.includes(query) || inv.includes(query);
    });
  }, [purchases, productMap, searchQuery]);

  // Map product names and calculations for sorting
  const purchasesWithData = useMemo(() => {
    return filteredPurchases.map(p => ({
      ...p,
      productName: productMap[p.productId] || 'Deleted Product',
      totalCost: (p.quantity * p.purchasePrice) + p.tax
    }));
  }, [filteredPurchases, productMap]);

  // Apply sorting hook
  const { sortedData: sortedPurchases, requestSort, sortConfig } = useTableSort(purchasesWithData, {
    key: 'date',
    direction: 'desc'
  });

  // Submit Purchase
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || quantity <= 0 || purchasePrice <= 0) {
      alert('Please select a product, quantity, and purchase price.');
      return;
    }

    const finalSupplier = supplierName || 'Unknown Supplier';
    const finalInvoice = invoiceNo || `INV-PUR-${Date.now().toString().slice(-6)}`;

    try {
      await recordPurchase(
        Number(productId),
        finalSupplier,
        quantity,
        purchasePrice,
        tax || 0,
        finalInvoice,
        invoiceImage || undefined
      );
      setIsAddModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Error recording purchase.');
    }
  };

  const resetForm = () => {
    setProductId('');
    setSupplierName('');
    setInvoiceNo('');
    setQuantity(0);
    setPurchasePrice(0);
    setTax(0);
    setInvoiceImage(null);
    setIsCameraActive(false);
    setShowCloudPicker(false);
  };

  if (!isAdmin) {
    return (
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <h3>Access Restrained</h3>
          <p>Only Administrators can view or record supplier purchases.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      {/* Header section */}
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '1.85rem' }}>Purchases & Supplier Logs</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Record product supplier imports and manage batch costs.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} />
          Record Purchase
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
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
            placeholder="Search by supplier, invoice, or product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Purchases History Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th onClick={() => requestSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Date {renderSortIcon('date', sortConfig)}
              </th>
              <th onClick={() => requestSort('productName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Product Name {renderSortIcon('productName', sortConfig)}
              </th>
              <th onClick={() => requestSort('supplierName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Supplier {renderSortIcon('supplierName', sortConfig)}
              </th>
              <th onClick={() => requestSort('invoiceNo')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Invoice No {renderSortIcon('invoiceNo', sortConfig)}
              </th>
              <th onClick={() => requestSort('quantity')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Qty {renderSortIcon('quantity', sortConfig)}
              </th>
              <th onClick={() => requestSort('purchasePrice')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Rate (Rs.) {renderSortIcon('purchasePrice', sortConfig)}
              </th>
              <th onClick={() => requestSort('tax')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Tax (Rs.) {renderSortIcon('tax', sortConfig)}
              </th>
              <th onClick={() => requestSort('totalCost')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Total (Rs.) {renderSortIcon('totalCost', sortConfig)}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPurchases.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  No purchase records found. Record a supplier batch to update average stock cost.
                </td>
              </tr>
            ) : (
              sortedPurchases.map(purchase => {
                return (
                  <tr key={purchase.id}>
                    <td>
                      <div className="flex-gap" style={{ fontSize: '0.9rem' }}>
                        <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
                        {new Date(purchase.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{purchase.productName}</td>
                    <td>
                      <div className="flex-gap">
                        <User size={14} style={{ color: 'var(--text-tertiary)' }} />
                        {purchase.supplierName}
                      </div>
                    </td>
                    <td>
                      <div className="flex-gap" style={{ alignItems: 'center' }}>
                        <FileText size={14} style={{ color: 'var(--text-tertiary)' }} />
                        <span>{purchase.invoiceNo}</span>
                        {isPurchaseImagesEnabled && purchase.invoiceImagePath && (
                          <button 
                            type="button" 
                            className="btn btn-icon" 
                            style={{ padding: '0.1rem', color: 'var(--primary)', cursor: 'pointer' }}
                            onClick={() => setEnlargedImage(purchase.invoiceImagePath!)}
                            title="View Attached Invoice Document"
                          >
                            <ImageIcon size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td>{purchase.quantity.toFixed(2)}</td>
                    <td>Rs. {formatPrice(purchase.purchasePrice)}</td>
                    <td>Rs. {formatPrice(purchase.tax)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      Rs. {formatPrice(purchase.totalCost)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: Record Purchase */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h3>Record Supplier Purchase</h3>
              <button className="btn btn-icon" onClick={() => setIsAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitPurchase}>
              <div className="form-group">
                <label>Select Product *</label>
                <ProductCombobox 
                  products={products}
                  value={productId}
                  onChange={(id) => setProductId(id)}
                />
              </div>

              <div className="form-group">
                <label>Supplier (Optional)</label>
                <select
                  className="input-control"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                >
                  <option value="">-- Choose Supplier from Master --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Invoice Number (Optional)</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. INV-100234 (auto-generated if empty)"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                />
              </div>

              {/* Purchase Invoice Document Attachments (v1.07) */}
              {isPurchaseImagesEnabled && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem' }}>Invoice Document Attachment</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    
                    {invoiceImage ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-tertiary)' }}>
                        <img 
                          src={invoiceImage} 
                          alt="Invoice Preview" 
                          style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)' }} 
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.8rem', display: 'block', color: 'var(--text-secondary)' }}>Invoice Attached</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>Ready to save</span>
                        </div>
                        <button type="button" className="btn btn-icon" onClick={() => setInvoiceImage(null)} style={{ color: 'var(--danger)', padding: '0.25rem' }}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <label className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                          Local File
                          <input 
                            type="file" 
                            accept="image/*" 
                            style={{ display: 'none' }} 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const r = new FileReader();
                                r.onloadend = () => setInvoiceImage(r.result as string);
                                r.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>

                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          onClick={() => setShowCloudPicker(!showCloudPicker)} 
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                        >
                          Import Cloud
                        </button>

                        {isMobileApk && (
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={startCamera} 
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            Capture Camera
                          </button>
                        )}
                      </div>
                    )}

                    {isCameraActive && (
                      <div 
                        style={{ 
                          padding: '1rem', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: 'var(--border-radius-md)', 
                          background: '#000',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.75rem' 
                        }}
                      >
                        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxHeight: '200px', borderRadius: '4px', objectFit: 'contain' }}></video>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="button" className="btn btn-primary" onClick={captureSnapshot} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>Take Picture</button>
                          <button type="button" className="btn btn-secondary" onClick={stopCamera} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {showCloudPicker && (
                      <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', background: 'var(--bg-tertiary)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Choose Import App:</span>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }} 
                            onClick={() => {
                              setInvoiceImage(`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="100%" height="100%" fill="%231e293b"/><text x="50%" y="45%" fill="%2338bdf8" font-size="12" font-weight="bold" font-family="monospace" text-anchor="middle">DROPBOX</text><text x="50%" y="65%" fill="%2364748b" font-size="10" font-family="monospace" text-anchor="middle">Mock Invoice Document</text></svg>`);
                              setShowCloudPicker(false);
                            }}
                          >
                            Dropbox
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }} 
                            onClick={() => {
                              setInvoiceImage(`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="100%" height="100%" fill="%230284c7"/><text x="50%" y="45%" fill="%23ffffff" font-size="12" font-weight="bold" font-family="monospace" text-anchor="middle">PHOTOS</text><text x="50%" y="65%" fill="%23cbd5e1" font-size="10" font-family="monospace" text-anchor="middle">Mock Photo Attachment</text></svg>`);
                              setShowCloudPicker(false);
                            }}
                          >
                            Google Photos
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }} 
                            onClick={() => {
                              setInvoiceImage(`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="100%" height="100%" fill="%234f46e5"/><text x="50%" y="45%" fill="%23ffffff" font-size="12" font-weight="bold" font-family="monospace" text-anchor="middle">ONEDRIVE</text><text x="50%" y="65%" fill="%23c7d2fe" font-size="10" font-family="monospace" text-anchor="middle">Mock OneDrive File</text></svg>`);
                              setShowCloudPicker(false);
                            }}
                          >
                            OneDrive
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}

              <div className="grid-cols-2" style={{ alignItems: 'flex-start' }}>
                <div className="form-group">
                  <label>Quantity *</label>
                  <CustomNumberInput
                    value={quantity}
                    onChange={(val) => setQuantity(val === '' ? 0 : Number(val))}
                    placeholder="Quantity"
                    min={0}
                    chips={[1, 5, 10, 50]}
                  />
                </div>

                <div className="form-group">
                  <label>Purchase Price (Rs. / unit) *</label>
                  <CustomNumberInput
                    value={purchasePrice}
                    onChange={(val) => setPurchasePrice(val === '' ? 0 : Number(val))}
                    placeholder="Rate per item"
                    min={0}
                    chips={[10, 50, 100, 500]}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Tax Amount (Total Rs.)</label>
                <CustomNumberInput
                  value={tax}
                  onChange={(val) => setTax(val === '' ? 0 : Number(val))}
                  placeholder="Additional tax/shipping costs"
                  min={0}
                  chips={[0, 10, 50, 100]}
                />
              </div>

              <div 
                style={{
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-md)',
                  backgroundColor: 'var(--bg-tertiary)',
                  fontSize: '0.85rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div className="flex-between">
                  <span>Batch Subtotal:</span>
                  <span>Rs. {formatPrice(quantity * purchasePrice)}</span>
                </div>
                <div className="flex-between" style={{ marginTop: '0.25rem', fontWeight: 600 }}>
                  <span>Total Recorded Cost:</span>
                  <span>Rs. {formatPrice((quantity * purchasePrice) + tax)}</span>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <ArrowUpRight size={18} />
                Submit & Recalculate Average Cost
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Overlay for Invoice Image Enlargement */}
      {enlargedImage && (
        <div className="modal-overlay" onClick={() => setEnlargedImage(null)} style={{ zIndex: 2000 }}>
          <div 
            style={{ 
              position: 'relative', 
              maxWidth: '90vw', 
              maxHeight: '90vh', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setEnlargedImage(null)} 
              style={{ 
                position: 'absolute', 
                top: '-30px', 
                right: '0', 
                background: 'none', 
                border: 'none', 
                color: 'white', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.9rem'
              }}
            >
              <X size={18} /> Close
            </button>
            <img 
              src={enlargedImage} 
              alt="Enlarged invoice view" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '80vh', 
                borderRadius: '8px', 
                boxShadow: 'var(--shadow-lg)' 
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
