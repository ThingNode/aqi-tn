import { defineConfig } from 'vite';
import { microfrontends } from '@vercel/microfrontends/experimental/vite';

export default defineConfig({ plugins: [microfrontends()], base: '/' });
