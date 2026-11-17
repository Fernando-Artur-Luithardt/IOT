'use strict';
module.exports = {
  uiPort: Number(process.env.PORT || 1881),
  uiHost: process.env.NODE_RED_BIND || '127.0.0.1',
  httpAdminRoot: '/editor',
  credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET || require('node:crypto').randomBytes(32).toString('hex'),
  contextStorage: { default: 'file', file: { module: 'localfilesystem', config: { flushInterval: 1 } } },
  functionGlobalContext: {
    cp3: require('./lib/monitor.cjs'),
    cp3Persistence: require('./lib/persistence.cjs'),
    cp3Bridge: require('./lib/bridge.cjs')
  },
  logging: { console: { level: 'warn', metrics: false, audit: false } },
  editorTheme: { projects: { enabled: false } },
  ...(process.env.NODE_RED_ADMIN_HASH ? { adminAuth: {
    type: 'credentials', users: [{ username: 'admin', password: process.env.NODE_RED_ADMIN_HASH, permissions: '*' }]
  } } : {})
};
