import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isDev = process.env.NODE_ENV !== 'production';

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // API endpoints used in MediaPickerModal
  app.get('/api/photo-search', async (req, res) => {
    try {
      const q = (req.query.q as string) || 'yoga';
      const unsplashKey = process.env.UNSPLASH_API_KEY;
      if (unsplashKey && unsplashKey !== 'UNSPLASH_API_KEY') {
        const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=16&client_id=${unsplashKey}`);
        if (response.ok) {
          const data = await response.json();
          return res.json({
            results: (data.results || []).map((img: any) => ({
              id: img.id,
              url: img.urls?.regular || img.urls?.small,
              thumb: img.urls?.thumb || img.urls?.small,
              title: img.alt_description || q
            }))
          });
        }
      }
      
      // Fallback high-quality curated educational & pose photos
      const fallbackPhotos = [
        { id: '1', url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=600&q=80', thumb: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=200&q=80', title: 'Tree Pose' },
        { id: '2', url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80', thumb: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=200&q=80', title: 'Meditation Lotus Pose' },
        { id: '3', url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80', thumb: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=200&q=80', title: 'Warrior Pose' },
        { id: '4', url: 'https://images.unsplash.com/photo-1552196563-55236814b744?auto=format&fit=crop&w=600&q=80', thumb: 'https://images.unsplash.com/photo-1552196563-55236814b744?auto=format&fit=crop&w=200&q=80', title: 'Yoga Stretch' },
        { id: '5', url: 'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?auto=format&fit=crop&w=600&q=80', thumb: 'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?auto=format&fit=crop&w=200&q=80', title: 'Cobra Pose' },
        { id: '6', url: 'https://images.unsplash.com/photo-1599447421416-3414500d18a5?auto=format&fit=crop&w=600&q=80', thumb: 'https://images.unsplash.com/photo-1599447421416-3414500d18a5?auto=format&fit=crop&w=200&q=80', title: 'Downward Dog' }
      ];
      return res.json({ results: fallbackPhotos });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/giphy-search', async (req, res) => {
    try {
      const q = (req.query.q as string) || 'yoga';
      const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(q)}&limit=16`);
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      res.json({ data: [] });
    } catch (err: any) {
      res.json({ data: [] });
    }
  });

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch(console.error);
