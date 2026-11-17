import JSZip from "jszip";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getFromR2Buffer, getR2BucketName } from "./client";
import { photoLayoutContext } from "@/lib/photos/storage-moves";
import { folderSegment, photoObjectKey } from "@/lib/photos/storage-layout";
import { formatServerTimeToIST } from "./watermark";

export interface ExportZipOptions {
  scope: "project" | "mould" | "bulk";
  projectCodes: string[];
  mouldCode?: string | null;
  userId: number;
}

export interface ExportZipResult {
  exportId: string;
  filename: string;
  zipBuffer: Buffer;
  totalPhotos: number;
  totalBytes: number;
  csvContent: string;
}

function protectCsvCell(raw: any): string {
  if (raw === null || raw === undefined) return '""';
  let str = String(raw).trim();
  // Protect against spreadsheet formula injection (=, +, -, @, tab, CR)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Escape inner double quotes
  return `"${str.replace(/"/g, '""')}"`;
}

/** ZIP mirrors mould/category/document folders, including shared evidence in each mould. */
export async function generatePhotoBackupZip(
  options: ExportZipOptions
): Promise<ExportZipResult> {
  const exportId = `EXP_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const zip = new JSZip();
  const rootFolderName = folderSegment(getR2BucketName());
  const rootFolder = zip.folder(rootFolderName);

  if (!rootFolder) {
    throw new Error("Failed to initialize zip root folder");
  }

  // 1. Fetch photo associations for given project codes
  let assocQuery = supabaseAdmin
    .from("photo_project_associations")
    .select(`
      photo_id,
      project_code,
      mould_code,
      movement_photos!inner (
        id,
        r2_key,
        original_filename,
        file_size_bytes,
        movement_type,
        movement_id,
        movement_number,
        party_name,
        subplate_id,
        stage_key,
        watermark_text,
        server_uploaded_at,
        deleted_at,
        uploaded_by,
        users:uploaded_by ( name )
      )
    `)
    .in("project_code", options.projectCodes);

  if (options.mouldCode) {
    assocQuery = assocQuery.eq("mould_code", options.mouldCode);
  }

  assocQuery = assocQuery.order("photo_id").order("project_code");
  const associations: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: page, error } = await assocQuery.range(offset, offset + 999);
    if (error) throw new Error(`Failed to query photo associations: ${error.message}`);
    associations.push(...(page || []));
    if (!page || page.length < 1000) break;
  }

  const activeAssocs = (associations || []).filter((a: any) => {
    const photo = Array.isArray(a.movement_photos) ? a.movement_photos[0] : a.movement_photos;
    return photo && !photo.deleted_at;
  });

  // CSV headers (Excel-compatible UTF-8 with BOM)
  const csvRows: string[][] = [
    [
      "Photo ID",
      "Archive Relative Path",
      "Project Code",
      "Mould Code",
      "Movement Type",
      "Movement Number",
      "Party Name",
      "Subplate / Item ID",
      "Stage Key",
      "Uploader",
      "Upload Time (IST)",
      "Upload Time (UTC Canonical)",
      "File Size (Bytes)",
      "R2 Object Key",
    ],
  ];

  let addedPhotosCount = 0;

  const archived = new Set<string>();
  for (const assoc of activeAssocs) {
    const photo: any = Array.isArray(assoc.movement_photos)
      ? assoc.movement_photos[0]
      : assoc.movement_photos;
    if (!photo) continue;
    const archiveIdentity = `${photo.id}:${assoc.project_code}`;
    if (archived.has(archiveIdentity)) continue;
    archived.add(archiveIdentity);

    const buffer = await getFromR2Buffer(photo.r2_key);
    if (!buffer) {
      throw new Error(`Photo ${photo.id} is missing from storage. Restore it before creating a complete backup.`);
    }

    const context = await photoLayoutContext(photo);
    const archivePathWithoutRoot = photoObjectKey(photo, context, assoc.project_code);
    const istString = formatServerTimeToIST(new Date(photo.server_uploaded_at));
    rootFolder.file(archivePathWithoutRoot, buffer);

    addedPhotosCount++;

    // Add row to CSV
    csvRows.push([
      String(photo.id),
      archivePathWithoutRoot,
      assoc.project_code || "",
      assoc.mould_code || "",
      photo.movement_type || "",
      photo.movement_number || "",
      photo.party_name || "",
      photo.subplate_id ? String(photo.subplate_id) : "",
      photo.stage_key || "",
      photo.users?.name || "System",
      istString,
      photo.server_uploaded_at,
      String(buffer.length),
      photo.r2_key,
    ]);
  }

  // Generate CSV text with UTF-8 BOM (\uFEFF) for Excel compatibility
  const csvContent =
    "\uFEFF" +
    csvRows
      .map((row) => row.map((val) => protectCsvCell(val)).join(","))
      .join("\r\n");

  // Add Photo-Index.csv at root
  rootFolder.file("Photo-Index.csv", csvContent);

  // Generate final ZIP Buffer
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const primaryProject =
    options.projectCodes.length === 1
      ? options.projectCodes[0]
      : `${options.projectCodes.length}_Projects`;
  const filename = `${primaryProject}_Photo_Backup_${exportId}.zip`;

  // Record export job in DB
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24-hr expiry
  await supabaseAdmin.from("photo_export_jobs").insert({
    id: exportId,
    scope: options.scope,
    target_codes: options.projectCodes,
    status: "completed",
    total_photos: addedPhotosCount,
    archive_size_bytes: zipBuffer.length,
    created_by: options.userId,
    expires_at: expiresAt,
  });

  return {
    exportId,
    filename,
    zipBuffer,
    totalPhotos: addedPhotosCount,
    totalBytes: zipBuffer.length,
    csvContent,
  };
}
