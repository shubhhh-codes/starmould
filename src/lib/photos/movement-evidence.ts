/** Evidence travels inside the inventory request, committing together with the movement. */
export function movementEvidence(photos: { id: number; photo_batch_id?: string }[]) {
  const ids = [...new Set(photos.map(p => p.id))].sort((a, b) => a - b);
  const batches = [...new Set(photos.map(p => p.photo_batch_id).filter(Boolean))];
  if (!ids.length || batches.length > 1) throw new Error("Upload photos for this movement before saving");
  return { photoIds: ids, photoBatchId: batches[0] || `legacy_photo_${ids[0]}` };
}
