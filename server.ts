import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './src/server/routes/authRoutes.ts';
import marketplaceRoutes from './src/server/routes/marketplaceRoutes.ts';
import workspaceRoutes from './src/server/routes/workspaceRoutes.ts';
import adminRoutes from './src/server/routes/adminRoutes.ts';
import { ensureSeedData } from './src/server/seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: true, limit: '8mb' }));

  // Lazy seed middleware on first API call (avoids top-level startup probes)
  app.use('/api', async (_req, res, next) => {
    try {
      await ensureSeedData();
      next();
    } catch (err) {
      console.error('Database bootstrap failed:', err);
      res.status(503).json({ error: 'Database service temporarily unavailable. Please retry shortly.' });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'briefline' });
  });

  app.use(authRoutes);
  app.use(marketplaceRoutes);
  app.use(workspaceRoutes);
  app.use(adminRoutes);

  // Return clean JSON 404 for unknown API paths
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Briefline server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
