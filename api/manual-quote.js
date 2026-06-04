const formidable = require('formidable');
const fs = require('fs');
const { uploadFile } = require('./lib/drive');
const { sendOwnerManualQuoteAlert } = require('./lib/email');
const { loadConfig } = require('./lib/config');
const { applyCors } = require('./lib/cors');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const config = loadConfig();
  const maxBytes = config.max_stl_size_mb * 1024 * 1024;
  const form = formidable({ maxFileSize: maxBytes });

  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch (err) {
    if (err.httpCode === 413) {
      return res.status(413).json({ error: `File exceeds the ${config.max_stl_size_mb} MB limit` });
    }
    return res.status(400).json({ error: 'Failed to parse form' });
  }

  const name = fields.name?.[0]?.trim();
  const email = fields.email?.[0]?.trim();
  const notes = fields.notes?.[0]?.trim() || '';

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const file = files.stl?.[0];
  if (file) {
    const filename = file.originalFilename || '';
    if (!filename.toLowerCase().endsWith('.stl')) {
      return res.status(400).json({ error: 'Only .stl files are accepted' });
    }
  }

  let driveLink = null;
  if (file) {
    try {
      const buffer = fs.readFileSync(file.filepath);
      const { webViewLink } = await uploadFile(
        buffer,
        file.originalFilename,
        process.env.GOOGLE_DRIVE_TEMP_FOLDER_ID
      );
      driveLink = webViewLink;
    } catch (_err) {
      console.error('Manual quote file upload failed:', _err.message);
    }
  }

  try {
    await sendOwnerManualQuoteAlert(
      { name, email, notes: notes || undefined, filename: file?.originalFilename || null },
      driveLink
    );
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to send quote request — please try again' });
  }

  return res.status(200).json({ success: true });
};
