/**
 * PWA ikonları oluşturur: public/icons/icon-192.png ve icon-512.png
 * PulseApp marka rengi #193d8f (lacivert) üzerine beyaz "P" harfi.
 *
 * Kullanım: node scripts/generate-icons.mjs
 * Gereksinim: canvas paketi (npm install canvas --save-dev)
 */

import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'icons')

mkdirSync(OUT_DIR, { recursive: true })

function drawIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const r = size * 0.18 // köşe yarıçapı

  // Arka plan — #193d8f lacivert, yuvarlak köşe
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.quadraticCurveTo(size, 0, size, r)
  ctx.lineTo(size, size - r)
  ctx.quadraticCurveTo(size, size, size - r, size)
  ctx.lineTo(r, size)
  ctx.quadraticCurveTo(0, size, 0, size - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
  ctx.fillStyle = '#193d8f'
  ctx.fill()

  // İnce beyaz iç çerçeve
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = size * 0.02
  ctx.stroke()

  // "P" harfi — beyaz, kalın
  const fontSize = size * 0.58
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${fontSize}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // "P" harfini hafifçe sola ve yukarı kaydır (optik ortalama)
  ctx.fillText('P', size * 0.5, size * 0.52)

  return canvas.toBuffer('image/png')
}

for (const size of [192, 512]) {
  const buf = drawIcon(size)
  const out = join(OUT_DIR, `icon-${size}.png`)
  writeFileSync(out, buf)
  console.log(`✓ ${out} (${size}×${size})`)
}

console.log('\nİkonlar hazır → public/icons/')
