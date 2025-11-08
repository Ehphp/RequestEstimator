import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { viteSourceLocator } from "@metagptx/vite-plugin-source-locator";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    viteSourceLocator({
      prefix: "mgx",
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk - React ecosystem
          'react-vendor': [
            'react',
            'react-dom',
            'react-router-dom'
          ],
          // UI Library chunk - Radix UI components
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-separator',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-accordion'
          ],
          // Data/API chunk - Supabase and query tools
          'data-vendor': [
            '@supabase/supabase-js',
            '@tanstack/react-query'
          ],
          // Icons chunk
          'icons-vendor': [
            'lucide-react'
          ],
          // Utils chunk - smaller utilities
          'utils-vendor': [
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
            'date-fns'
          ]
        }
      }
    },
    // Optimize chunk size warning threshold
    chunkSizeWarningLimit: 600,
    // Enable source maps for production debugging (optional)
    sourcemap: mode === 'development',
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'lucide-react'
    ],
  },
}));
