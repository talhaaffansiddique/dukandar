import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle, 
  ChevronRight,
  Package,
  ShoppingCart,
  Award
} from 'lucide-react';
import { db, formatPrice } from '../db/database';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface DashboardScreenProps {
  onNavigate: (view: string) => void;
}

export default function DashboardScreen({ onNavigate }: DashboardScreenProps) {
  // Live queries
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const purchases = useLiveQuery(() => db.purchases.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];

  // Clock Widget State
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Trend Chart Visual Type Selector State
  const [chartType, setChartType] = useState<'Area' | 'Column' | 'Pie'>('Area');

  // Feature Toggle Settings
  const isClockEnabled = localStorage.getItem('setting_dashboard_show_clock') !== 'false';
  const clickableKpis = localStorage.getItem('setting_dashboard_clickable_kpis') !== 'false';
  const isChartToggleEnabled = localStorage.getItem('setting_dashboard_chart_toggles') !== 'false';

  const handleKpiClick = (tabIndex: number, filters?: { [key: string]: string }) => {
    if (!clickableKpis) return;
    localStorage.setItem('reports_active_tab', String(tabIndex));
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        localStorage.setItem(`reports_filter_${key}`, val);
      });
    } else {
      localStorage.removeItem('reports_filter_today');
      localStorage.removeItem('reports_filter_ledger_type');
    }
    onNavigate('reports');
  };

  const dayStr = clock.toLocaleDateString('en-US', { weekday: 'short' });
  const dateStr = clock.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // 1. KPI & Today Calculations
  const stats = useMemo(() => {
    let totalSalesVal = 0;
    let salesProfitVal = 0;
    
    // Calculate Today's start timestamp
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTime = todayStart.getTime();

    let todaySalesCount = 0;
    const todayProductQuantities: { [productId: number]: { name: string; quantity: number } } = {};

    // Helper map for quick product name lookup
    const prodMap: { [id: number]: string } = {};
    products.forEach(p => { if (p.id) prodMap[p.id] = p.name; });

    sales.forEach(s => {
      const amount = s.quantity * s.sellingPrice;
      if (s.isReturn === 1) {
        totalSalesVal -= amount;
      } else {
        totalSalesVal += amount;
      }
      salesProfitVal += s.profit;

      // Gather Today's Sales Count and Product Breakdown
      if (s.date >= todayStartTime) {
        if (s.isReturn !== 1) {
          todaySalesCount += 1;
          if (!todayProductQuantities[s.productId]) {
            todayProductQuantities[s.productId] = {
              name: prodMap[s.productId] || 'Unknown Product',
              quantity: 0
            };
          }
          todayProductQuantities[s.productId].quantity += s.quantity;
        } else {
          // If returned today, decrement count/quantity
          if (todayProductQuantities[s.productId]) {
            todayProductQuantities[s.productId].quantity -= s.quantity;
          }
        }
      }
    });

    const totalPurchasesVal = purchases.reduce((sum, p) => sum + (p.quantity * p.purchasePrice), 0);
    const totalExpensesVal = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfitVal = salesProfitVal - totalExpensesVal;

    // ROL alerts
    const lowStockItems = products.filter(p => p.quantity <= p.minStockLevel);

    // Sort and compile Top 10 products sold today
    const topProductsToday = Object.values(todayProductQuantities)
      .filter(item => item.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      totalSales: totalSalesVal,
      totalPurchases: totalPurchasesVal,
      totalExpenses: totalExpensesVal,
      netProfit: netProfitVal,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.slice(0, 5), // show top 5 alerts
      todaySalesCount,
      topProductsToday
    };
  }, [products, sales, purchases, expenses]);

  // 2. Chart Data Generation (Last 7 Days)
  const chartData = useMemo(() => {
    const data: { [key: string]: { dateStr: string; sales: number; profit: number; timestamp: number } } = {};
    const today = new Date();
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      data[dateKey] = {
        dateStr: dateKey,
        sales: 0,
        profit: 0,
        timestamp: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      };
    }

    // Populate from sales
    sales.forEach(s => {
      const sDate = new Date(s.date);
      const dateKey = sDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (data[dateKey]) {
        const amount = s.quantity * s.sellingPrice;
        if (s.isReturn === 1) {
          data[dateKey].sales -= amount;
        } else {
          data[dateKey].sales += amount;
        }
        data[dateKey].profit += s.profit;
      }
    });

    return Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
  }, [sales]);

  return (
    <div className="main-content">
      {/* Welcome Section */}
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '1.85rem' }}>Store Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Real-time analytics and inventory status.
          </p>
        </div>
        {isClockEnabled && (
          <div style={{ textAlign: 'right', fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '0.25rem 0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 600 }}>{dayStr}, {dateStr}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{timeStr}</div>
          </div>
        )}
      </div>

      {/* ROL Alert Banner */}
      {stats.lowStockCount > 0 && (
        <div 
          className="alert-banner alert-banner-danger" 
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('inventory')}
        >
          <AlertTriangle size={24} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold' }}>Reorder Level Alert!</div>
            <div>
              There are <strong>{stats.lowStockCount}</strong> product(s) falling below their minimum stock thresholds.
            </div>
          </div>
          <button className="btn btn-icon" style={{ color: 'inherit' }}>
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div 
          className="kpi-card" 
          onClick={() => handleKpiClick(0)}
          style={{ 
            '--kpi-color': 'var(--primary)', 
            '--kpi-bg': 'var(--primary-light)',
            cursor: clickableKpis ? 'pointer' : 'default',
            transition: 'transform 0.15s ease-in-out',
          } as React.CSSProperties}
          onMouseEnter={(e) => clickableKpis && (e.currentTarget.style.transform = 'scale(1.02)')}
          onMouseLeave={(e) => clickableKpis && (e.currentTarget.style.transform = 'none')}
        >
          <div className="kpi-icon-wrapper">
            <DollarSign size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Sales</span>
            <span className="kpi-value">Rs. {formatPrice(stats.totalSales)}</span>
          </div>
        </div>

        <div 
          className="kpi-card" 
          onClick={() => handleKpiClick(0, { today: 'true' })}
          style={{ 
            '--kpi-color': 'var(--accent-purple)', 
            '--kpi-bg': 'rgba(139, 92, 246, 0.15)',
            cursor: clickableKpis ? 'pointer' : 'default',
            transition: 'transform 0.15s ease-in-out',
          } as React.CSSProperties}
          onMouseEnter={(e) => clickableKpis && (e.currentTarget.style.transform = 'scale(1.02)')}
          onMouseLeave={(e) => clickableKpis && (e.currentTarget.style.transform = 'none')}
        >
          <div className="kpi-icon-wrapper">
            <ShoppingCart size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Today's Sales Count</span>
            <span className="kpi-value">{stats.todaySalesCount} Txns</span>
          </div>
        </div>

        <div 
          className="kpi-card" 
          onClick={() => handleKpiClick(2, { ledger_type: 'ALL' })}
          style={{ 
            '--kpi-color': stats.netProfit >= 0 ? 'var(--success)' : 'var(--danger)', 
            '--kpi-bg': stats.netProfit >= 0 ? 'var(--success-light)' : 'var(--danger-light)',
            cursor: clickableKpis ? 'pointer' : 'default',
            transition: 'transform 0.15s ease-in-out',
          } as React.CSSProperties}
          onMouseEnter={(e) => clickableKpis && (e.currentTarget.style.transform = 'scale(1.02)')}
          onMouseLeave={(e) => clickableKpis && (e.currentTarget.style.transform = 'none')}
        >
          <div className="kpi-icon-wrapper">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Net Profit</span>
            <span className="kpi-value" style={{ color: stats.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              Rs. {formatPrice(stats.netProfit)}
            </span>
          </div>
        </div>

        <div 
          className="kpi-card" 
          onClick={() => handleKpiClick(2, { ledger_type: 'EXPENSE' })}
          style={{ 
            '--kpi-color': 'var(--danger)', 
            '--kpi-bg': 'var(--danger-light)',
            cursor: clickableKpis ? 'pointer' : 'default',
            transition: 'transform 0.15s ease-in-out',
          } as React.CSSProperties}
          onMouseEnter={(e) => clickableKpis && (e.currentTarget.style.transform = 'scale(1.02)')}
          onMouseLeave={(e) => clickableKpis && (e.currentTarget.style.transform = 'none')}
        >
          <div className="kpi-icon-wrapper">
            <TrendingDown size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Expenses</span>
            <span className="kpi-value">Rs. {formatPrice(stats.totalExpenses)}</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Notifications Grid */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: '2fr 1fr', 
          gap: '1.5rem' 
        }}
      >
        {/* Sales Chart */}
        <div className="card" style={{ padding: '1.5rem', minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Weekly Sales & Profit Trend</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Net revenues and margins for the last 7 days.
              </p>
            </div>
            {isChartToggleEnabled && (
              <div style={{ display: 'flex', gap: '0.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '0.15rem' }}>
                <button
                  type="button"
                  className="btn btn-icon"
                  style={{ 
                    padding: '0.35rem 0.50rem', 
                    fontSize: '0.75rem', 
                    fontWeight: 600, 
                    backgroundColor: chartType === 'Area' ? 'var(--primary-light)' : 'transparent', 
                    color: chartType === 'Area' ? 'var(--primary)' : 'var(--text-secondary)',
                    borderRadius: 'var(--border-radius-sm)',
                    height: '28px',
                    width: 'auto'
                  }}
                  onClick={() => setChartType('Area')}
                >
                  Area
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  style={{ 
                    padding: '0.35rem 0.50rem', 
                    fontSize: '0.75rem', 
                    fontWeight: 600, 
                    backgroundColor: chartType === 'Column' ? 'var(--primary-light)' : 'transparent', 
                    color: chartType === 'Column' ? 'var(--primary)' : 'var(--text-secondary)',
                    borderRadius: 'var(--border-radius-sm)',
                    height: '28px',
                    width: 'auto'
                  }}
                  onClick={() => setChartType('Column')}
                >
                  Bar
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  style={{ 
                    padding: '0.35rem 0.50rem', 
                    fontSize: '0.75rem', 
                    fontWeight: 600, 
                    backgroundColor: chartType === 'Pie' ? 'var(--primary-light)' : 'transparent', 
                    color: chartType === 'Pie' ? 'var(--primary)' : 'var(--text-secondary)',
                    borderRadius: 'var(--border-radius-sm)',
                    height: '28px',
                    width: 'auto'
                  }}
                  onClick={() => setChartType('Pie')}
                >
                  Pie
                </button>
              </div>
            )}
          </div>
          
          <div style={{ flex: 1, width: '100%', minHeight: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'Area' ? (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="dateStr" stroke="var(--text-secondary)" fontSize={11} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      borderColor: 'var(--border-color)', 
                      color: 'var(--text-primary)',
                      borderRadius: '8px'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sales" 
                    name="Net Sales (Rs.)"
                    stroke="var(--primary)" 
                    fillOpacity={1} 
                    fill="url(#colorSales)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="profit" 
                    name="Gross Profit (Rs.)"
                    stroke="var(--success)" 
                    fillOpacity={1} 
                    fill="url(#colorProfit)" 
                  />
                </AreaChart>
              ) : chartType === 'Column' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="dateStr" stroke="var(--text-secondary)" fontSize={11} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      borderColor: 'var(--border-color)', 
                      color: 'var(--text-primary)',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar 
                    dataKey="sales" 
                    name="Net Sales (Rs.)"
                    fill="var(--primary)" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    dataKey="profit" 
                    name="Gross Profit (Rs.)"
                    fill="var(--success)" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              ) : (
                <PieChart>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      borderColor: 'var(--border-color)', 
                      color: 'var(--text-primary)',
                      borderRadius: '8px'
                    }} 
                  />
                  <Pie
                    data={chartData.filter(d => d.sales > 0)}
                    dataKey="sales"
                    nameKey="dateStr"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    fill="var(--primary)"
                    label={(props: any) => `${props.name}: ${((props.percent || 0) * 100).toFixed(0)}%`}
                  >
                    {chartData.filter(d => d.sales > 0).map((_entry, index) => {
                      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stacked Right Column: Top 10 Products Sold Today & ROL Notifications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Top 10 Products Sold Today */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={18} style={{ color: 'gold' }} /> Top Products Sold Today
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Highest quantities sold since midnight.
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '200px', overflowY: 'auto' }}>
              {stats.topProductsToday.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem', padding: '1.5rem 0' }}>
                  No products sold yet today.
                </div>
              ) : (
                stats.topProductsToday.map((p, idx) => (
                  <div key={idx} className="flex-between" style={{ padding: '0.4rem 0.5rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                      {idx + 1}. {p.name}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {p.quantity.toFixed(2)} units
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ROL Notifications */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>ROL Notifications</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Items needing stock replenishment.
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
              {stats.lowStockItems.length === 0 ? (
                <div 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'var(--text-tertiary)',
                    gap: '0.5rem',
                    padding: '1.5rem 0'
                  }}
                >
                  <Package size={28} />
                  <span style={{ fontSize: '0.85rem' }}>All stock levels healthy!</span>
                </div>
              ) : (
                stats.lowStockItems.map(item => (
                  <div 
                    key={item.id}
                    style={{
                      padding: '0.75rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem',
                      backgroundColor: 'var(--bg-tertiary)'
                    }}
                  >
                    <div className="flex-between">
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.name}</span>
                      <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>Low Stock</span>
                    </div>
                    <div className="flex-between" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>Qty: <strong>{item.quantity.toFixed(2)}</strong> / Min: {item.minStockLevel}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {stats.lowStockCount > 5 && (
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem' }}
                onClick={() => onNavigate('inventory')}
              >
                View all ({stats.lowStockCount})
              </button>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
