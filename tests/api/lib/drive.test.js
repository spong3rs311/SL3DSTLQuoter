// Mock googleapis before any imports so drive.js picks up the mock on require
jest.mock('googleapis', () => ({
  google: {
    auth: { GoogleAuth: jest.fn().mockImplementation(() => ({})) },
    drive: jest.fn(),
  },
}));

const { google } = require('googleapis');
const { uploadFile, moveFile, listFilesOlderThan, deleteFile } = require('../../../api/lib/drive');

let mockFiles;

beforeEach(() => {
  jest.clearAllMocks();

  mockFiles = {
    create: jest.fn(),
    get:    jest.fn(),
    update: jest.fn(),
    list:   jest.fn(),
    delete: jest.fn(),
  };

  google.drive.mockReturnValue({ files: mockFiles });
});

describe('uploadFile', () => {
  it('calls drive.files.create with correct params and returns fileId + webViewLink', async () => {
    mockFiles.create.mockResolvedValue({
      data: { id: 'file123', webViewLink: 'https://drive.google.com/file/d/file123' },
    });

    const buf = Buffer.from('stl data');
    const result = await uploadFile(buf, 'bracket.stl', 'folder-temp');

    expect(result).toEqual({ fileId: 'file123', webViewLink: 'https://drive.google.com/file/d/file123' });

    const callArg = mockFiles.create.mock.calls[0][0];
    expect(callArg.requestBody.name).toBe('bracket.stl');
    expect(callArg.requestBody.parents).toEqual(['folder-temp']);
    expect(callArg.fields).toBe('id,webViewLink');
  });

  it('throws a descriptive error when drive.files.create rejects', async () => {
    mockFiles.create.mockRejectedValue(new Error('403 Forbidden'));

    await expect(uploadFile(Buffer.from('x'), 'test.stl', 'folder-id'))
      .rejects.toThrow('Drive upload failed for "test.stl": 403 Forbidden');
  });
});

describe('moveFile', () => {
  it('gets current parents then updates with new parent', async () => {
    mockFiles.get.mockResolvedValue({ data: { parents: ['old-folder'] } });
    mockFiles.update.mockResolvedValue({ data: {} });

    await moveFile('file123', 'new-folder');

    expect(mockFiles.get).toHaveBeenCalledWith({ fileId: 'file123', fields: 'parents' });
    expect(mockFiles.update).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId:        'file123',
        addParents:    'new-folder',
        removeParents: 'old-folder',
      })
    );
  });

  it('handles files with multiple parents', async () => {
    mockFiles.get.mockResolvedValue({ data: { parents: ['folder-a', 'folder-b'] } });
    mockFiles.update.mockResolvedValue({ data: {} });

    await moveFile('file123', 'new-folder');

    const updateCall = mockFiles.update.mock.calls[0][0];
    expect(updateCall.removeParents).toBe('folder-a,folder-b');
  });

  it('throws a descriptive error when move fails', async () => {
    mockFiles.get.mockRejectedValue(new Error('File not found'));

    await expect(moveFile('bad-id', 'folder'))
      .rejects.toThrow('Drive move failed for file "bad-id": File not found');
  });
});

describe('listFilesOlderThan', () => {
  it('queries with correct folder and time filter and returns file list', async () => {
    const files = [
      { id: 'old1', name: 'old.stl', createdTime: '2024-01-01T00:00:00Z' },
    ];
    mockFiles.list.mockResolvedValue({ data: { files } });

    const result = await listFilesOlderThan('temp-folder', 24);

    expect(result).toEqual(files);

    const query = mockFiles.list.mock.calls[0][0].q;
    expect(query).toContain("'temp-folder' in parents");
    expect(query).toContain('trashed = false');
  });

  it('returns empty array when no files match', async () => {
    mockFiles.list.mockResolvedValue({ data: { files: [] } });

    const result = await listFilesOlderThan('temp-folder', 24);
    expect(result).toEqual([]);
  });

  it('returns empty array when data.files is undefined', async () => {
    mockFiles.list.mockResolvedValue({ data: {} });

    const result = await listFilesOlderThan('temp-folder', 24);
    expect(result).toEqual([]);
  });

  it('throws a descriptive error when list fails', async () => {
    mockFiles.list.mockRejectedValue(new Error('Network error'));

    await expect(listFilesOlderThan('folder', 24))
      .rejects.toThrow('Drive list failed for folder "folder": Network error');
  });
});

describe('deleteFile', () => {
  it('calls drive.files.delete with the correct fileId', async () => {
    mockFiles.delete.mockResolvedValue({});

    await deleteFile('file-to-delete');

    expect(mockFiles.delete).toHaveBeenCalledWith({ fileId: 'file-to-delete' });
  });

  it('throws a descriptive error when delete fails', async () => {
    mockFiles.delete.mockRejectedValue(new Error('Permission denied'));

    await expect(deleteFile('file-id'))
      .rejects.toThrow('Drive delete failed for file "file-id": Permission denied');
  });
});
