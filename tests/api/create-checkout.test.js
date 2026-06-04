jest.mock('stripe');
jest.mock('../../api/lib/pricing');
jest.mock('../../api/lib/config');

const Stripe = require('stripe');
const { derivePrice } = require('../../api/lib/pricing');
const { loadConfig } = require('../../api/lib/config');
const handler = require('../../api/create-checkout');

function mockRes() {
  const res = {};
  res.setHeader = jest.fn();
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
}

const PRICE_RESULT = {
  price_cents: 1850,
  price_usd: 18.50,
  weight_g: 42.5,
  print_time_hours: 1.25,
  breakdown: {},
};

const VALID_BODY = {
  fileId: 'drive-file-123',
  driveLink: 'https://drive.google.com/file/d/drive-file-123',
  filament_id: 'pla',
  strength_preset: 'standard',
  volume_cm3: 12.5,
  supports_likely: false,
  stl_filename: 'bracket.stl',
  customer_name: 'Jane Doe',
  customer_email: 'jane@example.com',
};

let mockSessionCreate;

beforeEach(() => {
  jest.clearAllMocks();

  mockSessionCreate = jest.fn().mockResolvedValue({
    url: 'https://checkout.stripe.com/pay/cs_test_abc123',
  });
  Stripe.mockImplementation(() => ({
    checkout: { sessions: { create: mockSessionCreate } },
  }));

  derivePrice.mockReturnValue(PRICE_RESULT);
  loadConfig.mockReturnValue({ filaments: [], strength_presets: {} });

  process.env.STRIPE_SECRET_KEY = 'sk_test_key';
  process.env.SQUARESPACE_QUOTE_PAGE_URL = 'https://www.saguarolabs3d.com/quote';
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

describe('body parsing', () => {
  it('accepts pre-parsed object body', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: VALID_BODY }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('parses a JSON string body', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: JSON.stringify(VALID_BODY) }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 400 for malformed JSON string', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: '{bad json' }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid JSON body' });
  });
});

describe('field validation', () => {
  const requiredFields = [
    'fileId', 'driveLink', 'filament_id', 'strength_preset',
    'volume_cm3', 'stl_filename', 'customer_name', 'customer_email',
  ];

  requiredFields.forEach((field) => {
    it(`returns 400 when ${field} is missing`, async () => {
      const body = { ...VALID_BODY };
      delete body[field];
      const res = mockRes();
      await handler({ method: 'POST', body }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });
  });
});

describe('input validation', () => {
  it('returns 400 for an invalid email format', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { ...VALID_BODY, customer_email: 'notanemail' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email address' });
  });

  it('returns 400 when customer_name exceeds 100 characters', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { ...VALID_BODY, customer_name: 'a'.repeat(101) } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Name too long' });
  });

  it('returns 400 when customer_email exceeds 254 characters', async () => {
    const res = mockRes();
    const longEmail = 'a'.repeat(244) + '@example.com';
    await handler({ method: 'POST', body: { ...VALID_BODY, customer_email: longEmail } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Email too long' });
  });

  it('returns 400 when stl_filename exceeds 255 characters', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { ...VALID_BODY, stl_filename: 'a'.repeat(256) } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Filename too long' });
  });
});

describe('happy path', () => {
  it('re-derives price server-side and creates a Stripe session', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: VALID_BODY }, res);

    // Price must come from derivePrice, not the request
    expect(derivePrice).toHaveBeenCalledWith(
      { volume_cm3: 12.5, supports_likely: false },
      'pla',
      'standard',
      expect.any(Object)
    );

    const sessionArgs = mockSessionCreate.mock.calls[0][0];
    expect(sessionArgs.line_items[0].price_data.unit_amount).toBe(1850);
    expect(sessionArgs.customer_email).toBe('jane@example.com');
    expect(sessionArgs.success_url).toContain('?status=success');
    expect(sessionArgs.cancel_url).toContain('?status=cancelled');
  });

  it('embeds all order metadata in the Stripe session', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: VALID_BODY }, res);

    const { metadata } = mockSessionCreate.mock.calls[0][0];
    expect(metadata.file_id).toBe('drive-file-123');
    expect(metadata.drive_link).toContain('drive-file-123');
    expect(metadata.customer_name).toBe('Jane Doe');
    expect(metadata.customer_email).toBe('jane@example.com');
    expect(metadata.stl_filename).toBe('bracket.stl');
    expect(metadata.filament_id).toBe('pla');
    expect(metadata.strength_preset).toBe('standard');
    expect(metadata.price_cents).toBe('1850');
    expect(metadata.weight_g).toBe('42.5');
    expect(metadata.print_time_hours).toBe('1.25');
  });

  it('returns the Stripe checkout URL', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: VALID_BODY }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: 'https://checkout.stripe.com/pay/cs_test_abc123',
    });
  });
});

describe('error handling', () => {
  it('returns 400 when derivePrice throws (e.g. unknown filament)', async () => {
    derivePrice.mockImplementation(() => { throw new Error('Unknown filament: xyz'); });
    const res = mockRes();
    await handler({ method: 'POST', body: { ...VALID_BODY, filament_id: 'xyz' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unknown filament: xyz' });
  });

  it('returns 500 when Stripe session creation fails', async () => {
    mockSessionCreate.mockRejectedValue(new Error('Invalid API key'));
    const res = mockRes();
    await handler({ method: 'POST', body: VALID_BODY }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create checkout session' });
  });
});
