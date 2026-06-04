const formidable = require('formidable');
const fs = require('fs');
const { uploadFile } = require('./lib/drive');
const { loadConfig } = require('./lib/config');
const { applyCors } = require('./lib/cors');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const config = loadConfig();
  const maxBytes = config.max_stl_size_mb * 1024 * 1024;

  const form = formidable({ maxFileSize: maxBytes });

  let files;
  try {
    [, files] = await form.parse(req);
  } catch (err) {
    if (err.httpCode === 413) {
      return res.status(413).json({ error: `File exceeds the ${config.max_stl_size_mb} MB limit` });
    }
    return res.status(400).json({ error: 'Failed to parse upload' });
  }

  const file = files.stl?.[0];
  if (!file) return res.status(400).json({ error: 'No file provided' });

  const filename = file.originalFilename || '';
  if (!filename.toLowerCase().endsWith('.stl')) {
    return res.status(400).json({ error: 'Only .stl files are accepted' });
  }

  let buffer;
  try {
    buffer = fs.readFileSync(file.filepath);
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to read uploaded file' });
  }

  try {
    const { fileId, webViewLink } = await uploadFile(
      buffer,
      filename,
      process.env.GOOGLE_DRIVE_TEMP_FOLDER_ID
    );
    return res.status(200).json({ fileId, driveLink: webViewLink });
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to store file — please try again' });
  }
};
