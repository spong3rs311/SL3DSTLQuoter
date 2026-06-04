const { google } = require('googleapis');
const { Readable } = require('stream');

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

async function uploadFile(buffer, filename, folderId) {
  const drive = getDriveClient();
  try {
    const res = await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType: 'application/octet-stream', body: Readable.from(buffer) },
      fields: 'id,webViewLink',
    });
    return { fileId: res.data.id, webViewLink: res.data.webViewLink };
  } catch (err) {
    throw new Error(`Drive upload failed for "${filename}": ${err.message}`);
  }
}

async function moveFile(fileId, targetFolderId) {
  const drive = getDriveClient();
  try {
    const file = await drive.files.get({ fileId, fields: 'parents' });
    const previousParents = (file.data.parents || []).join(',');
    await drive.files.update({
      fileId,
      addParents: targetFolderId,
      removeParents: previousParents,
      fields: 'id,parents',
    });
  } catch (err) {
    throw new Error(`Drive move failed for file "${fileId}": ${err.message}`);
  }
}

async function listFilesOlderThan(folderId, hours) {
  const drive = getDriveClient();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and createdTime < '${cutoff}' and trashed = false`,
      fields: 'files(id,name,createdTime)',
    });
    return res.data.files || [];
  } catch (err) {
    throw new Error(`Drive list failed for folder "${folderId}": ${err.message}`);
  }
}

async function deleteFile(fileId) {
  const drive = getDriveClient();
  try {
    await drive.files.delete({ fileId });
  } catch (err) {
    throw new Error(`Drive delete failed for file "${fileId}": ${err.message}`);
  }
}

module.exports = { uploadFile, moveFile, listFilesOlderThan, deleteFile };
