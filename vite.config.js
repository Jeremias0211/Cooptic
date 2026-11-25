import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // base relativa para poder publicarlo en GitHub Pages o en una subcarpeta
  base: './'
})
