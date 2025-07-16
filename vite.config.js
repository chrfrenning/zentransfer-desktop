import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Set base to relative path for Electron
  base: './',
  
  // Root directory for the React app
  root: './src/renderer/',
  
  // Public directory relative to root
  publicDir: './public',
  
  // Build configuration for Electron renderer
  build: {
    // Output directory relative to project root
    outDir: '../../dist-react',
    // Empty the output directory before build
    emptyOutDir: true,
    // Generate source maps for debugging
    sourcemap: true,
    // Rollup options
    rollupOptions: {
      // Don't bundle electron - it's provided by the main process
      external: ['electron'],
      input: {
        main: resolve(__dirname, 'src/renderer/index.html')
      }
    },
    // Target ES2020 for modern Electron
    target: 'es2020'
  },
  
  // Development server configuration
  server: {
    // Use a specific port for consistency
    port: 4000,
    // Allow connections from Electron
    host: '127.0.0.1',
    // Disable opening browser automatically
    open: false
  },
  
  // CSS configuration for Tailwind integration
  css: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer')
      ]
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      '@components': resolve(__dirname, 'src/renderer/src/components'),
      '@hooks': resolve(__dirname, 'src/renderer/src/hooks'),
      '@screens': resolve(__dirname, 'src/renderer/src/screens'),
      '@contexts': resolve(__dirname, 'src/renderer/src/contexts'),
      '@utils': resolve(__dirname, 'src/renderer/src/utils')
    }
  },
  
  // Define global constants
  define: {
    // Ensure process.env is available in development
    'process.env': process.env,
    // Define if we're in development mode
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  },
  
  // Optimize dependencies for Electron environment
  optimizeDeps: {
    exclude: ['electron']
  }
}); 