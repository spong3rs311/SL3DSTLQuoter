const { listFilesOlderThan, deleteFile } = require('../lib/drive');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const folderId = process.env.GOOGLE_DRIVE_TEMP_FOLDER_ID;

  let files;
  try {
    files = await listFilesOlderThan(folderId, 24);
  } catch (err) {
    console.error('Cleanup list failed:', err.message);
    return res.status(500).json({ error: 'Failed to list temp files' });
  }

  const deleted = [];
  const failed = [];

  for (const file of files) {
    try {
      await deleteFile(file.id);
      deleted.push(file.id);
    } catch (err) {
      console.error(`Failed to delete ${file.id}:`, err.message);
      failed.push(file.id);
    }
  }

  return res.status(200).json({ deleted: deleted.length, failed: failed.length, ids: deleted });
};
