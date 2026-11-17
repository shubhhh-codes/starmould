import sharp from "sharp";
import { processAndWatermarkPhoto } from "../src/lib/r2/watermark";

async function main() {
  console.log("1. Testing 640x480 standard JPEG...");
  const b1 = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 100, g: 150, b: 200 } } }).jpeg().toBuffer();
  const r1 = await processAndWatermarkPhoto({ imageBuffer: b1, movementType: "purchase_inward", partyName: "Kamnath Tooling" });
  console.log("   -> Result:", r1.width, "x", r1.height, `(${r1.sizeBytes} bytes)`);

  console.log("2. Testing 64x64 small blank PNG...");
  const b2 = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer();
  const r2 = await processAndWatermarkPhoto({ imageBuffer: b2, movementType: "jobwork_outward", partyName: "Small Test" });
  console.log("   -> Result:", r2.width, "x", r2.height, `(${r2.sizeBytes} bytes)`);

  console.log("3. Testing 1x1 tiny blank PNG...");
  const b3 = await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
  const r3 = await processAndWatermarkPhoto({ imageBuffer: b3, movementType: "subplate_qc", partyName: "Tiny" });
  console.log("   -> Result:", r3.width, "x", r3.height, `(${r3.sizeBytes} bytes)`);

  console.log("4. Testing 900x1600 portrait JPEG...");
  const b4 = await sharp({ create: { width: 900, height: 1600, channels: 3, background: { r: 50, g: 100, b: 50 } } }).jpeg().toBuffer();
  const r4 = await processAndWatermarkPhoto({ imageBuffer: b4, movementType: "dispatch", partyName: "Portrait Customer" });
  console.log("   -> Result:", r4.width, "x", r4.height, `(${r4.sizeBytes} bytes)`);

  console.log("5. Testing long party & movement strings...");
  const r5 = await processAndWatermarkPhoto({
    imageBuffer: b1,
    movementType: "purchase_inward",
    movementNumber: "VERY_LONG_DOCUMENT_NUMBER_1234567890_ABCDEFGHIJKLMN_OPQRSTUVWXYZ",
    partyName: "SHREE GANESH PRECISION ENGINEERING TOOLS AND EQUIPMENT PRIVATE LIMITED GUJARAT INDIA",
    subplateCode: "LONG_SUBPLATE_IDENTIFIER_M01_PART_001_SPECIAL_TESTING_PIECE",
  });
  console.log("   -> Result:", r5.width, "x", r5.height, `(${r5.sizeBytes} bytes)`);

  console.log("\n>>> ALL WATERMARK TESTS COMPLETED SUCCESSFULLY! <<<");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

