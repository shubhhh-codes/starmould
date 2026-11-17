function backupFilename(capturedAt) {
  const date = new Date(capturedAt);
  if (!Number.isFinite(date.getTime())) throw new Error('INVALID_BACKUP_DATE');
  const ist = new Date(date.getTime() + 330 * 60000).toISOString();
  return `starmould_backup_${ist.slice(0, 10)}_${ist.slice(11, 19).replaceAll(':', '-')}_IST.sql`;
}
module.exports = { backupFilename };
