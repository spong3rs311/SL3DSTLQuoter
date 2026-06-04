jest.mock('../../../api/lib/drive');

const { listFilesOlderThan, deleteFile } = require('../../../api/lib/drive');
const handler = require('../../../api/cron/cleanup');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GOOGLE_DRIVE_TEMP_FOLDER_ID = 'temp-folder-id';
});

describe('method guard', () => {
  it('returns 405 for POST requests', async () => {
    const res = mockRes();
    await handler({ method: 'POST' }, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(listFilesOlderThan).not.toHaveBeenCalled();
  });
});

describe('list failure', () => {
  it('returns 500 when listFilesOlderThan throws', async () => {
    listFilesOlderThan.mockRejectedValue(new Error('Network error'));

    const res = mockRes();
    await handler({ method: 'GET' }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to list temp files' });
    expect(deleteFile).not.toHaveBeenCalled();
  });
});

describe('no old files', () => {
  it('returns zero counts when no files are older than 24h', async () => {
    listFilesOlderThan.mockResolvedValue([]);

    const res = mockRes();
    await handler({ method: 'GET' }, res);

    expect(deleteFile).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ deleted: 0, failed: 0, ids: [] });
  });
});

describe('happy path', () => {
  it('calls deleteFile for each old file and returns correct counts', async () => {
    const files = [
      { id: 'old1', name: 'a.stl' },
      { id: 'old2', name: 'b.stl' },
      { id: 'old3', name: 'c.stl' },
    ];
    listFilesOlderThan.mockResolvedValue(files);
    deleteFile.mockResolvedValue(undefined);

    const res = mockRes();
    await handler({ method: 'GET' }, res);

    expect(listFilesOlderThan).toHaveBeenCalledWith('temp-folder-id', 24);
    expect(deleteFile).toHaveBeenCalledTimes(3);
    expect(deleteFile).toHaveBeenCalledWith('old1');
    expect(deleteFile).toHaveBeenCalledWith('old2');
    expect(deleteFile).toHaveBeenCalledWith('old3');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      deleted: 3,
      failed: 0,
      ids: ['old1', 'old2', 'old3'],
    });
  });
});

describe('partial failures', () => {
  it('continues deleting after a failure and reports both counts', async () => {
    const files = [
      { id: 'old1', name: 'a.stl' },
      { id: 'old2', name: 'b.stl' },
      { id: 'old3', name: 'c.stl' },
    ];
    listFilesOlderThan.mockResolvedValue(files);
    deleteFile
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Permission denied'))
      .mockResolvedValueOnce(undefined);

    const res = mockRes();
    await handler({ method: 'GET' }, res);

    expect(deleteFile).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      deleted: 2,
      failed: 1,
      ids: ['old1', 'old3'],
    });
  });
});
