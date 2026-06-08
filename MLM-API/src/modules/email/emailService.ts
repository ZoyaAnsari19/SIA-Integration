import nodemailer from 'nodemailer';

function getSmtpConfig() {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const from = (process.env.SMTP_FROM || user || 'no-reply@secureinfiniteassociation.com').trim();

  return { user, pass, host, port, from };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export class EmailService {
  static isConfigured(): boolean {
    const { user, pass } = getSmtpConfig();
    return Boolean(user && pass);
  }

  static maskEmail(email: string): string {
    return maskEmail(email);
  }

  private static async sendOtpEmail(
    toEmail: string,
    otp: string,
    subject: string,
    heading: string,
    purposeLine: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { user, pass, host, port, from } = getSmtpConfig();

    if (!user || !pass) {
      console.error('[EmailService] SMTP_USER or SMTP_PASS not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const text =
      `${purposeLine}\n\nYour verification OTP is: ${otp}\n\n` +
      'This OTP is valid for 10 minutes. Do not share it with anyone.\n\n' +
      'Secure Infinite Association';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">${heading}</h2>
        <p>${purposeLine}</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #1a252f;">${otp}</p>
        <p style="color: #666;">Valid for <strong>10 minutes</strong>. Do not share this OTP with anyone.</p>
        <p style="color: #999; font-size: 12px;">Secure Infinite Association</p>
      </div>
    `;

    const fromHeader = from.includes('@') && from !== user
      ? `"Secure Infinite Association" <${user}>`
      : from;

    try {
      await transporter.sendMail({
        from: fromHeader,
        to: toEmail,
        replyTo: from !== user ? from : undefined,
        subject,
        text,
        html,
      });
      console.log(`[EmailService] OTP email sent (${subject}) to ${maskEmail(toEmail)}`);
      return { success: true };
    } catch (error: any) {
      console.error('[EmailService] Failed to send OTP email:', error?.message || error);
      return { success: false, error: error?.message || 'Failed to send email' };
    }
  }

  static async sendP2PTransferOTP(toEmail: string, otp: string): Promise<{ success: boolean; error?: string }> {
    return this.sendOtpEmail(
      toEmail,
      otp,
      'P2P Transfer OTP - Secure Infinite Association',
      'P2P Transfer Verification',
      'Your one-time password (OTP) for P2P transfer is shown below.',
    );
  }

  static async sendRegistrationOTP(toEmail: string, otp: string): Promise<{ success: boolean; error?: string }> {
    return this.sendOtpEmail(
      toEmail,
      otp,
      'Registration OTP - Secure Infinite Association',
      'Account Registration',
      'Use this OTP to verify your email and complete registration.',
    );
  }

  static async sendForgotPasswordOTP(toEmail: string, otp: string): Promise<{ success: boolean; error?: string }> {
    return this.sendOtpEmail(
      toEmail,
      otp,
      'Password Reset OTP - Secure Infinite Association',
      'Password Reset',
      'Use this OTP to verify your identity and reset your password.',
    );
  }

  static async sendPasswordChangeOTP(toEmail: string, otp: string): Promise<{ success: boolean; error?: string }> {
    return this.sendOtpEmail(
      toEmail,
      otp,
      'Password Change OTP - Secure Infinite Association',
      'Change Login Password',
      'Use this OTP to confirm your login password change.',
    );
  }
}
