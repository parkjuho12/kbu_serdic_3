import { defineConfig } from 'vite';
export default defineConfig({ server: { proxy: { '/api/demo-ai': 'http://127.0.0.1:8089' } } });
