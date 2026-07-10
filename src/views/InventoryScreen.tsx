import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Edit2, Sliders, Trash2, Search, AlertCircle, X, Package, Tag, Layers, Image as ImageIcon } from 'lucide-react';
import { db, adjustStockManual, formatPrice, type Product } from '../db/database';
import { useTableSort, renderSortIcon } from '../hooks/useTableSort';
import CustomNumberInput from '../components/CustomNumberInput';

interface InventoryScreenProps {
  userRole: 'OWNER' | 'ADMIN' | 'EMPLOYEE';
}

export default function InventoryScreen({ userRole }: InventoryScreenProps) {
  const products = useLiveQuery(() => db.products.toArray()) || [];
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  
  // Selected product state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Form fields (Add / Edit)
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState<string>(''); // string to handle empty inputs cleanly
  const [sellingPrice, setSellingPrice] = useState(0);
  const [minStockLevel, setMinStockLevel] = useState(5);
  const [warrantyValue, setWarrantyValue] = useState<string>('');
  const [warrantyUnit, setWarrantyUnit] = useState<'Months' | 'Years'>('Months');

  // v1.07 Product Pictures & Slideshow States
  const [productImages, setProductImages] = useState<string[]>([]);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [slideshowProduct, setSlideshowProduct] = useState<Product | null>(null);
  const [slideshowIndex, setSlideshowIndex] = useState(0);

  const isProductImageEnabled = true;
  const isStockSlideshowEnabled = true;

  // Slideshow auto-advance effect (5 seconds)
  useEffect(() => {
    if (!slideshowProduct || !slideshowProduct.images || slideshowProduct.images.length <= 1) return;
    const interval = setInterval(() => {
      setSlideshowIndex(prev => (prev + 1) % slideshowProduct.images!.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slideshowProduct, slideshowIndex]);

  const handleProductPictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (productImages.length >= 3) {
      alert('Maximum 3 images allowed per product.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setProductImages(prev => [...prev, reader.result as string]);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProductImage = (idx: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== idx));
  };
  
  // Form fields (Adjustment)
  const [adjustmentValue, setAdjustmentValue] = useState(0);

  const isAdmin = userRole === 'ADMIN' || userRole === 'OWNER';

  // Filtered products list
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Apply sorting hook
  const { sortedData: sortedProducts, requestSort, sortConfig } = useTableSort(filteredProducts, {
    key: 'name',
    direction: 'asc'
  });

  // Form submission: Add
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert('Please fill out the Product Name.');
      return;
    }
    
    // Barcode (SKU) is non-mandatory. Generate auto code if blank.
    let finalSku = sku.trim();
    if (!finalSku) {
      finalSku = `AUTO-SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    } else {
      // Check unique SKU
      const existing = products.find(p => p.sku.toLowerCase() === finalSku.toLowerCase());
      if (existing) {
        alert('A product with this SKU/Barcode already exists!');
        return;
      }
    }

    const numericQuantity = quantity === '' ? 0 : Number(quantity);
    const finalSellingPrice = sellingPrice || 0;

    const finalWarrantyValue = warrantyValue === '' ? undefined : Number(warrantyValue);
    const finalWarrantyUnit = finalWarrantyValue ? warrantyUnit : undefined;

    if (finalWarrantyUnit === 'Months' && finalWarrantyValue && finalWarrantyValue > 12) {
      alert('Warranty in Months cannot exceed 12. Please select "Years" or input 12 or less.');
      return;
    }

    try {
      await db.products.add({
        sku: finalSku,
        name,
        quantity: numericQuantity,
        purchasePrice: 0, 
        sellingPrice: finalSellingPrice,
        minStockLevel: minStockLevel || 0,
        averageCost: 0, 
        warrantyValue: finalWarrantyValue,
        warrantyUnit: finalWarrantyUnit,
        images: isProductImageEnabled ? productImages : undefined
      });
      setIsAddModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Failed to add product.');
    }
  };

  // Form submission: Edit
  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct?.id || !name) return;

    // Barcode (SKU) is optional.
    let finalSku = sku.trim();
    if (!finalSku) {
      finalSku = `AUTO-SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    const finalSellingPrice = sellingPrice || 0;

    const finalWarrantyValue = warrantyValue === '' ? undefined : Number(warrantyValue);
    const finalWarrantyUnit = finalWarrantyValue ? warrantyUnit : undefined;

    if (finalWarrantyUnit === 'Months' && finalWarrantyValue && finalWarrantyValue > 12) {
      alert('Warranty in Months cannot exceed 12. Please select "Years" or input 12 or less.');
      return;
    }

    try {
      await db.products.update(selectedProduct.id, {
        sku: finalSku,
        name,
        sellingPrice: finalSellingPrice,
        minStockLevel: minStockLevel || 0,
        warrantyValue: finalWarrantyValue,
        warrantyUnit: finalWarrantyUnit,
        images: isProductImageEnabled ? productImages : undefined
      });
      setIsEditModalOpen(false);
      setSelectedProduct(null);
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Failed to edit product.');
    }
  };

  // Form submission: Adjust Stock
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct?.id) return;
    try {
      await adjustStockManual(selectedProduct.id, adjustmentValue);
      setIsAdjustModalOpen(false);
      setSelectedProduct(null);
      setAdjustmentValue(0);
    } catch (err) {
      console.error(err);
      alert('Failed to adjust stock.');
    }
  };

  // Trigger Delete
  const handleDeleteProduct = async (product: Product) => {
    if (!product.id) return;
    if (confirm(`Are you sure you want to delete ${product.name}?`)) {
      try {
        await db.products.delete(product.id);
      } catch (err) {
        console.error(err);
        alert('Failed to delete product.');
      }
    }
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setSku(product.sku.startsWith('AUTO-SKU-') ? '' : product.sku);
    setName(product.name);
    setSellingPrice(product.sellingPrice);
    setMinStockLevel(product.minStockLevel);
    setWarrantyValue(product.warrantyValue !== undefined && product.warrantyValue > 0 ? String(product.warrantyValue) : '');
    setWarrantyUnit(product.warrantyUnit || 'Months');
    setProductImages(product.images || []);
    setIsEditModalOpen(true);
  };

  const openAdjustModal = (product: Product) => {
    setSelectedProduct(product);
    setAdjustmentValue(0);
    setIsAdjustModalOpen(true);
  };

  const resetForm = () => {
    setSku('');
    setName('');
    setQuantity('');
    setSellingPrice(0);
    setMinStockLevel(5);
    setWarrantyValue('');
    setWarrantyUnit('Months');
    setProductImages([]);
  };

  const isQuantityValid = quantity !== '' && !isNaN(Number(quantity));

  return (
    <div className="main-content">
      {/* Header section */}
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '1.85rem' }}>Product Master Directory</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Central inventory tracking and stock adjustments.
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setIsAddModalOpen(true); }}>
            <Plus size={18} />
            Add Product
          </button>
        )}
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
            placeholder="Search by Barcode or product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th onClick={() => requestSort('sku')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Barcode / SKU {renderSortIcon('sku', sortConfig)}
              </th>
              <th onClick={() => requestSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Product Name {renderSortIcon('name', sortConfig)}
              </th>
              <th onClick={() => requestSort('quantity')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Stock Qty {renderSortIcon('quantity', sortConfig)}
              </th>
              <th onClick={() => requestSort('averageCost')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Avg Purchase Cost {renderSortIcon('averageCost', sortConfig)}
              </th>
              <th onClick={() => requestSort('sellingPrice')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Retail Selling Price {renderSortIcon('sellingPrice', sortConfig)}
              </th>
              <th onClick={() => requestSort('minStockLevel')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Status {renderSortIcon('minStockLevel', sortConfig)}
              </th>
              <th onClick={() => requestSort('warrantyValue')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Warranty {renderSortIcon('warrantyValue', sortConfig)}
              </th>
              <th onClick={() => requestSort('quantity')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Available Quantity {renderSortIcon('quantity', sortConfig)}
              </th>
              {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sortedProducts.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  No products registered. Create a product profile to get started.
                </td>
              </tr>
            ) : (
              sortedProducts.map(product => {
                const isLowStock = product.quantity <= product.minStockLevel;
                const displaySku = product.sku.startsWith('AUTO-SKU-') ? 'None' : product.sku;
                return (
                  <tr key={product.id}>
                    <td style={{ fontWeight: 600, color: displaySku === 'None' ? 'var(--text-tertiary)' : 'inherit' }}>
                      {displaySku}
                    </td>
                    <td style={{ fontWeight: 500 }}>{product.name}</td>
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ color: isLowStock ? 'var(--danger)' : 'inherit' }}>
                        {product.quantity.toFixed(2)}
                      </span>
                    </td>
                    <td>Rs. {formatPrice(product.averageCost)}</td>
                    <td>Rs. {formatPrice(product.sellingPrice)}</td>
                    <td>
                      {isLowStock ? (
                        <span className="badge badge-danger flex-gap" style={{ display: 'inline-flex' }}>
                          <AlertCircle size={12} /> Low Stock (ROL)
                        </span>
                      ) : (
                        <span className="badge badge-success">Healthy</span>
                      )}
                    </td>
                    <td>
                      {product.warrantyValue && product.warrantyValue > 0 ? (
                        <span>{product.warrantyValue} {product.warrantyUnit}</span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>No Warranty</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {product.quantity.toFixed(2)}
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                          {isStockSlideshowEnabled && product.images && product.images.length > 0 && (
                            <button 
                              className="btn btn-icon" 
                              title="View Product Images"
                              onClick={() => {
                                setSlideshowProduct(product);
                                setSlideshowIndex(0);
                              }}
                            >
                              <ImageIcon size={16} style={{ color: 'var(--primary)' }} />
                            </button>
                          )}
                          <button 
                            className="btn btn-icon" 
                            title="Adjust Stock"
                            onClick={() => openAdjustModal(product)}
                          >
                            <Sliders size={16} />
                          </button>
                          <button 
                            className="btn btn-icon" 
                            title="Edit Details"
                            onClick={() => openEditModal(product)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            className="btn btn-icon" 
                            style={{ color: 'var(--danger)' }}
                            title="Delete Product"
                            onClick={() => handleDeleteProduct(product)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: Add Product */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h3>Add New Product</h3>
              <button className="btn btn-icon" onClick={() => setIsAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddProduct}>
              <div className="form-group">
                <label>Barcode / SKU (Optional)</label>
                <div style={{ position: 'relative' }}>
                  <Tag size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    className="input-control"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="Auto-generates if left blank"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Product Name *</label>
                <div style={{ position: 'relative' }}>
                  <Package size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    className="input-control"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="e.g. Milk Pack 1L"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid-cols-2" style={{ alignItems: 'flex-start' }}>
                <div className="form-group">
                  <label>Initial Stock Qty</label>
                  <CustomNumberInput
                    value={quantity === '' ? '' : Number(quantity)}
                    onChange={(val) => setQuantity(val === '' ? '' : String(val))}
                    placeholder="0.00"
                    min={0}
                    icon={<Layers size={16} />}
                    chips={[0, 5, 10, 50]}
                  />
                </div>

                <div className="form-group">
                  <label>Retail Selling Price (Rs. - Optional)</label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Tag size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-tertiary)' }} />
                      <input
                        type="number"
                        step="any"
                        className="input-control"
                        style={{ paddingLeft: '2.5rem', width: '100%' }}
                        placeholder={isQuantityValid ? "0.00" : "Disabled (Enter stock quantity first)"}
                        value={sellingPrice || ''}
                        onChange={(e) => setSellingPrice(Number(e.target.value))}
                        disabled={!isQuantityValid}
                      />
                    </div>
                    {/* Spacer to align columns due to chips layout */}
                    <div style={{ height: '24px', marginTop: '0.1rem', visibility: 'hidden' }}>Spacer</div>
                  </div>
                </div>
              </div>

              <div className="grid-cols-2" style={{ alignItems: 'flex-start' }}>
                <div className="form-group">
                  <label>Warranty (Optional)</label>
                  <CustomNumberInput
                    value={warrantyValue === '' ? '' : Number(warrantyValue)}
                    onChange={(val) => {
                      if (warrantyUnit === 'Months' && val !== '' && val > 12) {
                        setWarrantyValue('12');
                      } else {
                        setWarrantyValue(val === '' ? '' : String(val));
                      }
                    }}
                    placeholder="Value (e.g. 12)"
                    min={0}
                    max={warrantyUnit === 'Months' ? 12 : undefined}
                    chips={warrantyUnit === 'Months' ? [0, 3, 6, 12] : [0, 1, 2, 5]}
                  />
                </div>

                <div className="form-group">
                  <label>Warranty Unit</label>
                  <select
                    className="input-control"
                    value={warrantyUnit}
                    onChange={(e) => {
                      const unit = e.target.value as 'Months' | 'Years';
                      setWarrantyUnit(unit);
                      if (unit === 'Months' && warrantyValue !== '' && Number(warrantyValue) > 12) {
                        setWarrantyValue('12');
                      }
                    }}
                  >
                    <option value="Months">Months</option>
                    <option value="Years">Years</option>
                  </select>
                  {/* Spacer to align with chips */}
                  <div style={{ height: '24px', marginTop: '0.1rem', visibility: 'hidden' }}>Spacer</div>
                </div>
              </div>

              {/* Product Picture uploads (v1.07) */}
              {isProductImageEnabled && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label>Product Pictures (Max 3)</label>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {productImages.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '64px', height: '64px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        <img 
                          src={img} 
                          alt="preview" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} 
                          onClick={() => setEnlargedImage(img)}
                        />
                        <button 
                          type="button" 
                          onClick={() => handleRemoveProductImage(idx)}
                          style={{ 
                            position: 'absolute', 
                            top: '2px', 
                            right: '2px', 
                            backgroundColor: 'rgba(239, 68, 68, 0.85)', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '50%', 
                            width: '16px', 
                            height: '16px', 
                            fontSize: '10px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0 
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {productImages.length < 3 && (
                      <label style={{ width: '64px', height: '64px', borderRadius: 'var(--border-radius-sm)', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)' }}>
                        <Plus size={16} />
                        <span style={{ fontSize: '0.6rem', marginTop: '2px' }}>Upload</span>
                        <input type="file" accept="image/*" onChange={handleProductPictureUpload} style={{ display: 'none' }} />
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Min. Stock Level (ROL Threshold)</label>
                <CustomNumberInput
                  value={minStockLevel}
                  onChange={(val) => setMinStockLevel(val === '' ? 0 : Number(val))}
                  placeholder="5"
                  min={0}
                  icon={<AlertCircle size={16} />}
                  chips={[0, 2, 5, 10]}
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)', marginBottom: '1rem' }}>
                Note: Purchase price is managed under Supplier Purchases and computes weighted average costs automatically.
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Create Product Master
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Product */}
      {isEditModalOpen && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h3>Edit Product</h3>
              <button className="btn btn-icon" onClick={() => { setIsEditModalOpen(false); setSelectedProduct(null); }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditProduct}>
              <div className="form-group">
                <label>Barcode / SKU (Optional)</label>
                <div style={{ position: 'relative' }}>
                  <Tag size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    className="input-control"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="Auto-generates if left blank"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Product Name *</label>
                <div style={{ position: 'relative' }}>
                  <Package size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    className="input-control"
                    style={{ paddingLeft: '2.5rem' }}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Retail Selling Price (Rs. - Optional)</label>
                <div style={{ position: 'relative' }}>
                  <Tag size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="number"
                    step="any"
                    className="input-control"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="0.00"
                    value={sellingPrice || ''}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid-cols-2" style={{ alignItems: 'flex-start' }}>
                <div className="form-group">
                  <label>Warranty (Optional)</label>
                  <CustomNumberInput
                    value={warrantyValue === '' ? '' : Number(warrantyValue)}
                    onChange={(val) => {
                      if (warrantyUnit === 'Months' && val !== '' && val > 12) {
                        setWarrantyValue('12');
                      } else {
                        setWarrantyValue(val === '' ? '' : String(val));
                      }
                    }}
                    placeholder="Value (e.g. 12)"
                    min={0}
                    max={warrantyUnit === 'Months' ? 12 : undefined}
                    chips={warrantyUnit === 'Months' ? [0, 3, 6, 12] : [0, 1, 2, 5]}
                  />
                </div>

                <div className="form-group">
                  <label>Warranty Unit</label>
                  <select
                    className="input-control"
                    value={warrantyUnit}
                    onChange={(e) => {
                      const unit = e.target.value as 'Months' | 'Years';
                      setWarrantyUnit(unit);
                      if (unit === 'Months' && warrantyValue !== '' && Number(warrantyValue) > 12) {
                        setWarrantyValue('12');
                      }
                    }}
                  >
                    <option value="Months">Months</option>
                    <option value="Years">Years</option>
                  </select>
                  {/* Spacer to align with chips */}
                  <div style={{ height: '24px', marginTop: '0.1rem', visibility: 'hidden' }}>Spacer</div>
                </div>
              </div>

              {/* Product Picture uploads (v1.07) */}
              {isProductImageEnabled && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label>Product Pictures (Max 3)</label>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {productImages.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '64px', height: '64px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        <img 
                          src={img} 
                          alt="preview" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} 
                          onClick={() => setEnlargedImage(img)}
                        />
                        <button 
                          type="button" 
                          onClick={() => handleRemoveProductImage(idx)}
                          style={{ 
                            position: 'absolute', 
                            top: '2px', 
                            right: '2px', 
                            backgroundColor: 'rgba(239, 68, 68, 0.85)', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '50%', 
                            width: '16px', 
                            height: '16px', 
                            fontSize: '10px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0 
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {productImages.length < 3 && (
                      <label style={{ width: '64px', height: '64px', borderRadius: 'var(--border-radius-sm)', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)' }}>
                        <Plus size={16} />
                        <span style={{ fontSize: '0.6rem', marginTop: '2px' }}>Upload</span>
                        <input type="file" accept="image/*" onChange={handleProductPictureUpload} style={{ display: 'none' }} />
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Min. Stock Level (ROL Threshold)</label>
                <CustomNumberInput
                  value={minStockLevel}
                  onChange={(val) => setMinStockLevel(val === '' ? 0 : Number(val))}
                  placeholder="5"
                  min={0}
                  icon={<AlertCircle size={16} />}
                  chips={[0, 2, 5, 10]}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adjust Stock Manual */}
      {isAdjustModalOpen && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h3>Manual Stock Adjustment</h3>
              <button className="btn btn-icon" onClick={() => { setIsAdjustModalOpen(false); setSelectedProduct(null); }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              Product: <strong>{selectedProduct.name}</strong><br/>
              Current Quantity: <strong>{selectedProduct.quantity.toFixed(2)}</strong>
            </div>

            <form onSubmit={handleAdjustStock}>
              <div className="form-group">
                <label>Adjustment Value (e.g. +5 to add stock, -3 to write-off stock)</label>
                <CustomNumberInput
                  value={adjustmentValue}
                  onChange={(val) => setAdjustmentValue(val === '' ? 0 : Number(val))}
                  placeholder="Enter positive or negative quantity"
                  chips={[-10, -5, -1, 1, 5, 10]}
                />
              </div>

              <div className="flex-gap" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { setIsAdjustModalOpen(false); setSelectedProduct(null); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Overlay for Product Image Enlargement */}
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
              alt="Enlarged view" 
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

      {/* Automatic Slideshow Lightbox Modal */}
      {slideshowProduct && slideshowProduct.images && slideshowProduct.images.length > 0 && (
        <div className="modal-overlay" onClick={() => setSlideshowProduct(null)} style={{ zIndex: 1999 }}>
          <div 
            style={{ 
              position: 'relative', 
              width: '450px',
              maxWidth: '95vw',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-md)',
              padding: '1.5rem',
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: 'var(--shadow-xl)'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-between" style={{ width: '100%', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{slideshowProduct.name} - Gallery</h3>
              <button className="btn btn-icon" onClick={() => setSlideshowProduct(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '300px', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img 
                src={slideshowProduct.images[slideshowIndex]} 
                alt={`${slideshowProduct.name} slide`} 
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
              
              {/* Manual Left Arrow */}
              {slideshowProduct.images.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSlideshowIndex(prev => (prev - 1 + slideshowProduct.images!.length) % slideshowProduct.images!.length)}
                  style={{ position: 'absolute', left: '10px', backgroundColor: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}
                  title="Previous Image"
                >
                  ‹
                </button>
              )}

              {/* Manual Right Arrow */}
              {slideshowProduct.images.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSlideshowIndex(prev => (prev + 1) % slideshowProduct.images!.length)}
                  style={{ position: 'absolute', right: '10px', backgroundColor: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}
                  title="Next Image"
                >
                  ›
                </button>
              )}
            </div>

            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.25rem' }}>
              {slideshowProduct.images.map((_, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    backgroundColor: idx === slideshowIndex ? 'var(--primary)' : 'var(--text-tertiary)',
                    transition: 'all 0.2s ease'
                  }} 
                />
              ))}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Slide {slideshowIndex + 1} of {slideshowProduct.images.length} (Auto-advances every 5s)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
