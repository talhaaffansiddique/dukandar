import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  ShoppingCart, 
  Briefcase, 
  BarChart3, 
  Sun, 
  Moon, 
  LogOut,
  ShoppingBasket,
  Menu,
  Cloud,
  Settings
} from 'lucide-react';
import { db, type User } from './db/database';
import AuthScreen from './views/AuthScreen';
import DashboardScreen from './views/DashboardScreen';
import InventoryScreen from './views/InventoryScreen';
import PurchaseScreen from './views/PurchaseScreen';
import SalesScreen from './views/SalesScreen';
import OfficeScreen from './views/OfficeScreen';
import ReportsScreen from './views/ReportsScreen';
import SyncScreen from './views/SyncScreen';
import SettingsScreen from './views/SettingsScreen';
import { logSystemFiles } from './utils/fileLogger';

export default function App() {
  // Navigation: 'dashboard', 'inventory', 'purchases', 'sales', 'office', 'reports', 'sync', 'settings'
  const [activeView, setActiveView] = useState<string>('dashboard');
  
  // Sidebar collapsed state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const val = !prev;
      localStorage.setItem('sidebar_collapsed', String(val));
      return val;
    });
  };
  
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // v1.09 File Tracking logger mount trigger
  useEffect(() => {
    logSystemFiles();
  }, []);

  // v1.07 Company Master Branding States
  const [companyLogo, setCompanyLogo] = useState(() => localStorage.getItem('company_logo') || '');
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('company_name') || '');
  const [isBrandingEnabled, setIsBrandingEnabled] = useState(() => localStorage.getItem('toggle_v107_company_branding') !== 'false');

  useEffect(() => {
    const handleProfileUpdate = () => {
      setCompanyLogo(localStorage.getItem('company_logo') || '');
      setCompanyName(localStorage.getItem('company_name') || '');
    };
    const handleSettingsUpdate = () => {
      setIsBrandingEnabled(localStorage.getItem('toggle_v107_company_branding') !== 'false');
    };
    window.addEventListener('company-profile-updated', handleProfileUpdate);
    window.addEventListener('app-settings-updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('company-profile-updated', handleProfileUpdate);
      window.removeEventListener('app-settings-updated', handleSettingsUpdate);
    };
  }, []);

  // v1.07 4-Hour Background Cloud Auto-Sync Loop
  useEffect(() => {
    if (!currentUser) return;

    const runBackgroundSync = async () => {
      const isSyncEnabled = localStorage.getItem('toggle_v107_4hour_sync') !== 'false';
      if (!isSyncEnabled) return;

      try {
        const { autoSyncCloud } = await import('./db/database');
        await autoSyncCloud(currentUser.email);
        localStorage.setItem('last_cloud_sync_time', String(Date.now()));
        window.dispatchEvent(new Event('cloud-sync-completed'));
      } catch (err) {
        console.error('Background auto-sync error:', err);
      }
    };

    // Set 4 hour interval check
    const interval = setInterval(runBackgroundSync, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Fetch logged in user on mount
  useEffect(() => {
    async function loadSession() {
      try {
        const allUsers = await db.users.toArray();
        if (allUsers.length > 0) {
          // Clean/Migrate old user roles and passwords if upgrading database state
          for (const u of allUsers) {
            let changed = false;
            let newRole = u.role;
            if ((u.role as any) === 'STAFF') {
              newRole = 'EMPLOYEE';
              changed = true;
            } else if (u.role === 'ADMIN' && allUsers.length === 1) {
              newRole = 'OWNER';
              changed = true;
            }
            let newPassword = u.password;
            if (!u.password) {
              newPassword = '123456';
              changed = true;
            }
            if (changed) {
              await db.users.update(u.id, { role: newRole, password: newPassword });
            }
          }
        }

        // Check if there is an active logged in user cached in localStorage
        let loggedInEmail = localStorage.getItem('current_user_email');
        if (!loggedInEmail && allUsers.length > 0) {
          // Upgrade path: if no session email, but users exist, default to first user (was logged in prior to 1.03)
          loggedInEmail = allUsers[0].email;
          localStorage.setItem('current_user_email', loggedInEmail);
        }

        if (loggedInEmail) {
          const userObj = await db.users.get(loggedInEmail.toLowerCase());
          if (userObj) {
            // Map legacy role if it loaded from database
            if ((userObj.role as any) === 'STAFF') {
              userObj.role = 'EMPLOYEE';
            }
            setCurrentUser(userObj);
          } else {
            localStorage.removeItem('current_user_email');
          }
        }
      } catch (err) {
        console.error('Session load error', err);
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, []);

  // Update theme html attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Handle Login Success
  const handleLogin = (user: User) => {
    localStorage.setItem('current_user_email', user.email);
    setCurrentUser(user);
    setActiveView('dashboard');
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('current_user_email');
    setCurrentUser(null);
  };

  // Toggle dark/light theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
        <h3 style={{ color: 'var(--primary)' }}>Opening Dukandar...</h3>
      </div>
    );
  }

  // Not logged in: Show auth screen
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLogin} />;
  }

  const isAdminOrOwner = currentUser.role === 'OWNER' || currentUser.role === 'ADMIN';

  // Render view panel
  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardScreen onNavigate={setActiveView} />;
      case 'inventory':
        return <InventoryScreen userRole={currentUser.role} />;
      case 'purchases':
        return <PurchaseScreen userRole={currentUser.role} />;
      case 'sales':
        return <SalesScreen />;
      case 'office':
        return <OfficeScreen userRole={currentUser.role} />;
      case 'reports':
        return <ReportsScreen 
          userEmail={currentUser.email} 
          userName={currentUser.name} 
          userRole={currentUser.role} 
        />;
      case 'sync':
        return <SyncScreen 
          userEmail={currentUser.email} 
          userName={currentUser.name} 
          userRole={currentUser.role} 
        />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <DashboardScreen onNavigate={setActiveView} />;
    }
  };

  // Human readable title
  const getHeaderTitle = () => {
    switch (activeView) {
      case 'dashboard': return 'Business Overview';
      case 'inventory': return 'Inventory Stock';
      case 'purchases': return 'Supplier Purchases';
      case 'sales': return 'Point of Sale (POS)';
      case 'office': return 'Office Accounts & Salaries';
      case 'reports': return 'Reports & Analytics';
      case 'sync': return 'Cloud Backup & Sync';
      case 'settings': return 'Receipt & App Settings';
      default: return 'Store Manager';
    }
  };

  return (
    <div className="app-shell">
      {/* SIDEBAR NAVIGATION (Desktop) */}
      <aside className={`app-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="brand-section" style={{ justifyContent: isSidebarCollapsed ? 'center' : 'space-between', padding: isSidebarCollapsed ? '0.5rem 0' : '0.5rem 0.5rem 1.5rem' }}>
          {!isSidebarCollapsed && (
            <div 
              className="brand-link" 
              onClick={() => setActiveView('dashboard')} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
              title="Go to Dashboard"
            >
              <div className="brand-logo">
                <ShoppingBasket size={22} />
              </div>
              <span className="brand-name">Dukandar</span>
            </div>
          )}
          {isSidebarCollapsed && (
            <div 
              className="brand-logo clickable-logo" 
              onClick={() => setActiveView('dashboard')} 
              style={{ cursor: 'pointer' }} 
              title="Go to Dashboard"
            >
              <ShoppingBasket size={22} />
            </div>
          )}
          <button 
            className="btn btn-icon toggle-sidebar-btn" 
            onClick={toggleSidebar} 
            style={{ padding: '0.25rem' }} 
            title={isSidebarCollapsed ? "Expand Menu" : "Collapse Menu"}
          >
            <Menu size={18} />
          </button>
        </div>

        <nav className="nav-links" style={{ alignItems: isSidebarCollapsed ? 'center' : 'stretch' }}>
          <button 
            className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveView('dashboard')}
            title="Dashboard"
          >
            <LayoutDashboard size={18} />
            {!isSidebarCollapsed && <span>Dashboard</span>}
          </button>

          <button 
            className={`nav-item ${activeView === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveView('inventory')}
            title="Inventory"
          >
            <Package size={18} />
            {!isSidebarCollapsed && <span>Inventory</span>}
          </button>

          {isAdminOrOwner && (
            <button 
              className={`nav-item ${activeView === 'purchases' ? 'active' : ''}`}
              onClick={() => setActiveView('purchases')}
              title="Purchases"
            >
              <ShoppingBag size={18} />
              {!isSidebarCollapsed && <span>Purchases</span>}
            </button>
          )}

          <button 
            className={`nav-item ${activeView === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveView('sales')}
            title="Sales / POS"
          >
            <ShoppingCart size={18} />
            {!isSidebarCollapsed && <span>Sales / POS</span>}
          </button>

          {isAdminOrOwner && (
            <button 
              className={`nav-item ${activeView === 'office' ? 'active' : ''}`}
              onClick={() => setActiveView('office')}
              title="Office Admin"
            >
              <Briefcase size={18} />
              {!isSidebarCollapsed && <span>Office Admin</span>}
            </button>
          )}

          <button 
            className={`nav-item ${activeView === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveView('reports')}
            title="Reports"
          >
            <BarChart3 size={18} />
            {!isSidebarCollapsed && <span>Reports</span>}
          </button>

          <button 
            className={`nav-item ${activeView === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveView('sync')}
            title="Cloud Sync"
          >
            <Cloud size={18} />
            {!isSidebarCollapsed && <span>Cloud Sync</span>}
          </button>

          <button 
            className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveView('settings')}
            title="Settings"
          >
            <Settings size={18} />
            {!isSidebarCollapsed && <span>Settings</span>}
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info" style={{ 
            padding: '0.5rem 0.75rem', 
            borderRadius: 'var(--border-radius-md)',
            flexDirection: isSidebarCollapsed ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}>
            {!isSidebarCollapsed ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser.name}
                </span>
                <span className="role-badge" style={{ fontSize: '0.65rem', alignSelf: 'flex-start' }}>
                  {currentUser.role}
                </span>
              </div>
            ) : (
              <div className="role-badge" style={{ fontSize: '0.75rem', padding: '0.25rem 0.45rem', borderRadius: '4px', textAlign: 'center' }} title={`${currentUser.name} (${currentUser.role})`}>
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <button className="btn btn-icon" onClick={handleLogout} title="Log Out" style={{ padding: '0.25rem' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* VIEW PANEL (Main Body) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* HEADER TOP BAR */}
        <header className="app-header">
          <h2 className="header-title">{getHeaderTitle()}</h2>

          <div className="header-actions">
            {isBrandingEnabled && (companyLogo || companyName) && (
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.65rem', 
                  marginRight: '1rem', 
                  paddingRight: '1rem', 
                  borderRight: '1px solid var(--border-color)',
                  height: '38px'
                }}
              >
                {companyLogo && (
                  <img 
                    src={companyLogo} 
                    alt="Company Logo" 
                    style={{ 
                      width: '38px', 
                      height: '38px', 
                      borderRadius: 'var(--border-radius-md)', 
                      objectFit: 'cover',
                      border: '1px solid var(--border-color)' 
                    }} 
                  />
                )}
                {companyName && (
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {companyName}
                  </span>
                )}
              </div>
            )}
            <button className="btn btn-icon" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </header>

        {/* Dynamic View rendering */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {renderView()}
        </div>
      </div>

      {/* BOTTOM NAVIGATION (Mobile View) */}
      <nav className="app-bottombar">
        <div className="bottombar-links">
          <button 
            className={`bottombar-item ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveView('dashboard')}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>

          <button 
            className={`bottombar-item ${activeView === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveView('inventory')}
          >
            <Package size={20} />
            <span>Stock</span>
          </button>

          {isAdminOrOwner && (
            <button 
              className={`bottombar-item ${activeView === 'purchases' ? 'active' : ''}`}
              onClick={() => setActiveView('purchases')}
            >
              <ShoppingBag size={20} />
              <span>Purchases</span>
            </button>
          )}

          <button 
            className={`bottombar-item ${activeView === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveView('sales')}
          >
            <ShoppingCart size={20} />
            <span>Sales</span>
          </button>

          {isAdminOrOwner && (
            <button 
              className={`bottombar-item ${activeView === 'office' ? 'active' : ''}`}
              onClick={() => setActiveView('office')}
            >
              <Briefcase size={20} />
              <span>Office</span>
            </button>
          )}

          <button 
            className={`bottombar-item ${activeView === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveView('reports')}
          >
            <BarChart3 size={20} />
            <span>Reports</span>
          </button>

          <button 
            className={`bottombar-item ${activeView === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveView('sync')}
          >
            <Cloud size={20} />
            <span>Sync</span>
          </button>

          <button 
            className={`bottombar-item ${activeView === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveView('settings')}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
