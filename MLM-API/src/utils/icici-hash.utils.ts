import crypto from 'crypto';

/**
 * Generate secure hash for ICICI payment gateway
 * Original implementation: HMAC-SHA256 with secret key
 * secureHash = HMAC_SHA256(HashText, SecretKey)
 */

/**
 * Generate secure hash for SALE transaction
 *
 * ICICI doc HashText order (aggregator mode):
 *   addlParam1 + addlParam2 + aggregatorID + amount + currencyCode +
 *   customerEmailID + customerMobileNo + customerName + merchantId +
 *   merchantTxnNo + payType + returnURL + transactionType + txnDate
 *
 * Note:
 * - Some modes don't require aggregatorID. In that case it should be treated as empty string.
 * - To keep both modes compatible, we ALWAYS insert aggregatorID in that position;
 *   when it is not required/empty it simply contributes "" and the HashText is identical
 *   to the previous direct‑MID implementation.
 */
export function generateSecureHash(data: any, secretKey: string): string {
  let hashString = '';

  // For SALE (Initiate Sale) request
  // HashText order: addlParam1 + addlParam2 + aggregatorID + amount + currencyCode +
  //                 customerEmailID + customerMobileNo + customerName + merchantId +
  //                 merchantTxnNo + payType + returnURL + transactionType + txnDate
  if (data.transactionType === 'SALE') {
    // Ensure all values are strings, no undefined/null values
    const aggregatorId = String((data.aggregatorID || data.aggregatorId || '') ?? '');

    hashString = 
      String(data.addlParam1 || '') +
      String(data.addlParam2 || '') +
      aggregatorId +
      String(data.amount || '') +
      String(data.currencyCode || '') +
      String(data.customerEmailID || '') +
      String(data.customerMobileNo || '') +
      String(data.customerName || '') +
      String(data.merchantId || '') +
      String(data.merchantTxnNo || '') +
      String(data.payType || '') +
      String(data.returnURL || '') +
      String(data.transactionType || '') +
      String(data.txnDate || '');
  }
  // For STATUS request - Direct MID Mode
  else if (data.transactionType === 'STATUS') {
    // Hash order: merchantId + merchantTxnNo + transactionType + originalTxnNo
    // Note: STATUS doesn't include amount in hash
    hashString = 
      String(data.merchantId || '') +
      String(data.merchantTxnNo || '') +
      String(data.transactionType || '') +
      String(data.originalTxnNo || '');
  }
  // For REFUND request - Direct MID Mode
  else if (data.transactionType === 'REFUND') {
    // Hash order: merchantId + merchantTxnNo + transactionType + originalTxnNo + amount
    hashString = 
      String(data.merchantId || '') +
      String(data.merchantTxnNo || '') +
      String(data.transactionType || '') +
      String(data.originalTxnNo || '') +
      String(data.amount || '');
  }
  else {
    throw new Error(`Unsupported transaction type: ${data.transactionType}`);
  }

  // Generate HMAC-SHA256 hash
  // Key: SecretKey (UTF-8), Message: HashText (ASCII)
  const secureHash = crypto
    .createHmac('sha256', Buffer.from(secretKey, 'utf8'))
    .update(hashString, 'ascii')
    .digest('hex');

  // Store hashString for debugging (if needed)
  if (data.transactionType === 'SALE') {
    (data as any)._hashString = hashString; // Store for logging
  }

  return secureHash;
}

/**
 * Verify secure hash from payment gateway response
 * Response hash order: addlParam1 + addlParam2 + amount + customerEmailID + customerMobileNo +
 *                      merchantId + merchantTxnNo + paymentDateTime + paymentID + paymentMode +
 *                      paymentSubInstType + respdescription + responseCode + txnID
 */
export function verifySecureHash(
  responseData: any,
  secretKey: string,
  receivedHash: string
): boolean {
  try {
    // Build hash string in exact order as per ICICI specification
    const hashString = 
      (responseData.addlParam1 || '') +
      (responseData.addlParam2 || '') +
      (responseData.amount || '') +
      (responseData.customerEmailID || '') +
      (responseData.customerMobileNo || '') +
      (responseData.merchantId || '') +
      (responseData.merchantTxnNo || '') +
      (responseData.paymentDateTime || '') +
      (responseData.paymentID || '') +
      (responseData.paymentMode || '') +
      (responseData.paymentSubInstType || '') +
      (responseData.respdescription || '') +
      (responseData.responseCode || '') +
      (responseData.txnID || '');

    // Debug logging
    console.log('=== HASH VERIFICATION DEBUG ===');
    console.log('Hash String:', hashString);
    console.log('Hash String Length:', hashString.length);
    console.log('Received Hash:', receivedHash);
    console.log('Response Data Fields:', {
      addlParam1: responseData.addlParam1,
      addlParam2: responseData.addlParam2,
      amount: responseData.amount,
      customerEmailID: responseData.customerEmailID,
      customerMobileNo: responseData.customerMobileNo,
      merchantId: responseData.merchantId,
      merchantTxnNo: responseData.merchantTxnNo,
      paymentDateTime: responseData.paymentDateTime,
      paymentID: responseData.paymentID,
      paymentMode: responseData.paymentMode,
      paymentSubInstType: responseData.paymentSubInstType,
      respdescription: responseData.respdescription,
      responseCode: responseData.responseCode,
      txnID: responseData.txnID
    });

    // Generate hash using same method: HMAC-SHA256(HashText, SecretKey)
    const calculatedHash = crypto
      .createHmac('sha256', Buffer.from(secretKey, 'utf8'))
      .update(hashString, 'ascii')
      .digest('hex');

    console.log('Calculated Hash:', calculatedHash);
    console.log('Hash Match:', calculatedHash.toLowerCase() === (receivedHash || '').toLowerCase());
    console.log('================================');

    // Compare hashes (case-insensitive)
    return calculatedHash.toLowerCase() === (receivedHash || '').toLowerCase();
  } catch (error) {
    console.error('Hash verification error:', error);
    return false;
  }
}
