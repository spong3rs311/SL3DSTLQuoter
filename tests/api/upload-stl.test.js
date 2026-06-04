jest.mock('formidable', () => jest.fn());
jest.mock('fs');
jest.mock('../../api/lib/drive');
jest.mock('../../api/lib/config');

const formidable = require('formidable');
const fs = require('fs');
const { uploadFile } = require('../../api/lib/drive');
const { loadConfig } = require('../../api/lib/config');
const handler = require('../../api/upload-stl');

function mockRes() {
  const res = {};
  res.setHeader = jest.fn();
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
}

const STL_FILE = { originalFilename: 'bracket.stl', filepath: '/tmp/upload_abc' };
const DRIVE_RESULT = { fileId: 'file123', webViewLink: 'https://drive.google.com/file/d/file123' };

let mockParse;

beforeEach(() => {
  jest.clearAllMocks();
  mockParse = jest.fn();
  formidable.mockReturnValue({ parse: mockParse });
  loadConfig.mockReturnValue({ max_stl_size_mb: 50 });
  fs.readFileSync.mockReturnValue(Buffer.from('stl data'));
  uploadFile.mockResolvedValue(DRIVE_RESULT);
  process.env.GOOGLE_DRIVE_TEMP_FOLDER_ID = 'temp-folder-id';
});

describe('OPTIONS preflight', () => {
  it('returns 200 with CORS headers', async () => {
    const req = { method: 'OPTIONS' };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });
});

describe('method guard', () => {
  it('returns 405 for GET requests', async () => {
    const req = { method: 'GET' };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });
});

describe('happy path', () => {
  it('parses the form, uploads the file, and returns fileId + driveLink', async () => {
    mockParse.mockResolvedValue([{}, { stl: [STL_FILE] }]);

    const req = { method: 'POST' };
    const res = mockRes();

    await handler(req, res);

    expect(fs.readFileSync).toHaveBeenCalledWith('/tmp/upload_abc');
    expect(uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'bracket.stl',
      'temp-folder-id'
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      fileId: 'file123',
      driveLink: 'https://drive.google.com/file/d/file123',
    });
  });
});

describe('validation errors', () => {
  it('returns 413 when formidable throws a size-exceeded error', async () => {
    const err = new Error('maxFileSize exceeded');
    err.httpCode = 413;
    mockParse.mockRejectedValue(err);

    const req = { method: 'POST' };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: 'File exceeds the 50 MB limit' });
  });

  it('returns 400 when formidable throws a generic parse error', async () => {
    mockParse.mockRejectedValue(new Error('Unexpected token'));

    const req = { method: 'POST' };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to parse upload' });
  });

  it('returns 400 when no stl field is present in the form', async () => {
    mockParse.mockResolvedValue([{}, {}]);

    const req = { method: 'POST' };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No file provided' });
  });

  it('returns 400 when the uploaded file is not an .stl', async () => {
    mockParse.mockResolvedValue([{}, { stl: [{ originalFilename: 'model.obj', filepath: '/tmp/x' }] }]);

    const req = { method: 'POST' };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Only .stl files are accepted' });
  });

  it('accepts filenames with uppercase .STL extension', async () => {
    mockParse.mockResolvedValue([{}, { stl: [{ originalFilename: 'PART.STL', filepath: '/tmp/x' }] }]);

    const req = { method: 'POST' };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('upstream failures', () => {
  it('returns 500 when fs.readFileSync throws', async () => {
    mockParse.mockResolvedValue([{}, { stl: [STL_FILE] }]);
    fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

    const req = { method: 'POST' };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to read uploaded file' });
  });

  it('returns 500 when Drive upload fails', async () => {
    mockParse.mockResolvedValue([{}, { stl: [STL_FILE] }]);
    uploadFile.mockRejectedValue(new Error('403 Forbidden'));

    const req = { method: 'POST' };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to store file — please try again' });
  });
});
