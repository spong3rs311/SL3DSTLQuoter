jest.mock('formidable', () => jest.fn());
jest.mock('fs');
jest.mock('../../api/lib/drive');
jest.mock('../../api/lib/email');
jest.mock('../../api/lib/config');

const formidable = require('formidable');
const fs = require('fs');
const { uploadFile } = require('../../api/lib/drive');
const { sendOwnerManualQuoteAlert } = require('../../api/lib/email');
const { loadConfig } = require('../../api/lib/config');
const handler = require('../../api/manual-quote');

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

const VALID_FIELDS = {
  name: ['Jane Doe'],
  email: ['jane@example.com'],
  notes: ['Need it in red'],
};

let mockParse;

beforeEach(() => {
  jest.clearAllMocks();

  mockParse = jest.fn();
  formidable.mockReturnValue({ parse: mockParse });
  loadConfig.mockReturnValue({ max_stl_size_mb: 50 });
  fs.readFileSync.mockReturnValue(Buffer.from('stl data'));
  uploadFile.mockResolvedValue(DRIVE_RESULT);
  sendOwnerManualQuoteAlert.mockResolvedValue(undefined);

  process.env.GOOGLE_DRIVE_TEMP_FOLDER_ID = 'temp-folder-id';
});

describe('OPTIONS preflight', () => {
  it('returns 200', async () => {
    const res = mockRes();
    await handler({ method: 'OPTIONS' }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });
});

describe('method guard', () => {
  it('returns 405 for GET', async () => {
    const res = mockRes();
    await handler({ method: 'GET' }, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

describe('form parse errors', () => {
  it('returns 413 when file exceeds size limit', async () => {
    const err = new Error('maxFileSize exceeded');
    err.httpCode = 413;
    mockParse.mockRejectedValue(err);

    const res = mockRes();
    await handler({ method: 'POST' }, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: 'File exceeds the 50 MB limit' });
  });

  it('returns 400 for a generic parse error', async () => {
    mockParse.mockRejectedValue(new Error('Unexpected token'));

    const res = mockRes();
    await handler({ method: 'POST' }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to parse form' });
  });
});

describe('field validation', () => {
  it('returns 400 when name is missing', async () => {
    mockParse.mockResolvedValue([{ email: ['jane@example.com'] }, {}]);
    const res = mockRes();
    await handler({ method: 'POST' }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Name and email are required' });
  });

  it('returns 400 when email is missing', async () => {
    mockParse.mockResolvedValue([{ name: ['Jane'] }, {}]);
    const res = mockRes();
    await handler({ method: 'POST' }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Name and email are required' });
  });

  it('returns 400 for an invalid email format', async () => {
    mockParse.mockResolvedValue([{ name: ['Jane'], email: ['notanemail'] }, {}]);
    const res = mockRes();
    await handler({ method: 'POST' }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email address' });
  });

  it('returns 400 when an uploaded file is not an .stl', async () => {
    mockParse.mockResolvedValue([
      VALID_FIELDS,
      { stl: [{ originalFilename: 'model.obj', filepath: '/tmp/x' }] },
    ]);
    const res = mockRes();
    await handler({ method: 'POST' }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Only .stl files are accepted' });
  });
});

describe('happy path — no file', () => {
  it('sends alert with null driveLink and returns 200', async () => {
    mockParse.mockResolvedValue([VALID_FIELDS, {}]);
    const res = mockRes();
    await handler({ method: 'POST' }, res);

    expect(uploadFile).not.toHaveBeenCalled();
    expect(sendOwnerManualQuoteAlert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Jane Doe', email: 'jane@example.com', notes: 'Need it in red' }),
      null
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('passes undefined notes when the notes field is absent', async () => {
    mockParse.mockResolvedValue([{ name: ['Jane'], email: ['jane@example.com'] }, {}]);
    const res = mockRes();
    await handler({ method: 'POST' }, res);

    const customerInfo = sendOwnerManualQuoteAlert.mock.calls[0][0];
    expect(customerInfo.notes).toBeUndefined();
  });
});

describe('happy path — with file', () => {
  it('uploads the file, sends alert with driveLink, and returns 200', async () => {
    mockParse.mockResolvedValue([VALID_FIELDS, { stl: [STL_FILE] }]);
    const res = mockRes();
    await handler({ method: 'POST' }, res);

    expect(uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'bracket.stl',
      'temp-folder-id'
    );
    expect(sendOwnerManualQuoteAlert).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'bracket.stl' }),
      'https://drive.google.com/file/d/file123'
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('error handling', () => {
  it('still sends the alert when Drive upload fails (non-fatal)', async () => {
    mockParse.mockResolvedValue([VALID_FIELDS, { stl: [STL_FILE] }]);
    uploadFile.mockRejectedValue(new Error('403 Forbidden'));

    const res = mockRes();
    await handler({ method: 'POST' }, res);

    expect(sendOwnerManualQuoteAlert).toHaveBeenCalledWith(
      expect.any(Object),
      null
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 when sendOwnerManualQuoteAlert fails', async () => {
    mockParse.mockResolvedValue([VALID_FIELDS, {}]);
    sendOwnerManualQuoteAlert.mockRejectedValue(new Error('SMTP timeout'));

    const res = mockRes();
    await handler({ method: 'POST' }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to send quote request — please try again',
    });
  });
});
