const sharp = require('sharp');
const fs = require('fs');

async function generateRoundedFavicons() {
  const srcPath = 'C:/Users/Design-2/.gemini/antigravity/brain/bd8b1803-303b-4ddc-9e4e-ecdb10da3fe4/.user_uploaded/media_1792839903959_f4c6f948.jpg';

  // 1. Extract centered logo
  const logoBuf = await sharp(srcPath)
    .extract({ left: 42, top: 42, width: 510, height: 510 })
    .resize(430, 430)
    .png()
    .toBuffer();

  // 2. Create 512x512 white rounded rectangle with transparent background (corner radius = 96px, ~18.75% standard squircle)
  const roundedRectSvg = Buffer.from(
    `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="512" height="512" rx="96" ry="96" fill="#ffffff"/>
    </svg>`
  );

  const baseWithRoundedWhite = await sharp(roundedRectSvg).png().toBuffer();

  // 3. Composite centered logo on the rounded white card
  const badge512 = await sharp(baseWithRoundedWhite)
    .composite([{ input: logoBuf, left: 41, top: 41 }])
    .ensureAlpha()
    .png({ colorType: 6 }) // Strict RGBA
    .toBuffer();

  // Save standard icon files
  fs.writeFileSync('public/icon-512.png', badge512);

  // Generate 192x192, 180x180, 32x32, 16x16
  const badge192 = await sharp(badge512).resize(192, 192).ensureAlpha().png({ colorType: 6 }).toBuffer();
  fs.writeFileSync('public/icon-192.png', badge192);

  const badge180 = await sharp(badge512).resize(180, 180).ensureAlpha().png({ colorType: 6 }).toBuffer();
  fs.writeFileSync('src/app/apple-icon.png', badge180);
  fs.writeFileSync('public/apple-icon.png', badge180);

  const badge32 = await sharp(badge512).resize(32, 32).ensureAlpha().png({ colorType: 6 }).toBuffer();
  fs.writeFileSync('src/app/icon.png', badge32);
  fs.writeFileSync('public/icon.png', badge32);

  const badge16 = await sharp(badge512).resize(16, 16).ensureAlpha().png({ colorType: 6 }).toBuffer();

  // Next.js App Router ICO generation with strict RGBA colorType: 6
  const sizes = [
    { size: 16, buffer: badge16 },
    { size: 32, buffer: badge32 },
  ];

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);

  const entries = Buffer.alloc(16 * sizes.length);
  let offset = 6 + 16 * sizes.length;

  for (let i = 0; i < sizes.length; i++) {
    const item = sizes[i];
    const e = i * 16;
    entries.writeUInt8(item.size, e + 0);
    entries.writeUInt8(item.size, e + 1);
    entries.writeUInt8(0, e + 2);
    entries.writeUInt8(0, e + 3);
    entries.writeUInt16LE(1, e + 4);
    entries.writeUInt16LE(32, e + 6); // 32 bpp (RGBA)
    entries.writeUInt32LE(item.buffer.length, e + 8);
    entries.writeUInt32LE(offset, e + 12);
    offset += item.buffer.length;
  }

  const icoBuffer = Buffer.concat([header, entries, ...sizes.map((s) => s.buffer)]);
  fs.writeFileSync('src/app/favicon.ico', icoBuffer);
  fs.writeFileSync('public/favicon.ico', icoBuffer);

  console.log('All rounded favicons and RGBA favicon.ico generated successfully!');
}

generateRoundedFavicons().catch(err => {
  console.error('Error generating rounded favicons:', err);
  process.exit(1);
});
