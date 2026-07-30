import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:'/app/',server:{proxy:{'/api':{target:'http://localhost:8020',ws:true}}}});
