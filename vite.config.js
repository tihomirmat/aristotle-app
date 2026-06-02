import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // This codebase imports backend functions via @/functions/*, so legacy resolution must be
      // enabled for the build to succeed. Default to on; set BASE44_LEGACY_SDK_IMPORTS=false to disable.
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS !== 'false',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]
});