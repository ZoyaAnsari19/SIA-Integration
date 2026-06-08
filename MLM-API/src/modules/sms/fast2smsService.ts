/**
 * Fast2SMS Service
 * Handles SMS sending via Fast2SMS API
 */

interface Fast2SMSSendResponse {
  return: boolean;
  request_id: string;
  message: string[];
}

interface Fast2SMSWalletResponse {
  status: boolean;
  wallet: number;
  sms: number;
}

export class Fast2SMSService {
  private static readonly API_BASE_URL = 'https://www.fast2sms.com/dev';
  private static readonly API_KEY = process.env.FAST2SMS_API_KEY;
  private static readonly SENDER_ID = process.env.FAST2SMS_SENDER_ID || 'SIAPVT';
  
  // Fast2SMS DLT Template IDs (from Dev API dashboard). Placeholder = not configured (use native OTP route / skip).
  private static readonly GENERIC_OTP_TEMPLATE_ID = (() => {
    const v = (process.env.FAST2SMS_GENERIC_OTP_TEMPLATE_ID || '').trim();
    if (!v || v === 'your_generic_otp_template_id_here') return '';
    return v;
  })();
  // Name Change OTP (DLT). If not set, we still fall back gracefully to SMS.
  private static readonly NAME_CHANGE_OTP_TEMPLATE_ID = (process.env.FAST2SMS_NAME_CHANGE_OTP_TEMPLATE_ID || '').trim();
  // Login credentials (DLT)
  private static readonly LOGIN_TEMPLATE_ID = (process.env.FAST2SMS_LOGIN_TEMPLATE_ID || '206002').trim();
  // P2P transfer OTP (DLT)
  private static readonly P2P_OTP_TEMPLATE_ID = (process.env.FAST2SMS_P2P_OTP_TEMPLATE_ID || '').trim();
  // Transaction PIN / Transaction Password OTP (DLT)
  private static readonly TRANSACTION_PIN_OTP_TEMPLATE_ID = (process.env.FAST2SMS_TRANSACTION_PIN_OTP_TEMPLATE_ID || '').trim();
  // Withdrawal debit alert (DLT) - wallet to bank
  private static readonly WITHDRAW_DEBIT_TEMPLATE_ID = (process.env.FAST2SMS_WITHDRAW_DEBIT_TEMPLATE_ID || '').trim();

  /**
   * Check if Fast2SMS is configured
   */
  static isConfigured(): boolean {
    return !!this.API_KEY;
  }

  /**
   * Send SMS via Fast2SMS
   * @param mobile - 10-digit mobile number
   * @param message - SMS message content
   * @returns Promise with success status and request ID
   */
  static async sendSMS(mobile: string, message: string): Promise<{ success: boolean; requestId?: string; error?: string }> {
    if (!this.isConfigured()) {
      console.warn('Fast2SMS API key not configured');
      return { success: false, error: 'SMS service not configured' };
    }

    // Validate mobile number (10 digits)
    if (!/^[0-9]{10}$/.test(mobile)) {
      return { success: false, error: 'Invalid mobile number format' };
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/bulkV2`, {
        method: 'POST',
        headers: {
          'authorization': this.API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          language: 'english',
          route: 'q', // Route 'q' for transactional messages
          numbers: mobile,
        }),
      });

      const data: Fast2SMSSendResponse = await response.json();

      if (data.return && data.request_id) {
        console.log(`Fast2SMS: SMS sent successfully to ${mobile}, Request ID: ${data.request_id}`);
        return { success: true, requestId: data.request_id };
      } else {
        const errorMsg = data.message?.[0] || 'Failed to send SMS';
        console.error(`Fast2SMS: Failed to send SMS to ${mobile}:`, errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (error: any) {
      console.error('Fast2SMS API error:', error);
      return { success: false, error: error.message || 'Failed to send SMS' };
    }
  }

  /**
   * Send OTP using Fast2SMS native OTP route (route=otp).
   * Uses built-in "Your OTP: {otp}" format - no DLT template needed. Works in stage/prod when GENERIC_OTP_TEMPLATE_ID is not set.
   */
  private static async sendOTPViaNativeRoute(mobile: string, otp: string): Promise<{ success: boolean; requestId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'SMS service not configured' };
    }
    if (!/^[0-9]{10}$/.test(mobile) || !/^[0-9]{6}$/.test(otp)) {
      return { success: false, error: 'Invalid mobile or OTP format' };
    }
    try {
      const response = await fetch(`${this.API_BASE_URL}/bulkV2`, {
        method: 'POST',
        headers: {
          'authorization': this.API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: otp,
          numbers: mobile,
          flash: '0',
        }),
      });
      const data: Fast2SMSSendResponse = await response.json();
      if (data.return && data.request_id) {
        console.log(`Fast2SMS: OTP sent via native route to ${mobile}, Request ID: ${data.request_id}`);
        return { success: true, requestId: data.request_id };
      }
      const errorMsg = data.message?.[0] || 'Failed to send OTP';
      console.error(`Fast2SMS: Native OTP route failed for ${mobile}:`, errorMsg);
      return { success: false, error: errorMsg };
    } catch (error: any) {
      console.error('Fast2SMS native OTP API error:', error);
      return { success: false, error: error.message || 'Failed to send OTP' };
    }
  }

  /**
   * Send SMS using Fast2SMS DLT Template
   * @param mobile - 10-digit mobile number
   * @param templateId - Fast2SMS Template ID (e.g., "206001")
   * @param variables - Array of variable values (for {#var#} placeholders)
   * @param senderId - Sender ID (optional, defaults to SIAPVT)
   * @returns Promise with success status and request ID
   */
  static async sendWithDLTTemplate(
    mobile: string,
    templateId: string,
    variables: string[],
    senderId: string = this.SENDER_ID
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    if (!this.isConfigured()) {
      console.warn('Fast2SMS API key not configured');
      return { success: false, error: 'SMS service not configured' };
    }

    // Validate mobile number (10 digits)
    if (!/^[0-9]{10}$/.test(mobile)) {
      return { success: false, error: 'Invalid mobile number format' };
    }

    // Fast2SMS DLT: use POST with JSON body so variables_values is reliably sent.
    // Template must use {#var#} placeholder (e.g. "Hello {#var#}, to complete your signup...") — not a fixed number like 294851.
    const variablesStr = variables.join('|');
    try {
      console.log(`[Fast2SMS DLT] Sending SMS: Template ID=${templateId}, variables_values="${variablesStr}", Mobile=${mobile}`);

      const response = await fetch(`${this.API_BASE_URL}/bulkV2`, {
        method: 'POST',
        headers: {
          'authorization': this.API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'dlt',
          sender_id: senderId,
          message: parseInt(String(templateId), 10) || templateId, // Template ID as number per Fast2SMS API
          variables_values: variablesStr, // Required: values for {#var#} in template, pipe-separated
          numbers: mobile,
          flash: '0',
        }),
      });

      const data: Fast2SMSSendResponse = await response.json();

      if (data.return && data.request_id) {
        console.log(`Fast2SMS: DLT Template SMS sent successfully to ${mobile}, Request ID: ${data.request_id}`);
        return { success: true, requestId: data.request_id };
      } else {
        const errorMsg = data.message?.[0] || 'Failed to send template SMS';
        console.error(`Fast2SMS: Failed to send DLT template SMS to ${mobile}:`, errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (error: any) {
      console.error('Fast2SMS DLT Template API error:', error);
      return { success: false, error: error.message || 'Failed to send SMS' };
    }
  }

  /**
   * Send OTP SMS for signup / registration / forgot-password (new join page).
   *
   * Signup/new join OTP ke liye Quick SMS ki jagah DLT use karna hai:
   * - DLT template: `FAST2SMS_NAME_CHANGE_OTP_TEMPLATE_ID` (default: 206001)
   * - Variables: OTP (single value -> `{#var#}` placeholder ke liye)
   */
  static async sendOTP(
    mobile: string,
    otp: string
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    if (!this.isConfigured()) {
      console.warn('Fast2SMS API key not configured');
      return { success: false, error: 'SMS service not configured' };
    }

    if (!/^[0-9]{10}$/.test(mobile)) {
      return { success: false, error: 'Invalid mobile number format' };
    }
    if (!/^[0-9]{6}$/.test(otp)) {
      return { success: false, error: 'Invalid OTP format' };
    }

    // 1) Send via DLT template (repurpose 206001 for signup OTP)
    if (this.NAME_CHANGE_OTP_TEMPLATE_ID) {
      const templateResult = await this.sendWithDLTTemplate(
        mobile,
        this.NAME_CHANGE_OTP_TEMPLATE_ID,
        [otp]
      );
      if (templateResult.success) {
        console.log(
          `Fast2SMS: Signup OTP sent via DLT template (${this.NAME_CHANGE_OTP_TEMPLATE_ID}) to ${mobile}, Request ID: ${templateResult.requestId}`
        );
        return templateResult;
      }
      console.warn(
        `Fast2SMS: Signup OTP DLT failed (${templateResult.error}), trying native OTP route`
      );
    } else {
      console.warn('Fast2SMS: NAME_CHANGE_OTP_TEMPLATE_ID not set for signup OTP');
    }

    // 2) Fallback (avoid Quick SMS cost): native OTP route
    return this.sendOTPViaNativeRoute(mobile, otp);
  }

  /**
   * Send withdrawal debit alert SMS via DLT template.
   *
   * Template format (example):
   *   Dear {#var#}, Rs {#var#} has been debited from {#var#} and will be credited to your Bank AC within 72 hrs...
   *
   * Variables:
   *   [ customerName, amountFormatted, sourceWallet ]
   */
  static async sendWithdrawDebitAlert(
    mobile: string,
    customerName: string,
    amount: number,
    sourceWalletLabel: string
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    if (!this.isConfigured()) {
      console.warn('Fast2SMS API key not configured');
      return { success: false, error: 'SMS service not configured' };
    }

    // Require DLT template ID
    if (!this.WITHDRAW_DEBIT_TEMPLATE_ID) {
      console.warn(
        'Fast2SMS: WITHDRAW_DEBIT_TEMPLATE_ID not set. Skipping withdrawal debit SMS.'
      );
      return { success: false, error: 'Withdraw debit template is not configured' };
    }

    // Validate mobile number (10 digits)
    if (!/^[0-9]{10}$/.test(mobile)) {
      return { success: false, error: 'Invalid mobile number format' };
    }

    const name = (customerName || 'Member').trim();
    const amountFormatted = amount.toFixed(2);
    const walletLabel = (sourceWalletLabel || 'wallet').trim();

    try {
      const templateResult = await this.sendWithDLTTemplate(
        mobile,
        this.WITHDRAW_DEBIT_TEMPLATE_ID,
        [name, amountFormatted, walletLabel]
      );
      if (templateResult.success) {
        console.log(
          `Fast2SMS: Withdrawal debit alert sent via DLT template to ${mobile}, Request ID: ${templateResult.requestId}`
        );
        return templateResult;
      }
      console.warn(
        'Fast2SMS withdrawal debit DLT template method failed:',
        templateResult.error
      );
      return {
        success: false,
        error: templateResult.error || 'Failed to send withdrawal debit SMS via DLT template',
      };
    } catch (error: any) {
      console.warn(
        'Fast2SMS withdrawal debit DLT template method error:',
        error?.message || error
      );
      return {
        success: false,
        error: error?.message || 'Failed to send withdrawal debit SMS via DLT template',
      };
    }
  }

  /**
   * Send Name Change OTP SMS using DLT Template
   * @param mobile - 10-digit mobile number
   * @param otp - 6-digit OTP code
   * @returns Promise with success status
   */
  static async sendNameChangeOTP(mobile: string, otp: string): Promise<{ success: boolean; requestId?: string; error?: string }> {
    if (!this.isConfigured()) {
      console.warn('Fast2SMS API key not configured');
      return { success: false, error: 'SMS service not configured' };
    }

    // Validate mobile number (10 digits)
    if (!/^[0-9]{10}$/.test(mobile)) {
      return { success: false, error: 'Invalid mobile number format' };
    }

    // Validate OTP (6 digits)
    if (!/^[0-9]{6}$/.test(otp)) {
      return { success: false, error: 'Invalid OTP format' };
    }

    // Try DLT Template first (if configured)
    if (this.NAME_CHANGE_OTP_TEMPLATE_ID && this.NAME_CHANGE_OTP_TEMPLATE_ID.trim() !== '') {
      try {
        const templateResult = await this.sendWithDLTTemplate(mobile, this.NAME_CHANGE_OTP_TEMPLATE_ID, [otp]);
        if (templateResult.success) {
          console.log(`Fast2SMS: Name Change OTP sent successfully via DLT template to ${mobile}, Request ID: ${templateResult.requestId}`);
          return templateResult;
        } else {
          console.warn('Fast2SMS Name Change DLT template method failed, falling back to quick SMS:', templateResult.error);
        }
      } catch (error: any) {
        console.warn('Fast2SMS Name Change DLT template method error, falling back to quick SMS:', error?.message || error);
      }
    } else {
      console.warn('Fast2SMS: Name Change OTP Template ID not configured, using quick SMS fallback');
    }

    // Fallback to Quick SMS (custom message) if DLT template is not configured or fails
    const message = `Hello ${otp}, to change your account name please verify using OTP. Do not share this OTP with anyone. Valid for 10 minutes.`;
    console.log(`Fast2SMS: Sending Name Change OTP via quick SMS (custom message) to ${mobile}`);
    return this.sendSMS(mobile, message);
  }

  /**
   * Send P2P Transfer OTP SMS using DLT Template
   * Uses dedicated P2P-OTP template when configured.
   * IMPORTANT: When P2P template ID is configured we DO NOT fall back to Quick SMS
   * to avoid ₹5 charges – we want only DLT route here.
   * If no dedicated template is configured, we fall back to the generic native OTP
   * route (and then, as last resort, Quick SMS).
   * @param mobile - 10-digit mobile number
   * @param otp - 6-digit OTP code
   */
  static async sendP2PTransferOTP(
    mobile: string,
    otp: string
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    if (!this.isConfigured()) {
      console.warn('Fast2SMS API key not configured');
      return { success: false, error: 'SMS service not configured' };
    }

    // Validate mobile number (10 digits)
    if (!/^[0-9]{10}$/.test(mobile)) {
      return { success: false, error: 'Invalid mobile number format' };
    }

    // Validate OTP (6 digits)
    if (!/^[0-9]{6}$/.test(otp)) {
      return { success: false, error: 'Invalid OTP format' };
    }

    // 1) Try dedicated P2P DLT template first (if configured)
    let dltError: string | undefined;
    if (this.P2P_OTP_TEMPLATE_ID) {
      try {
        const templateResult = await this.sendWithDLTTemplate(mobile, this.P2P_OTP_TEMPLATE_ID, [otp]);
        if (templateResult.success) {
          console.log(
            `Fast2SMS: P2P Transfer OTP sent successfully via DLT template to ${mobile}, Request ID: ${templateResult.requestId}`
          );
          return templateResult;
        }
        dltError = templateResult.error || 'DLT template failed';
        console.warn('Fast2SMS P2P DLT template method failed:', dltError);
      } catch (error: any) {
        dltError = error?.message || 'DLT template error';
        console.warn('Fast2SMS P2P DLT template method error:', dltError);
      }
      // When DLT is configured but failed: try native OTP route (avoids Quick SMS ₹5)
      if (dltError) {
        try {
          const nativeResult = await this.sendOTPViaNativeRoute(mobile, otp);
          if (nativeResult.success) {
            console.log(
              `Fast2SMS: P2P OTP sent via native route (DLT failed: ${dltError}) to ${mobile}, Request ID: ${nativeResult.requestId}`
            );
            return nativeResult;
          }
        } catch (e) {
          /* ignore */
        }
        // Both DLT and native failed – return DLT error (no Quick SMS)
        return { success: false, error: dltError };
      }
    } else {
      console.log('Fast2SMS: P2P Transfer OTP Template ID not set, using native OTP/Quick SMS route');
    }

    // 2) Native OTP route (works without dedicated P2P DLT template)
    try {
      const nativeResult = await this.sendOTPViaNativeRoute(mobile, otp);
      if (nativeResult.success) {
        console.log(
          `Fast2SMS: P2P Transfer OTP sent successfully via native OTP route to ${mobile}, Request ID: ${nativeResult.requestId}`
        );
        return nativeResult;
      }
      console.warn('Fast2SMS P2P native OTP route failed, falling back to quick SMS:', nativeResult.error);
    } catch (error: any) {
      console.warn(
        'Fast2SMS P2P native OTP route error, falling back to quick SMS:',
        error?.message || error
      );
    }

    // 3) Last resort (no DLT template configured): Quick SMS (custom message)
    const message =
      'Hello, to complete your P2P transfer request please verify using this OTP. Do not share this OTP with anyone. Valid for 10 minutes.';
    console.log(`Fast2SMS: Sending P2P Transfer OTP via quick SMS (custom message) to ${mobile}`);
    return this.sendSMS(mobile, message.replace('this OTP', otp));
  }

  /**
   * Send Transaction PIN (Transaction Password) OTP — Reset Transaction PIN flow.
   * 1) Quick SMS (custom message with OTP). 2) If that fails, native OTP route.
   */
  static async sendTransactionPinOTP(
    mobile: string,
    otp: string
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    if (!this.isConfigured()) {
      console.warn('Fast2SMS API key not configured');
      return { success: false, error: 'SMS service not configured' };
    }

    if (!/^[0-9]{10}$/.test(mobile)) {
      return { success: false, error: 'Invalid mobile number format' };
    }
    if (!/^[0-9]{6}$/.test(otp)) {
      return { success: false, error: 'Invalid OTP format' };
    }

    // 1) Quick SMS first
    const message = `Your OTP to reset Transaction PIN is ${otp}. Do not share with anyone. Valid for 10 minutes. Regards, Secure Infinite Association Pvt Ltd.`;
    console.log(`Fast2SMS: Sending Transaction PIN OTP via Quick SMS to ${mobile}`);
    const quickResult = await this.sendSMS(mobile, message);
    if (quickResult.success) return quickResult;

    // 2) Fallback: native OTP route
    console.warn(`Fast2SMS: Quick SMS failed (${quickResult.error}), trying native OTP route for Transaction PIN`);
    return this.sendOTPViaNativeRoute(mobile, otp);
  }

  /**
   * Send Login Credentials SMS using DLT Template
   * @param mobile - 10-digit mobile number
   * @param userName - User's name
   * @param loginId - User's login ID
   * @param password - User's password
   * @returns Promise with success status
   */
  static async sendLoginCredentials(
    mobile: string,
    userName: string,
    loginId: string,
    password: string
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    if (!this.isConfigured()) {
      console.warn('Fast2SMS API key not configured');
      return { success: false, error: 'SMS service not configured' };
    }

    // Validate mobile number (10 digits)
    if (!/^[0-9]{10}$/.test(mobile)) {
      return { success: false, error: 'Invalid mobile number format' };
    }

    // Use DLT Template for login credentials
    // Template format: "Hello {#var#}, your login credentials are as follows. ID: {#var#}. PASS: {#var#}..."
    // Variables: [userName, loginId, password]
    return this.sendWithDLTTemplate(mobile, this.LOGIN_TEMPLATE_ID, [userName, loginId, password]);
  }

  /**
   * Get Fast2SMS wallet balance and remaining SMS count
   * @returns Promise with wallet balance and SMS count
   */
  static async getWalletBalance(): Promise<{ wallet: number; sms: number } | null> {
    if (!this.isConfigured()) {
      console.warn('[Fast2SMS] API key not configured');
      return null;
    }

    try {
      // Official Fast2SMS docs + your curl test both use the API key
      // as a query parameter: /dev/wallet?authorization=API_KEY
      const url = `${this.API_BASE_URL}/wallet?authorization=${encodeURIComponent(this.API_KEY!)}`;
      console.log(`[Fast2SMS] Fetching wallet balance from: ${url}`);

      // Header generally not required for this endpoint, but harmless if present
      const response = await fetch(url, { method: 'GET' });

      console.log(`[Fast2SMS] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Fast2SMS] API error (${response.status}):`, errorText);
        return null;
      }

      const rawData = await response.json();
      console.log('[Fast2SMS] Raw API response:', JSON.stringify(rawData, null, 2));

      // Handle different possible response formats
      // Format 1 (current from your curl):
      //   { return: true, wallet: "436.5000", sms_count: 1746 }
      // Format 2: { status: true, wallet: 100, sms: 500 }
      // Format 3: { success: true, wallet: 100, sms: 500 }
      
      if (rawData.status || rawData.return || rawData.success) {
        const wallet = Number(rawData.wallet || rawData.balance || 0);
        const sms = Number(rawData.sms || rawData.sms_count || 0);
        
        console.log(`[Fast2SMS] Parsed - Wallet: ${wallet}, SMS: ${sms}`);
        
        return {
          wallet: wallet,
          sms: sms,
        };
      } else {
        console.error('[Fast2SMS] Invalid response format:', rawData);
        return null;
      }
    } catch (error: any) {
      console.error('[Fast2SMS] Wallet API error:', error?.message || error);
      console.error('[Fast2SMS] Error stack:', error?.stack);
      return null;
    }
  }
}

