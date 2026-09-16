// PM2 process config for Thai Chili Peppers ERP (Next.js).
// Mirrors the live process: `pm2 start npm --name "skool-erp" -- start`
module.exports = {
  apps: [
    {
      name: 'skool-erp',
      cwd: '/root/.openclaw/workspace-khaohom/skool-erp',
      script: 'npm',
      args: 'start', // -> "next start -p 3001" (see package.json scripts.start)
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        // Loads NEXT_PUBLIC_* and SUPABASE_SERVICE_ROLE_KEY from the .env file
        // in cwd. Real values must exist on the VPS and are NOT committed.
      },
    },
  ],
};