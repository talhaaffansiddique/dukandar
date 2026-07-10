import { useState } from 'react';
import { ToggleLeft, ToggleRight, Settings, Receipt, Monitor, Sparkles, Building2, Upload, CheckSquare, Square, Copy, Check, ExternalLink } from 'lucide-react';

export default function SettingsScreen() {
  // Existing v1.06 Toggles
  const [showTotalItems, setShowTotalItems] = useState(() => localStorage.getItem('setting_receipt_show_total_items') !== 'false');
  const [showClock, setShowClock] = useState(() => localStorage.getItem('setting_dashboard_show_clock') !== 'false');
  const [clickableKpis, setClickableKpis] = useState(() => localStorage.getItem('setting_dashboard_clickable_kpis') !== 'false');
  const [chartToggles, setChartToggles] = useState(() => localStorage.getItem('setting_dashboard_chart_toggles') !== 'false');
  const [checkoutPreview, setCheckoutPreview] = useState(() => localStorage.getItem('setting_pos_checkout_preview') !== 'false');
  const [refundOptional, setRefundOptional] = useState(() => localStorage.getItem('setting_pos_refund_optional_fields') !== 'false');
  const [monthlyReset, setMonthlyReset] = useState(() => localStorage.getItem('setting_pos_receipt_id_monthly_reset') !== 'false');
  const [cartWarrantyEditor, setCartWarrantyEditor] = useState(() => localStorage.getItem('setting_pos_cart_warranty_editor') !== 'false');

  // New v1.07 Toggles
  const [simulateApk, setSimulateApk] = useState(() => localStorage.getItem('setting_simulate_apk') === 'true');

  // v1.07 Feature Reversion Checkbox list
  const [featureCompanyBranding, setFeatureCompanyBranding] = useState(() => localStorage.getItem('toggle_v107_company_branding') !== 'false');
  const [feature4HourSync, setFeature4HourSync] = useState(() => localStorage.getItem('toggle_v107_4hour_sync') !== 'false');
  const [featurePurchaseImages, setFeaturePurchaseImages] = useState(() => localStorage.getItem('toggle_v107_purchase_images') !== 'false');
  const [featureProductImages, setFeatureProductImages] = useState(() => localStorage.getItem('toggle_v107_product_images') !== 'false');
  const [featureStockSlideshow, setFeatureStockSlideshow] = useState(() => localStorage.getItem('toggle_v107_stock_slideshow') !== 'false');

  // v1.08 Feature Toggles
  const [featureSettingsSubcategories, setFeatureSettingsSubcategories] = useState(() => localStorage.getItem('toggle_v108_settings_subcategories') !== 'false');

  // v1.09 Feature Toggles
  const [featureFileTracker, setFeatureFileTracker] = useState(() => localStorage.getItem('toggle_v109_file_tracker') !== 'false');

  // v1.10 Feature Toggles & Google OAuth Configurations
  const [featureGoogleOauth, setFeatureGoogleOauth] = useState(() => localStorage.getItem('toggle_v110_google_oauth') !== 'false');
  const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('setting_google_client_id') || '');
  const [redirectUriCopied, setRedirectUriCopied] = useState(false);
  const oauthRedirectUri = window.location.origin + import.meta.env.BASE_URL + 'google-oauth-callback.html';

  const copyRedirectUri = () => {
    navigator.clipboard.writeText(oauthRedirectUri).then(() => {
      setRedirectUriCopied(true);
      setTimeout(() => setRedirectUriCopied(false), 2000);
    });
  };

  // Company Master Profile State
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('company_name') || '');
  const [companyInfo, setCompanyInfo] = useState(() => localStorage.getItem('company_info') || '');
  const [companyLogo, setCompanyLogo] = useState(() => localStorage.getItem('company_logo') || '');

  const toggleSetting = (key: string, value: boolean, setter: (val: boolean) => void) => {
    localStorage.setItem(key, String(!value));
    setter(!value);
    // Dispatch update event for App.tsx
    window.dispatchEvent(new Event('app-settings-updated'));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setCompanyLogo(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCompanyProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('company_name', companyName.trim());
    localStorage.setItem('company_info', companyInfo.trim());
    localStorage.setItem('company_logo', companyLogo);
    
    // Notify app of profile changes
    window.dispatchEvent(new Event('company-profile-updated'));
    alert('Company Master profile updated successfully!');
  };

  const handleClearCompanyProfile = () => {
    if (confirm('Clear custom company branding and revert to default?')) {
      setCompanyName('');
      setCompanyInfo('');
      setCompanyLogo('');
      localStorage.removeItem('company_name');
      localStorage.removeItem('company_info');
      localStorage.removeItem('company_logo');
      window.dispatchEvent(new Event('company-profile-updated'));
    }
  };

  return (
    <div className="main-content">
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.85rem', display: 'flex', alignItems: 'center', gap: '0.50rem' }}>
          <Settings size={28} /> Receipt & App Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Configure company details, manage printing templates, and customize app preferences.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Left Column: Company Master */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {featureSettingsSubcategories && (
            <h2 style={{ fontSize: '1.35rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Building2 size={22} style={{ color: 'var(--primary)' }} /> Company Master
            </h2>
          )}
          
          <form className="card" onSubmit={handleSaveCompanyProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', margin: 0 }}>
              <Building2 size={20} style={{ color: 'var(--primary)' }} /> Company Master Directory
            </h3>

            <div className="form-group">
              <label>Company Name</label>
              <input
                type="text"
                className="input-control"
                placeholder="Enter Company Name (e.g. Waseem Shop)"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Company Contact & Address Info</label>
              <textarea
                className="input-control"
                style={{ minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }}
                placeholder="Enter address, telephone, email, and tax registry..."
                value={companyInfo}
                onChange={(e) => setCompanyInfo(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Company Header Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                <div 
                  style={{ 
                    width: '50px', 
                    height: '50px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}
                >
                  {companyLogo ? (
                    <img src={companyLogo} alt="Logo Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Building2 size={24} style={{ color: 'var(--text-tertiary)' }} />
                  )}
                </div>
                <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  <Upload size={16} /> Upload Logo
                  <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                </label>
              </div>
              <small style={{ color: 'var(--text-tertiary)', display: 'block', marginTop: '0.5rem' }}>
                Note: Image will automatically scale to match the header brand dimensions (38x38px).
              </small>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Save Company Profile
              </button>
              {(companyName || companyLogo || companyInfo) && (
                <button type="button" className="btn btn-danger" onClick={handleClearCompanyProfile} style={{ padding: '0.5rem 1rem' }}>
                  Clear Profile
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Column: App Setting */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {featureSettingsSubcategories && (
            <h2 style={{ fontSize: '1.35rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Settings size={22} style={{ color: 'var(--primary)' }} /> App Setting
            </h2>
          )}
          
          {/* POS Receipt Layout */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', margin: 0 }}>
              <Receipt size={20} style={{ color: 'var(--primary)' }} /> POS Receipt Layout
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Show Total Items Count</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Prints the total quantity of items purchased at the footer.</span>
                </div>
                <button 
                  type="button"
                  className="btn btn-icon"
                  onClick={() => toggleSetting('setting_receipt_show_total_items', showTotalItems, setShowTotalItems)}
                  style={{ color: showTotalItems ? 'var(--primary)' : 'var(--text-tertiary)' }}
                >
                  {showTotalItems ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Monthly Suffix Sequence Reset</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Resets receipt ID sequence numbers to 0001 on the 1st of every month (Prefix: RCP).</span>
                </div>
                <button 
                  type="button"
                  className="btn btn-icon"
                  onClick={() => toggleSetting('setting_pos_receipt_id_monthly_reset', monthlyReset, setMonthlyReset)}
                  style={{ color: monthlyReset ? 'var(--primary)' : 'var(--text-tertiary)' }}
                >
                  {monthlyReset ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Cart Warranty Override Editor</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Allows sales staff to override and edit warranty details directly in the cart list.</span>
                </div>
                <button 
                  type="button"
                  className="btn btn-icon"
                  onClick={() => toggleSetting('setting_pos_cart_warranty_editor', cartWarrantyEditor, setCartWarrantyEditor)}
                  style={{ color: cartWarrantyEditor ? 'var(--primary)' : 'var(--text-tertiary)' }}
                >
                  {cartWarrantyEditor ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
              </div>
            </div>
          </div>

          {/* App & Dashboard Customizations */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', margin: 0 }}>
              <Monitor size={20} style={{ color: 'var(--accent-purple)' }} /> App & Dashboard Customizations
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Dashboard Date & Clock Widget</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Show current day, date, and local time on top-right of store dashboard.</span>
                </div>
                <button 
                  type="button"
                  className="btn btn-icon"
                  onClick={() => toggleSetting('setting_dashboard_show_clock', showClock, setShowClock)}
                  style={{ color: showClock ? 'var(--primary)' : 'var(--text-tertiary)' }}
                >
                  {showClock ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Clickable Dashboard KPI Cards</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Navigate directly to related analytics pages by clicking dashboard KPI numbers.</span>
                </div>
                <button 
                  type="button"
                  className="btn btn-icon"
                  onClick={() => toggleSetting('setting_dashboard_clickable_kpis', clickableKpis, setClickableKpis)}
                  style={{ color: clickableKpis ? 'var(--primary)' : 'var(--text-tertiary)' }}
                >
                  {clickableKpis ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Weekly Trend Multi-Chart Selector</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Allows toggle buttons to switch trend graphs between Area, Bar, and Pie.</span>
                </div>
                <button 
                  type="button"
                  className="btn btn-icon"
                  onClick={() => toggleSetting('setting_dashboard_chart_toggles', chartToggles, setChartToggles)}
                  style={{ color: chartToggles ? 'var(--primary)' : 'var(--text-tertiary)' }}
                >
                  {chartToggles ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>POS Checkout Preview Confirmation</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Show receipt print overlay modal for approval *before* finalizing sales registry.</span>
                </div>
                <button 
                  type="button"
                  className="btn btn-icon"
                  onClick={() => toggleSetting('setting_pos_checkout_preview', checkoutPreview, setCheckoutPreview)}
                  style={{ color: checkoutPreview ? 'var(--primary)' : 'var(--text-tertiary)' }}
                >
                  {checkoutPreview ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>POS Refund Optional Inputs</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Make Customer Name, Refund Price, and Receipt No non-mandatory in returns.</span>
                </div>
                <button 
                  type="button"
                  className="btn btn-icon"
                  onClick={() => toggleSetting('setting_pos_refund_optional_fields', refundOptional, setRefundOptional)}
                  style={{ color: refundOptional ? 'var(--primary)' : 'var(--text-tertiary)' }}
                >
                  {refundOptional ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>Simulate Mobile APK View</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Simulate webview/mobile layout to test cordova native camera snapshot functionality.</span>
                </div>
                <button 
                  type="button"
                  className="btn btn-icon"
                  onClick={() => toggleSetting('setting_simulate_apk', simulateApk, setSimulateApk)}
                  style={{ color: simulateApk ? 'var(--primary)' : 'var(--text-tertiary)' }}
                >
                  {simulateApk ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
              </div>
            </div>
          </div>

          {/* Version Feature Controls */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', margin: 0 }}>
              <CheckSquare size={20} style={{ color: 'var(--primary)' }} /> Version Feature Controls
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Uncheck any feature below to disable and instantly revert that capability:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>
              {/* v1.08 Feature */}
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                onClick={() => toggleSetting('toggle_v108_settings_subcategories', featureSettingsSubcategories, setFeatureSettingsSubcategories)}
              >
                {featureSettingsSubcategories ? <CheckSquare size={20} style={{ color: 'var(--primary)' }} /> : <Square size={20} style={{ color: 'var(--text-tertiary)' }} />}
                <div>
                  <strong style={{ fontSize: '0.9rem', display: 'block' }}>1. v1.08 Settings Subcategories</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Organize settings into Company Master & App Setting subcategories.</span>
                </div>
              </div>

              {/* v1.07 Features */}
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                onClick={() => toggleSetting('toggle_v107_company_branding', featureCompanyBranding, setFeatureCompanyBranding)}
              >
                {featureCompanyBranding ? <CheckSquare size={20} style={{ color: 'var(--primary)' }} /> : <Square size={20} style={{ color: 'var(--text-tertiary)' }} />}
                <div>
                  <strong style={{ fontSize: '0.9rem', display: 'block' }}>2. v1.07 Custom Branding Header</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Show custom logo and company name in the top navigation bar.</span>
                </div>
              </div>

              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                onClick={() => toggleSetting('toggle_v107_4hour_sync', feature4HourSync, setFeature4HourSync)}
              >
                {feature4HourSync ? <CheckSquare size={20} style={{ color: 'var(--primary)' }} /> : <Square size={20} style={{ color: 'var(--text-tertiary)' }} />}
                <div>
                  <strong style={{ fontSize: '0.9rem', display: 'block' }}>3. v1.07 4-Hour Background Auto-Sync</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Trigger auto cloud backups on a background loop every 4 hours.</span>
                </div>
              </div>

              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                onClick={() => toggleSetting('toggle_v107_purchase_images', featurePurchaseImages, setFeaturePurchaseImages)}
              >
                {featurePurchaseImages ? <CheckSquare size={20} style={{ color: 'var(--primary)' }} /> : <Square size={20} style={{ color: 'var(--text-tertiary)' }} />}
                <div>
                  <strong style={{ fontSize: '0.9rem', display: 'block' }}>4. v1.07 Purchase Invoice Attachments</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Attach local, cloud, or camera receipt images to supplier purchases.</span>
                </div>
              </div>

              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                onClick={() => toggleSetting('toggle_v107_product_images', featureProductImages, setFeatureProductImages)}
              >
                {featureProductImages ? <CheckSquare size={20} style={{ color: 'var(--primary)' }} /> : <Square size={20} style={{ color: 'var(--text-tertiary)' }} />}
                <div>
                  <strong style={{ fontSize: '0.9rem', display: 'block' }}>5. v1.07 Product Gallery Uploads</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Upload up to 3 pictures per product with click-to-enlarge lightboxes.</span>
                </div>
              </div>

              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                onClick={() => toggleSetting('toggle_v107_stock_slideshow', featureStockSlideshow, setFeatureStockSlideshow)}
              >
                {featureStockSlideshow ? <CheckSquare size={20} style={{ color: 'var(--primary)' }} /> : <Square size={20} style={{ color: 'var(--text-tertiary)' }} />}
                <div>
                  <strong style={{ fontSize: '0.9rem', display: 'block' }}>6. v1.07 Stock List Automatic Slideshow</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>View product gallery slideshow that cycles automatically every 5s.</span>
                </div>
              </div>

              {/* v1.09 Feature */}
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                onClick={() => toggleSetting('toggle_v109_file_tracker', featureFileTracker, setFeatureFileTracker)}
              >
                {featureFileTracker ? <CheckSquare size={20} style={{ color: 'var(--primary)' }} /> : <Square size={20} style={{ color: 'var(--text-tertiary)' }} />}
                <div>
                  <strong style={{ fontSize: '0.9rem', display: 'block' }}>7. v1.09 File Tracking Console Logger</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Prints structured system logs of file creation and update events on startup.</span>
                </div>
              </div>

              {/* v1.10 Feature */}
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                onClick={() => toggleSetting('toggle_v110_google_oauth', featureGoogleOauth, setFeatureGoogleOauth)}
              >
                {featureGoogleOauth ? <CheckSquare size={20} style={{ color: 'var(--primary)' }} /> : <Square size={20} style={{ color: 'var(--text-tertiary)' }} />}
                <div>
                  <strong style={{ fontSize: '0.9rem', display: 'block' }}>8. v1.10 Real Google OAuth 2.0 Login</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Launch official Google sign-in dialog and retrieve dynamic profile info.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Google OAuth Configuration Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', margin: 0 }}>
              <Building2 size={20} style={{ color: 'var(--primary)' }} /> Google Authentication Config
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Without a Client ID below, sign-in uses a local demo account chooser (for testing only — it does not check real Gmail accounts). To show the actual Google sign-in screen, follow these steps:
            </p>

            <ol style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>
                Open{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  Google Cloud Console → Credentials <ExternalLink size={12} />
                </a>{' '}
                and create an <strong>OAuth client ID</strong> (type: Web application).
              </li>
              <li>
                Under <strong>Authorized JavaScript origins</strong>, add: <code style={{ background: 'var(--bg-secondary)', padding: '0.1rem 0.35rem', borderRadius: 4 }}>{window.location.origin}</code>
              </li>
              <li>
                Under <strong>Authorized redirect URIs</strong>, add the exact URL below (copy it using the button):
              </li>
            </ol>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                className="input-control"
                value={oauthRedirectUri}
                readOnly
                onFocus={(e) => e.target.select()}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={copyRedirectUri}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
              >
                {redirectUriCopied ? <Check size={16} /> : <Copy size={16} />}
                {redirectUriCopied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                Google Client ID <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(paste the one Google generates for you)</span>
              </label>
              <input 
                type="text" 
                className="input-control" 
                value={googleClientId} 
                onChange={(e) => {
                  setGoogleClientId(e.target.value.trim());
                  localStorage.setItem('setting_google_client_id', e.target.value.trim());
                  window.dispatchEvent(new Event('app-settings-updated'));
                }}
                placeholder="e.g. 1234567890-abcdefg.apps.googleusercontent.com"
                style={{ width: '100%' }}
              />
              {googleClientId && (
                <p style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: '0.5rem', marginBottom: 0 }}>
                  ✓ Real Google Sign-In is active. The login button will now open the official Google account picker.
                </p>
              )}
            </div>
          </div>

          {/* visual file logger registry */}
          {featureFileTracker && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', margin: 0 }}>
                <CheckSquare size={20} style={{ color: 'var(--primary)' }} /> System File Log Registry
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Structured inventory registry tracking created/modified application source files:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {[
                  {
                    name: "database.ts",
                    path: "/src/db/database.ts",
                    purpose: "Handles database schema definition, weighted average calculations, Dexie configuration, and JSON backup exports/restores.",
                    timestamp: "2026-07-09T15:33:00Z"
                  },
                  {
                    name: "App.tsx",
                    path: "/src/App.tsx",
                    purpose: "Main entry point container managing role-based views, layouts, sidebars, theme toggles, and mobile bottom navigation bars.",
                    timestamp: "2026-07-09T15:34:00Z"
                  },
                  {
                    name: "SettingsScreen.tsx",
                    path: "/src/views/SettingsScreen.tsx",
                    purpose: "Configures receipt layouts, App & Dashboard customizations, Company Master configurations, Google Client ID config, and Version Feature controls.",
                    timestamp: "2026-07-09T15:38:00Z"
                  },
                  {
                    name: "AuthScreen.tsx",
                    path: "/src/views/AuthScreen.tsx",
                    purpose: "Manages user login and registration, launching real Google OAuth popup or local account selectors with dynamic sign-in history tracking.",
                    timestamp: "2026-07-09T15:36:00Z"
                  },
                  {
                    name: "google-oauth-callback.html",
                    path: "/public/google-oauth-callback.html",
                    purpose: "Acts as redirect URI target for Google OAuth, extracting authorization access token and fetching authentic profiles from Google Userinfo API.",
                    timestamp: "2026-07-09T15:35:00Z"
                  },
                  {
                    name: "google-login.html",
                    path: "/public/google-login.html",
                    purpose: "A fallback local chooser interface that loads previously logged-in Gmail accounts from local history storage dynamically.",
                    timestamp: "2026-07-09T15:37:00Z"
                  },
                  {
                    name: "netlify.toml",
                    path: "/netlify.toml",
                    purpose: "Defines hosting parameters and URL rewriting configurations to support React Single Page App routing redirects on Netlify.",
                    timestamp: "2026-07-09T15:39:00Z"
                  },
                  {
                    name: "fileLogger.ts",
                    path: "/src/utils/fileLogger.ts",
                    purpose: "Provides a system file tracking log utility which prints file creation and update events to the console on startup.",
                    timestamp: "2026-07-09T15:33:30Z"
                  }
                ].map((file, idx) => (
                  <div key={idx} style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-tertiary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>{file.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{new Date(file.timestamp).toLocaleDateString()}</span>
                    </div>
                    <code style={{ fontSize: '0.75rem', display: 'block', color: 'var(--text-secondary)', marginBottom: '0.4rem', wordBreak: 'break-all' }}>{file.path}</code>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{file.purpose}</p>
                    <code style={{ fontSize: '0.72rem', display: 'block', marginTop: '0.4rem', color: 'var(--text-tertiary)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.25rem' }}>
                      Format: {file.path} &rarr; {file.purpose}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
      
      <div className="card" style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--primary-light)', borderColor: 'var(--primary)' }}>
        <Sparkles style={{ color: 'var(--primary)' }} />
        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--primary)' }}>
          To revert any option, simply toggle it off in the settings above. The application will instantly load the legacy configuration dynamically!
        </span>
      </div>
    </div>
  );
}
