jest.mock('stripe');
jest.mock('../../api/lib/drive');
jest.mock('../../api/lib/email');

const Stripe = require('stripe');
const { moveFile } = require('../../api/lib/drive');
const { sendOwnerNotification, sendCustomerConfirmation } = require('../../api/lib/email');
const { Readable } = require('stream');
const handler = require('../../api/webhook');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(rawBody = '{}', method = 'POST', headers = {}) {
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
  const req = Readable.from([buf]);
  req.method = method;
  req.headers = { 'stripe-signature': 'test-sig', ...headers };
  return req;
}

const MOCK_METADATA = {
  file_id: 'drive-file-123',
  drive_link: 'https://drive.google.com/file/d/drive-file-123',
  customer_name: 'Jane Doe',
  customer_email: 'jane@example.com',
  stl_filename: 'bracket.stl',
  filament_id: 'pla',
  strength_preset: 'standard',
  weight_g: '42.5',
  print_time_hours: '1.25',
  price_cents: '1850',
};

const COMPLETED_EVENT = {
  type: 'checkout.session.completed',
  data: { object: { metadata: MOCK_METADATA } },
};

let mockConstructEvent;

beforeEach(() => {
  jest.clearAllMocks();

  mockConstructEvent = jest.fn().mockReturnValue(COMPLETED_EVENT);
  Stripe.mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  }));

  moveFile.mockResolvedValue(undefined);
  sendOwnerNotification.mockResolvedValue(undefined);
  sendCustomerConfirmation.mockResolvedValue(undefined);

  process.env.STRIPE_SECRET_KEY = 'sk_test_key';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.GOOGLE_DRIVE_FOLDER_ID = 'perm-folder-id';
});

describe('method guard', () => {
  it('returns 405 for GET requests', async () => {
    const res = mockRes();
    await handler(makeReq('{}', 'GET'), res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

describe('signature verification', () => {
  it('returns 400 when constructEvent throws', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found');
    });

    const res = mockRes();
    await handler(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('No signatures found') })
    );
  });

  it('passes the raw body buffer and stripe-signature header to constructEvent', async () => {
    const rawBody = '{"id":"evt_test"}';
    const res = mockRes();
    await handler(makeReq(rawBody), res);

    const [passedBody, passedSig, passedSecret] = mockConstructEvent.mock.calls[0];
    expect(Buffer.isBuffer(passedBody)).toBe(true);
    expect(passedBody.toString()).toBe(rawBody);
    expect(passedSig).toBe('test-sig');
    expect(passedSecret).toBe('whsec_test');
  });
});

describe('non-completed events', () => {
  it('returns 200 without side effects for other event types', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.created',
      data: { object: {} },
    });

    const res = mockRes();
    await handler(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(moveFile).not.toHaveBeenCalled();
    expect(sendOwnerNotification).not.toHaveBeenCalled();
    expect(sendCustomerConfirmation).not.toHaveBeenCalled();
  });
});

describe('checkout.session.completed — happy path', () => {
  it('moves the file to the permanent Drive folder', async () => {
    const res = mockRes();
    await handler(makeReq(), res);

    expect(moveFile).toHaveBeenCalledWith('drive-file-123', 'perm-folder-id');
  });

  it('sends owner notification with correct order fields', async () => {
    const res = mockRes();
    await handler(makeReq(), res);

    expect(sendOwnerNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_name: 'Jane Doe',
        customer_email: 'jane@example.com',
        stl_filename: 'bracket.stl',
        filament_id: 'pla',
        strength_preset: 'standard',
        weight_g: 42.5,
        print_time_hours: 1.25,
        price_cents: 1850,
        drive_link: 'https://drive.google.com/file/d/drive-file-123',
      })
    );
  });

  it('sends customer confirmation to the customer email', async () => {
    const res = mockRes();
    await handler(makeReq(), res);

    expect(sendCustomerConfirmation).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ price_cents: 1850 })
    );
  });

  it('returns 200 with received: true', async () => {
    const res = mockRes();
    await handler(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});

describe('error handling', () => {
  it('returns 500 when Drive move fails so Stripe retries', async () => {
    moveFile.mockRejectedValue(new Error('Drive error'));

    const res = mockRes();
    await handler(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Drive move failed' });
    expect(sendOwnerNotification).not.toHaveBeenCalled();
    expect(sendCustomerConfirmation).not.toHaveBeenCalled();
  });

  it('returns 200 even when owner notification fails', async () => {
    sendOwnerNotification.mockRejectedValue(new Error('SMTP timeout'));

    const res = mockRes();
    await handler(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('returns 200 even when customer confirmation fails', async () => {
    sendCustomerConfirmation.mockRejectedValue(new Error('Invalid address'));

    const res = mockRes();
    await handler(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});

describe('config export', () => {
  it('disables Vercel body parser so raw body is available for Stripe signature verification', () => {
    expect(handler.config).toEqual({ api: { bodyParser: false } });
  });
});
