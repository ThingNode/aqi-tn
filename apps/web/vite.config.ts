import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { microfrontends } from '@vercel/microfrontends/experimental/vite';
export default defineConfig({plugins:[react(),microfrontends()],server:{proxy:{'/api':{target:'http://127.0.0.1:8020',ws:true}}}});
