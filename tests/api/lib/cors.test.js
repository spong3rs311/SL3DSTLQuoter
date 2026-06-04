const { applyCors, ALLOWED_ORIGIN } = require('../../../api/lib/cors');

function mockRes() {
  const res = {};
  res.setHeader = jest.fn();
  res.status = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
}

describe('ALLOWED_ORIGIN', () => {
  it('is the Saguaro Labs production domain', () => {
    expect(ALLOWED_ORIGIN).toBe('https://www.saguarolabs3d.com');
  });
});

describe('applyCors', () => {
  it('sets CORS headers on every request', () => {
    const res = mockRes();
    applyCors({ method: 'POST' }, res);

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'POST, OPTIONS');
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type');
  });

  it('sets security headers on every request', () => {
    const res = mockRes();
    applyCors({ method: 'POST' }, res);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

  it('returns false and does not end the response for POST requests', () => {
    const res = mockRes();
    const done = applyCors({ method: 'POST' }, res);

    expect(done).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('returns true, sends 200, and ends the response for OPTIONS preflight', () => {
    const res = mockRes();
    const done = applyCors({ method: 'OPTIONS' }, res);

    expect(done).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });
});
