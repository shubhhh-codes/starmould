import sharp from "sharp";

export interface WatermarkInput {
  imageBuffer: Buffer;
  movementType: string;
  movementNumber?: string | null;
  partyName?: string | null;
  subplateCode?: string | null;
  stageKey?: string | null;
  serverUploadedAt?: Date; // Authoritative upload timestamp (UTC)
}

export interface ProcessedPhotoResult {
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
  format: "webp";
  watermarkText: string;
  serverUploadedAt: Date;
  istTimestampString: string;
}

const MOVEMENT_DISPLAY_NAMES: Record<string, string> = {
  purchase_inward: "PURCHASE INWARD",
  jobwork_outward: "JOBWORK OUTWARD",
  jobwork_inward: "JOBWORK RETURN INWARD",
  subplate_qc: "SUBPLATE QC INSPECTION",
  packing: "PACKING & VERIFICATION",
  dispatch: "CUSTOMER DISPATCH",
};

/**
 * Formats a Date object into server-authoritative IST string (Asia/Kolkata):
 * YYYY-MM-DD HH:mm:ss IST
 */
export function formatServerTimeToIST(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second} IST`;
}

/**
 * Escapes text for XML / SVG rendering to prevent XML injection or rendering breaks.
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

/**
 * Processes an uploaded raw image:
 * 1. Validates magic bytes / format.
 * 2. Normalizes orientation according to EXIF.
 * 3. Resizes if dimension exceeds 2048px (preserving maximum zoom detail for mould inspections while bounding byte size).
 * 4. Permanently overlays a high-contrast, brand-safe watermark banner with movement details and IST timestamp.
 * 5. Compresses and encodes to lossy WebP (quality 82, effort 4).
 */
export async function processAndWatermarkPhoto(
  input: WatermarkInput
): Promise<ProcessedPhotoResult> {
  // Use authoritative server upload timestamp (UTC)
  const serverUploadedAt = input.serverUploadedAt || new Date();
  const istTimestampString = formatServerTimeToIST(serverUploadedAt);

  const movementLabel =
    MOVEMENT_DISPLAY_NAMES[input.movementType] || input.movementType.toUpperCase();
  const docRef = input.movementNumber ? ` • ${input.movementNumber}` : "";
  const partyRef = input.partyName ? `PARTY: ${input.partyName}` : "";
  const subplateRef = input.subplateCode ? ` • ITEM: ${input.subplateCode}` : "";
  const stageRef = input.stageKey ? ` (${input.stageKey})` : "";

  // Canonical watermark textual representation
  const watermarkText = [
    `STARMOULD ERP • ${movementLabel}${docRef}`,
    `${partyRef}${subplateRef}${stageRef}`.trim(),
    `SERVER UPLOAD: ${istTimestampString}`,
  ]
    .filter(Boolean)
    .join(" | ");

  // Step 1: Normalize orientation (auto-rotate according to EXIF) and bound dimension
  const MAX_DIM = 2048;
  const initialPipeline = sharp(input.imageBuffer).rotate();
  const preMeta = await initialPipeline.metadata();

  let targetWidth = preMeta.width || 640;
  let targetHeight = preMeta.height || 480;

  if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
    if (targetWidth > targetHeight) {
      targetHeight = Math.round((targetHeight * MAX_DIM) / targetWidth);
      targetWidth = MAX_DIM;
    } else {
      targetWidth = Math.round((targetWidth * MAX_DIM) / targetHeight);
      targetHeight = MAX_DIM;
    }
  }

  // Obtain normalized raster buffer after rotation & bounded resize
  const normalizedBuffer = await sharp(input.imageBuffer)
    .rotate()
    .resize(targetWidth, targetHeight, { fit: "inside", withoutEnlargement: true })
    .toBuffer();

  const finalMeta = await sharp(normalizedBuffer).metadata();
  const actualWidth = finalMeta.width || targetWidth;
  const actualHeight = finalMeta.height || targetHeight;

  // Step 2: Ensure minimum width for legible text banner (min 360px)
  const minBannerWidth = 360;
  const padRight = actualWidth < minBannerWidth ? minBannerWidth - actualWidth : 0;
  const bannerWidth = actualWidth + padRight;

  // Banner height scales with image height, min 64px, max 130px
  const bannerHeight = Math.max(64, Math.min(130, Math.round(actualHeight * 0.12)));

  // Extend the bottom of the image for the watermark footer so original content is never hidden
  const extendedBuffer = await sharp(normalizedBuffer)
    .extend({
      top: 0,
      bottom: bannerHeight,
      left: 0,
      right: padRight,
      background: { r: 9, g: 13, b: 22, alpha: 1 },
    })
    .toBuffer();

  const extendedMeta = await sharp(extendedBuffer).metadata();
  const finalCanvasWidth = extendedMeta.width || bannerWidth;
  const finalCanvasHeight = extendedMeta.height || actualHeight + bannerHeight;

  // SVG font sizes and positions
  const paddingX = Math.round(finalCanvasWidth * 0.025);
  const fontSizeTitle = Math.max(12, Math.min(20, Math.round(bannerHeight * 0.22)));
  const fontSizeMeta = Math.max(10, Math.min(16, Math.round(bannerHeight * 0.18)));
  const fontSizeTimestamp = Math.max(10, Math.min(15, Math.round(bannerHeight * 0.16)));

  const line1Y = Math.round(bannerHeight * 0.32);
  const line2Y = Math.round(bannerHeight * 0.60);
  const line3Y = Math.round(bannerHeight * 0.86);

  // Truncate overly long text safely so it never clips or breaks SVG
  const maxChars = Math.max(30, Math.floor(finalCanvasWidth / 10));
  const truncate = (s: string) => (s.length > maxChars ? s.slice(0, maxChars - 3) + "..." : s);

  const line1 = escapeXml(truncate(`STARMOULD ERP • ${movementLabel}${docRef}`));
  const line2 = escapeXml(truncate(`${partyRef}${subplateRef}${stageRef}`.trim() || "STARMOULD VERIFIED MOVEMENT"));
  const line3 = escapeXml(`VERIFIED UPLOAD: ${istTimestampString}`);

  // SVG Watermark overlay
  const watermarkSvg = `
    <svg width="${finalCanvasWidth}" height="${bannerHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#090d16" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#020617" stop-opacity="1.0" />
        </linearGradient>
      </defs>
      <!-- Background banner -->
      <rect x="0" y="0" width="${finalCanvasWidth}" height="${bannerHeight}" fill="url(#bgGrad)" />
      <!-- Left accent indicator bar -->
      <rect x="0" y="0" width="8" height="${bannerHeight}" fill="#3b82f6" />
      
      <!-- Text content -->
      <text x="${paddingX + 10}" y="${line1Y}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSizeTitle}px" font-weight="700" fill="#ffffff">
        ${line1}
      </text>
      <text x="${paddingX + 10}" y="${line2Y}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSizeMeta}px" font-weight="500" fill="#93c5fd">
        ${line2}
      </text>
      <text x="${paddingX + 10}" y="${line3Y}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSizeTimestamp}px" font-weight="600" fill="#38bdf8">
        ${line3}
      </text>
    </svg>
  `;

  // Apply composite watermark at the extended footer (top: actualHeight is always >= 0)
  const watermarkedBuffer = await sharp(extendedBuffer)
    .composite([
      {
        input: Buffer.from(watermarkSvg),
        top: actualHeight,
        left: 0,
      },
    ])
    .webp({
      quality: 82,
      effort: 4,
    })
    .toBuffer();

  return {
    buffer: watermarkedBuffer,
    width: finalCanvasWidth,
    height: finalCanvasHeight,
    sizeBytes: watermarkedBuffer.length,
    format: "webp",
    watermarkText,
    serverUploadedAt,
    istTimestampString,
  };
}

