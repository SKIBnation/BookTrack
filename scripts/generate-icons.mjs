import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#000000"/>
  <rect x="148" y="96" width="216" height="320" rx="28" fill="none" stroke="#30D158" stroke-width="28"/>
  <path d="M196 196 H316" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round"/>
  <path d="M196 256 H316" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round"/>
  <path d="M196 316 H268" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round"/>
</svg>`

const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#000000"/>
  <g transform="translate(256 256) scale(0.72) translate(-256 -256)">
    <rect x="148" y="96" width="216" height="320" rx="28" fill="none" stroke="#30D158" stroke-width="28"/>
    <path d="M196 196 H316" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round"/>
    <path d="M196 256 H316" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round"/>
    <path d="M196 316 H268" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round"/>
  </g>
</svg>`

async function png(svg, size, file) {
  const buffer = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  await writeFile(file, buffer)
}

await png(icon, 192, 'public/pwa-192x192.png')
await png(icon, 512, 'public/pwa-512x512.png')
await png(icon, 180, 'public/apple-touch-icon.png')
await png(maskable, 512, 'public/pwa-maskable-512x512.png')
