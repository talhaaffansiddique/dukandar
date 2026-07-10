export interface LoggedFile {
  name: string;
  path: string;
  purpose: string;
  timestamp: string;
}

export const appFilesRegistry: LoggedFile[] = [
  {
    name: "database.ts",
    path: "src/db/database.ts",
    purpose: "Handles database schema definition, weighted average calculations, Dexie configuration, and JSON backup exports/restores.",
    timestamp: "2026-07-09T15:33:00Z"
  },
  {
    name: "App.tsx",
    path: "src/App.tsx",
    purpose: "Main entry point container managing role-based views, layouts, sidebars, theme toggles, and mobile bottom navigation bars.",
    timestamp: "2026-07-09T15:34:00Z"
  },
  {
    name: "SettingsScreen.tsx",
    path: "src/views/SettingsScreen.tsx",
    purpose: "Configures receipt layouts, App & Dashboard customizations, Company Master configurations, Google Client ID config, and Version Feature controls.",
    timestamp: "2026-07-09T15:38:00Z"
  },
  {
    name: "AuthScreen.tsx",
    path: "src/views/AuthScreen.tsx",
    purpose: "Manages user login and registration, launching real Google OAuth popup or local account selectors with dynamic sign-in history tracking.",
    timestamp: "2026-07-09T15:36:00Z"
  },
  {
    name: "google-oauth-callback.html",
    path: "public/google-oauth-callback.html",
    purpose: "Acts as redirect URI target for Google OAuth, extracting authorization access token and fetching authentic profiles from Google Userinfo API.",
    timestamp: "2026-07-09T15:35:00Z"
  },
  {
    name: "google-login.html",
    path: "public/google-login.html",
    purpose: "A fallback local chooser interface that loads previously logged-in Gmail accounts from local history storage dynamically.",
    timestamp: "2026-07-09T15:37:00Z"
  },
  {
    name: "netlify.toml",
    path: "netlify.toml",
    purpose: "Defines hosting parameters and URL rewriting configurations to support React Single Page App routing redirects on Netlify.",
    timestamp: "2026-07-09T15:39:00Z"
  },
  {
    name: "fileLogger.ts",
    path: "src/utils/fileLogger.ts",
    purpose: "Provides a system file tracking log utility which prints file creation and update events to the console on startup.",
    timestamp: "2026-07-09T15:33:30Z"
  }
];

export function logSystemFiles() {
  const isLoggerEnabled = localStorage.getItem('toggle_v109_file_tracker') !== 'false';
  if (!isLoggerEnabled) return;

  console.log("=========================================");
  console.log("      SYSTEM FILE CREATION LOGS (v1.10)  ");
  console.log("=========================================");
  
  appFilesRegistry.forEach(file => {
    console.log(`${file.name}`);
    console.log(`Path: ${file.path}`);
    console.log(`Purpose: ${file.purpose}`);
    console.log(`Last Modified: ${file.timestamp}`);
    console.log(`Format: ${file.path} → ${file.purpose}`);
    console.log("-----------------------------------------");
  });
}
