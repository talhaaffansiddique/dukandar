import React, { useState, useEffect, useCallback } from 'react';
import { LogIn, ShoppingBag, Shield, User, Key, UserCheck } from 'lucide-react';
import { db, type User as UserType } from '../db/database';

interface AuthScreenProps {
  onLoginSuccess: (user: UserType) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  // Check if any users exist in the database on mount
  useEffect(() => {
    async function checkUserCount() {
      try {
        const count = await db.users.count();
        setIsFirstTime(count === 0);
      } catch (err) {
        console.error('Error checking user count', err);
        setIsFirstTime(false);
      }
    }
    checkUserCount();
  }, []);

  const handleGoogleSignIn = useCallback(async (selectedEmail: string, displayName: string) => {
    setError('');
    const emailKey = selectedEmail.trim().toLowerCase();

    // Dynamically store/remember this Google account in local history list
    try {
      const savedAccounts = JSON.parse(localStorage.getItem('google_saved_accounts') || '[]');
      if (!savedAccounts.some((a: any) => a.email === emailKey)) {
        savedAccounts.push({ email: emailKey, name: displayName });
        localStorage.setItem('google_saved_accounts', JSON.stringify(savedAccounts));
      }
    } catch (e) {
      console.error('Failed to update Google chooser account list history:', e);
    }

    try {
      // 1. Check if there is an existing cloud backup for this email
      const cloudBackup = localStorage.getItem(`gdrive_backup_${emailKey}`);
      if (cloudBackup) {
        setSyncStatusMsg('Found cloud backup! Restoring database...');
        const { restoreDatabaseBackup } = await import('../db/database');
        await restoreDatabaseBackup(cloudBackup);

        // Fetch restored user
        const restoredUser = await db.users.get(emailKey);
        if (restoredUser) {
          setSyncStatusMsg('Sync complete. Logging in...');
          onLoginSuccess(restoredUser);
          return;
        }
      }

      // 2. No backup. Check if user already exists in the current local database
      const existingUser = await db.users.get(emailKey);
      if (existingUser) {
        onLoginSuccess(existingUser);
        return;
      }

      // 3. No backup and user doesn't exist.
      // If the database is completely fresh, they register as OWNER
      const userCount = await db.users.count();
      if (userCount === 0) {
        const ownerUser: UserType = {
          id: emailKey,
          email: emailKey,
          name: displayName,
          role: 'OWNER',
          password: 'google-oauth-user', // default identifier
        };
        await db.users.put(ownerUser);
        
        // Save initial backup to cloud
        const { autoSyncCloud } = await import('../db/database');
        await autoSyncCloud(emailKey);

        onLoginSuccess(ownerUser);
      } else {
        // If users already exist, this Gmail account must be pre-invited/created by OWNER/ADMIN
        setError('This Google account is not registered. Please contact your store administrator to create your account.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during Google Sign-In.');
    }
  }, [onLoginSuccess]);

  // Set up message event listener for Google OAuth popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data) {
        if (event.data.type === 'GOOGLE_SIGN_IN_SUCCESS') {
          const { email: googleEmail, name: googleName } = event.data;
          if (googleEmail) {
            handleGoogleSignIn(googleEmail, googleName || 'Google User');
          }
        } else if (event.data.type === 'GOOGLE_SIGN_IN_ERROR') {
          setError(event.data.error || 'Google Sign-In was cancelled or failed.');
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => {
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, [handleGoogleSignIn]);

  const openGoogleSignInPopup = () => {
    setError('');
    setSyncStatusMsg('');
    
    const width = 500;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const clientId = localStorage.getItem('setting_google_client_id') || '';
    const isRealOAuth = localStorage.getItem('toggle_v110_google_oauth') !== 'false';
    
    if (clientId && isRealOAuth) {
      // Real Google OAuth 2.0 Flow!
      const redirectUri = window.location.origin + import.meta.env.BASE_URL + 'google-oauth-callback.html';
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=openid%20profile%20email&prompt=select_account`;
      
      window.open(
        oauthUrl,
        'Google Sign-In',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );
    } else {
      // Fallback/Simulated Google Choose Account popup (which dynamically renders saved accounts)
      window.open(
        import.meta.env.BASE_URL + 'google-login.html',
        'Google Sign-In',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSyncStatusMsg('');

    const emailKey = email.trim().toLowerCase();

    if (isFirstTime) {
      // First User Registration (OWNER)
      if (!emailKey || !name.trim() || !password.trim()) {
        setError('Please fill in all fields.');
        return;
      }

      try {
        const cloudBackup = localStorage.getItem(`gdrive_backup_${emailKey}`);
        if (cloudBackup) {
          setSyncStatusMsg('Found cloud backup! Restoring database...');
          const { restoreDatabaseBackup } = await import('../db/database');
          await restoreDatabaseBackup(cloudBackup);

          const restoredUser = await db.users.get(emailKey);
          if (restoredUser) {
            if (restoredUser.password === password) {
              setSyncStatusMsg('Sync complete. Logging in...');
              onLoginSuccess(restoredUser);
              return;
            } else {
              setError('Backup found, but the password entered does not match the backup password.');
              return;
            }
          }
        }

        const userObj: UserType = {
          id: emailKey,
          email: emailKey,
          name: name.trim(),
          role: 'OWNER',
          password: password,
        };

        await db.users.put(userObj);
        
        const { autoSyncCloud } = await import('../db/database');
        await autoSyncCloud(emailKey);

        onLoginSuccess(userObj);
      } catch (err) {
        console.error(err);
        setError('An error occurred during owner registration.');
      }
    } else {
      // Standard Login Flow
      if (!emailKey || !password.trim()) {
        setError('Please enter both email and password.');
        return;
      }

      try {
        const cloudBackup = localStorage.getItem(`gdrive_backup_${emailKey}`);
        if (cloudBackup) {
          setSyncStatusMsg('Auto-syncing to last backup file...');
          const { restoreDatabaseBackup } = await import('../db/database');
          await restoreDatabaseBackup(cloudBackup);
        }

        const userObj = await db.users.get(emailKey);
        if (!userObj) {
          setError('Invalid email address or password.');
          return;
        }

        if (userObj.password !== password) {
          setError('Invalid email address or password.');
          return;
        }

        if ((userObj.role as any) === 'STAFF') {
          userObj.role = 'EMPLOYEE';
          await db.users.update(userObj.id, { role: 'EMPLOYEE' });
        }

        const { autoSyncCloud } = await import('../db/database');
        await autoSyncCloud(emailKey);

        onLoginSuccess(userObj);
      } catch (err) {
        console.error(err);
        setError('An error occurred during sign-in.');
      }
    }
  };

  if (isFirstTime === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
        <h3 style={{ color: 'var(--primary)' }}>Checking store registration...</h3>
      </div>
    );
  }

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        padding: '1rem',
      }}
    >
      <div 
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '2.5rem',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div 
            style={{
              width: '60px',
              height: '60px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              borderRadius: 'var(--border-radius-md)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <ShoppingBag size={32} />
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Dukandar Web</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {isFirstTime ? 'Owner Registration (First User)' : 'Store Inventory & Sales Manager'}
          </p>
        </div>

        {error && (
          <div 
            className="alert-banner alert-banner-danger" 
            style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}
          >
            {error}
          </div>
        )}

        {syncStatusMsg && (
          <div 
            className="alert-banner alert-banner-success" 
            style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}
          >
            {syncStatusMsg}
          </div>
        )}

        {isFirstTime && (
          <div 
            className="alert-banner alert-banner-info" 
            style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}
          >
            Welcome to Dukandar! Register your Gmail/email below. If you have a prior Google Drive cloud backup, it will auto-restore automatically.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isFirstTime && (
            <div className="form-group">
              <label htmlFor="name-input">Owner Name</label>
              <div style={{ position: 'relative' }}>
                <User 
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
                  id="name-input"
                  type="text"
                  className="input-control"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="e.g. Waseem Khan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email-input">Email Address</label>
            <div style={{ position: 'relative' }}>
              <LogIn 
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
                id="email-input"
                type="email"
                className="input-control"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="name@store.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password-input">Password</label>
            <div style={{ position: 'relative' }}>
              <Key 
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
                id="password-input"
                type="password"
                className="input-control"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {isFirstTime ? (
            <div className="form-group">
              <label>Assigned System Role</label>
              <div style={{ position: 'relative' }}>
                <Shield 
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
                  style={{ paddingLeft: '2.5rem', backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}
                  value="OWNER (Full Root Control)"
                  disabled
                />
              </div>
            </div>
          ) : null}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem', padding: '0.85rem' }}
          >
            {isFirstTime ? <UserCheck size={18} /> : <LogIn size={18} />}
            {isFirstTime ? 'Register & Initialize' : 'Sign In to Store'}
          </button>
        </form>

        {/* OR Spacer */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
          <span style={{ padding: '0 0.75rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>or</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
        </div>

        {/* Google Sign-in Button */}
        <button 
          type="button" 
          className="btn btn-secondary" 
          style={{ 
            width: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '0.65rem', 
            padding: '0.85rem', 
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            fontWeight: 500
          }}
          onClick={openGoogleSignInPopup}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" style={{ display: 'block' }}>
            <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.98 0 12 0 7.31 0 3.25 2.69 1.25 6.63l3.86 3C6.03 6.63 8.78 5.04 12 5.04z"/>
            <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.43c-.28 1.44-1.09 2.67-2.31 3.48l3.6 2.79c2.1-1.94 3.3-4.79 3.3-8.42z"/>
            <path fill="#FBBC05" d="M5.11 14.37c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.25 6.79C.45 8.36 0 10.13 0 12s.45 3.64 1.25 5.21l3.86-2.84z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.6-2.79c-1 .67-2.28 1.07-3.6 1.07-3.22 0-5.97-2.12-6.94-4.99L.96 17.22C2.96 21.31 7.15 24 12 24z"/>
          </svg>
          Sign in with Google
        </button>

        <div 
          style={{ 
            marginTop: '2rem', 
            textAlign: 'center', 
            fontSize: '0.8rem', 
            color: 'var(--text-tertiary)' 
          }}
        >
          Secured local-first database (IndexedDB)
        </div>
      </div>
    </div>
  );
}