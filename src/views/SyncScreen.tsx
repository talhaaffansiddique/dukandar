import React, { useState, useRef } from 'react';
import { Cloud, RefreshCw, Upload, Download, CheckCircle, ShieldAlert, Trash2 } from 'lucide-react';
import { db, exportDatabaseBackup, restoreDatabaseBackup } from '../db/database';

interface SyncScreenProps {
  userEmail: string;
  userName: string;
  userRole: 'OWNER' | 'ADMIN' | 'EMPLOYEE';
}

export default function SyncScreen({ userEmail, userName, userRole }: SyncScreenProps) {
  const isAdmin = userRole === 'ADMIN' || userRole === 'OWNER';

  // Cloud Sync Simulator State
  const [syncState, setSyncState] = useState<'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [lastBackup, setLastBackup] = useState<string>(() => {
    const ts = localStorage.getItem(`gdrive_backup_time_${userEmail.toLowerCase()}`);
    return ts ? new Date(Number(ts)).toLocaleTimeString() : 'Never';
  });
  const [syncMsg, setSyncMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncEnabled = localStorage.getItem('toggle_v107_4hour_sync') !== 'false';

  // Listen for background auto sync completion events
  React.useEffect(() => {
    const handleSyncDone = () => {
      const ts = localStorage.getItem(`gdrive_backup_time_${userEmail.toLowerCase()}`);
      if (ts) setLastBackup(new Date(Number(ts)).toLocaleTimeString());
    };
    window.addEventListener('cloud-sync-completed', handleSyncDone);
    return () => window.removeEventListener('cloud-sync-completed', handleSyncDone);
  }, [userEmail]);

  // Manual Cloud container Sync
  const handleManualCloudSync = async () => {
    setSyncState('SYNCING');
    setSyncMsg('Synchronizing IndexedDB store to Google Drive container...');
    
    setTimeout(async () => {
      try {
        const { autoSyncCloud } = await import('../db/database');
        await autoSyncCloud(userEmail);
        localStorage.setItem('last_cloud_sync_time', String(Date.now()));

        const now = new Date().toLocaleTimeString();
        setLastBackup(now);
        setSyncState('SUCCESS');
        setSyncMsg(`Google Drive cloud container synchronized successfully at ${now}`);
      } catch (err) {
        console.error(err);
        setSyncState('ERROR');
        setSyncMsg('Failed to sync. Cloud endpoint unreachable.');
      }
    }, 1200);
  };

  // Manual Backup download as JSON file
  const handleBackupCloud = async () => {
    setSyncState('SYNCING');
    setSyncMsg('Connecting to Google Drive container...');
    
    setTimeout(async () => {
      try {
        const jsonBackup = await exportDatabaseBackup();
        
        // Sync database state to simulated cloud localStorage namespace
        const { autoSyncCloud } = await import('../db/database');
        await autoSyncCloud(userEmail);
        localStorage.setItem('last_cloud_sync_time', String(Date.now()));

        // Simulating writing backup file to user download as Google Drive output
        const blob = new Blob([jsonBackup], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dukandar_gdrive_backup_${userEmail.replace('@', '_')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const now = new Date().toLocaleTimeString();
        setLastBackup(now);
        setSyncState('SUCCESS');
        setSyncMsg(`Backup synchronized successfully to Google Drive folder at ${now}`);
      } catch (err) {
        console.error(err);
        setSyncState('ERROR');
        setSyncMsg('Sync upload timeout. Check GDrive API token.');
      }
    }, 1200);
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  // Manual Restore from Google Drive Backup file
  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSyncState('SYNCING');
    setSyncMsg('Fetching backup binary from Google AppData...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      setTimeout(async () => {
        try {
          const content = event.target?.result as string;
          await restoreDatabaseBackup(content);
          
          // Sync restored state to the cloud namespace
          const { autoSyncCloud } = await import('../db/database');
          await autoSyncCloud(userEmail);

          setSyncState('SUCCESS');
          setSyncMsg('Store database imported and synced! App will reload now.');
          alert('Database restored successfully! Re-opening database.');
          window.location.reload();
        } catch (err) {
          console.error(err);
          setSyncState('ERROR');
          setSyncMsg('Corrupt backup template file uploaded.');
        }
      }, 1200);
    };
    reader.readAsText(file);
  };

  // Clear Database for UAT Testing
  const handleClearDatabase = async () => {
    if (!confirm('WARNING: Are you sure you want to permanently clear the local database? All current transactions, products, users, and settings will be wiped out!')) {
      return;
    }
    try {
      await db.delete();
      alert('Local database wiped successfully! Re-opening fresh database.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Error clearing database.');
    }
  };

  const getNextSyncStr = () => {
    if (!syncEnabled) return 'Disabled';
    const last = localStorage.getItem('last_cloud_sync_time');
    if (!last) return 'Pending next cycle...';
    const nextTime = Number(last) + 4 * 60 * 60 * 1000;
    if (nextTime <= Date.now()) return 'Syncing...';
    return new Date(nextTime).toLocaleTimeString();
  };

  return (
    <div className="main-content">
      <div>
        <h1 style={{ fontSize: '1.85rem' }}>Cloud Sync & Backups</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Manage your local-first database backups and Google Drive cloud synchronization.
        </p>
      </div>

      {/* Cloud Sync Controller card */}
      <div className="card-glass" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
        <div className="flex-between">
          <div className="flex-gap">
            <Cloud size={24} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1.15rem' }}>Google Drive Cloud Sync Status</h3>
          </div>
          <span className="badge badge-success flex-gap" style={{ backgroundColor: syncEnabled ? 'var(--success-light)' : 'var(--bg-tertiary)', color: syncEnabled ? 'var(--success)' : 'var(--text-secondary)', border: `1px solid ${syncEnabled ? 'var(--success)' : 'var(--border-color)'}` }}>
            <CheckCircle size={12} /> {syncEnabled ? 'Auto-Sync (4h Loop) Active' : 'Auto-Sync Off'}
          </span>
        </div>

        <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Connected Gmail: <strong style={{ color: 'var(--text-primary)' }}>{userName}</strong> ({userEmail})<br />
          Role Permissions: <strong style={{ color: 'var(--text-primary)' }}>{userRole}</strong><br />
          Last backup sync: <strong style={{ color: 'var(--text-primary)' }}>{lastBackup}</strong><br />
          Next scheduled sync check: <strong style={{ color: 'var(--text-primary)' }}>{getNextSyncStr()}</strong>
        </div>

        {syncState !== 'IDLE' && (
          <div 
            className={`alert-banner ${syncState === 'SUCCESS' ? 'alert-banner-success' : syncState === 'ERROR' ? 'alert-banner-danger' : ''}`}
            style={{ 
              backgroundColor: syncState === 'SYNCING' ? 'var(--bg-tertiary)' : undefined, 
              borderColor: syncState === 'SYNCING' ? 'var(--border-color)' : undefined,
              color: syncState === 'SYNCING' ? 'var(--text-primary)' : undefined,
              fontSize: '0.85rem' 
            }}
          >
            {syncState === 'SYNCING' ? <RefreshCw className="spin" size={16} style={{ marginRight: '6px' }} /> : null}
            <span>{syncMsg}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <button className="btn btn-primary" onClick={handleManualCloudSync} disabled={syncState === 'SYNCING'}>
            <RefreshCw size={18} style={{ marginRight: '6px' }} /> Sync Now (Google Drive)
          </button>

          <button className="btn btn-secondary" onClick={handleBackupCloud} disabled={syncState === 'SYNCING'}>
            <Download size={18} /> Export Backup File (.json)
          </button>
          
          {isAdmin ? (
            <>
              <button className="btn btn-secondary" onClick={handleRestoreClick} disabled={syncState === 'SYNCING'}>
                <Upload size={18} /> Import Backup File
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".json"
                onChange={handleRestoreFile}
              />
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--danger)' }}>
              <ShieldAlert size={14} /> Owner/Admin permissions required to restore database.
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      {isAdmin && (
        <div className="card" style={{ border: '1px solid var(--danger)', marginTop: '2rem' }}>
          <h3 style={{ color: 'var(--danger)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Danger Zone</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Wipe all local IndexedDB data. This resets the application. Please make a backup first!
          </p>
          <button className="btn btn-danger" onClick={handleClearDatabase}>
            <Trash2 size={16} /> Clear Local Database
          </button>
        </div>
      )}
    </div>
  );
}
