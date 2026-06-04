jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const nodemailer = require('nodemailer');
const { sendOwnerNotification, sendCustomerConfirmation, sendOwnerManualQuoteAlert } = require('../../../api/lib/email');

const mockSendMail = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  nodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail });

  process.env.GMAIL_USER = 'test@saguarolabs3d.com';
  process.env.GMAIL_APP_PASSWORD = 'app-password';
  process.env.OWNER_EMAIL = 'owner@saguarolabs3d.com';
});

const baseOrder = {
  customer_name: 'Jane Doe',
  customer_email: 'jane@example.com',
  stl_filename: 'bracket.stl',
  filament_id: 'pla',
  strength_preset: 'standard',
  weight_g: 42.5,
  print_time_hours: 1.25,
  price_cents: 1850,
  drive_link: 'https://drive.google.com/file/d/abc123',
};

describe('sendOwnerNotification', () => {
  it('sends mail to OWNER_EMAIL with correct subject', async () => {
    mockSendMail.mockResolvedValue({});

    await sendOwnerNotification(baseOrder);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('owner@saguarolabs3d.com');
    expect(call.subject).toContain('bracket.stl');
    expect(call.html).toContain('Jane Doe');
    expect(call.html).toContain('$18.50');
  });

  it('creates a fresh transport on each call', async () => {
    mockSendMail.mockResolvedValue({});

    await sendOwnerNotification(baseOrder);
    await sendOwnerNotification(baseOrder);

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
  });

  it('propagates sendMail errors', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP auth failed'));

    await expect(sendOwnerNotification(baseOrder)).rejects.toThrow('SMTP auth failed');
  });
});

describe('sendCustomerConfirmation', () => {
  it('sends mail to the customer email with correct subject', async () => {
    mockSendMail.mockResolvedValue({});

    await sendCustomerConfirmation('jane@example.com', baseOrder);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('jane@example.com');
    expect(call.subject).toContain('confirmed');
    expect(call.html).toContain('Jane');
    expect(call.html).toContain('$18.50');
  });

  it('propagates sendMail errors', async () => {
    mockSendMail.mockRejectedValue(new Error('Connection refused'));

    await expect(sendCustomerConfirmation('jane@example.com', baseOrder))
      .rejects.toThrow('Connection refused');
  });
});

describe('sendOwnerManualQuoteAlert', () => {
  const customerInfo = {
    name: 'Bob Smith',
    email: 'bob@example.com',
    notes: 'Need it in red',
    filename: 'widget.stl',
  };

  it('sends mail to OWNER_EMAIL with customer info', async () => {
    mockSendMail.mockResolvedValue({});

    await sendOwnerManualQuoteAlert(customerInfo, 'https://drive.google.com/file/d/xyz');

    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('owner@saguarolabs3d.com');
    expect(call.subject).toContain('widget.stl');
    expect(call.html).toContain('Bob Smith');
    expect(call.html).toContain('bob@example.com');
    expect(call.html).toContain('Need it in red');
    expect(call.html).toContain('https://drive.google.com/file/d/xyz');
  });

  it('omits drive link section when driveLink is falsy', async () => {
    mockSendMail.mockResolvedValue({});

    await sendOwnerManualQuoteAlert(customerInfo, null);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).not.toContain('STL File (Google Drive)');
  });

  it('omits notes row when notes is absent', async () => {
    mockSendMail.mockResolvedValue({});

    await sendOwnerManualQuoteAlert({ name: 'Alice', email: 'alice@example.com', filename: 'part.stl' }, null);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).not.toContain('Notes');
  });

  it('uses unknown file label when filename is absent', async () => {
    mockSendMail.mockResolvedValue({});

    await sendOwnerManualQuoteAlert({ name: 'Alice', email: 'alice@example.com' }, null);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('unknown file');
  });

  it('propagates sendMail errors', async () => {
    mockSendMail.mockRejectedValue(new Error('Rate limit'));

    await expect(sendOwnerManualQuoteAlert(customerInfo, null)).rejects.toThrow('Rate limit');
  });
});
