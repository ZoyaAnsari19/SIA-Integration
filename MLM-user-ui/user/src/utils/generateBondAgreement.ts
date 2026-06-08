interface BondAgreementData {
  userName: string;
  userDisplayId: string;
  userAddress: string;
  date: string;
  paymentMode: string;
  transactionNo: string;
  amount: number;
  amountInWords: string;
  receiptNumber: string;
}

async function imageToBase64(url: string): Promise<string> {
  try {
    if (typeof window !== 'undefined') {
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    }
    return url; // Fallback to original URL
  } catch (err) {
    console.warn('Error converting image to base64:', err);
    return url; // Fallback to original URL
  }
}

export async function generateBondAgreementHTML(data: BondAgreementData): Promise<string> {
  // Convert golden logo to base64
  let logoBase64 = '/logo-golden.png';
  try {
    logoBase64 = await imageToBase64('/logo-golden.png');
  } catch (err) {
    console.warn('Could not load golden logo, trying fallback');
    try {
      logoBase64 = await imageToBase64('/SIA-png-logo.png');
    } catch (err2) {
      console.warn('Could not load fallback logo, using URL');
    }
  }

  // Convert bond agreement frame to base64
  let frameBase64 = '/bond-frame.png';
  try {
    frameBase64 = await imageToBase64('/bond-frame.png');
  } catch (err) {
    console.warn('Could not load bond frame, trying fallback');
    try {
      frameBase64 = await imageToBase64('/certificate-frame.png');
    } catch (err2) {
      console.warn('Could not load fallback frame');
    }
  }

  // Convert seal images to base64
  let sealRedBase64 = '/stamp-ution.png';
  let sealRed2Base64 = '/seal-removebg-preview.png';
  let sealSiaBase64 = '/seal-removebg-preview.png';
  let stampImbosenBase64 = '/stamp-imbosen.png';
  
  try {
    sealRedBase64 = await imageToBase64('/stamp-ution.png');
  } catch (err) {
    console.warn('Could not load stamp, trying fallback');
    try {
      sealRedBase64 = await imageToBase64('/seal-removebg-preview.png');
    } catch (err2) {
      console.warn('Could not load fallback seal');
    }
  }
  
  try {
    sealRed2Base64 = await imageToBase64('/seal-removebg-preview.png');
  } catch (err) {
    console.warn('Could not load seal 2');
  }
  
  try {
    sealSiaBase64 = await imageToBase64('/seal-removebg-preview.png');
  } catch (err) {
    console.warn('Could not load SIA seal');
  }
  
  try {
    stampImbosenBase64 = await imageToBase64('/stamp-imbosen.png');
  } catch (err) {
    console.warn('Could not load imbosen stamp');
  }
  
  // Load signature image
  let signatureBase64 = '/secure-signature.png';
  try {
    signatureBase64 = await imageToBase64('/secure-signature.png');
  } catch (err) {
    console.warn('Could not load signature image');
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formattedDate = formatDate(data.date);
  const formattedAmount = `₹${formatCurrency(data.amount)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt-cum-Mutual Agreement - SIA</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-gold: #c5a059;
            --dark-blue: #1a1a2e;
            --text-color: #000000;
            --border-color: #e0d0b0;
        }

        body {
            background-color: #f4f4f4;
            font-family: 'Montserrat', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 0;
            margin: 0;
            width: 100%;
            height: 100%;
        }

        /* Certificate Container */
        .certificate-wrapper {
            background-image: url('${frameBase64}');
            background-size: 100% 100%;
            background-position: center;
            background-repeat: no-repeat;
            width: 100%;
            max-width: 800px;
            padding: 0;
            position: relative;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            min-height: 1123px;
        }

        .inner-border {
            padding: 40px 50px 30px 50px;
            position: relative;
            background: transparent;
            min-height: 1123px;
            box-sizing: border-box;
            overflow: hidden;
        }

        /* Header Decor */
        .header-logo {
            text-align: center;
            margin-bottom: 10px;
        }

        .logo-placeholder {
            width: 150px;
            height: 150px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
            overflow: visible;
        }

        .logo-placeholder img {
            width: auto;
            height: auto;
            max-width: 150px;
            max-height: 150px;
            object-fit: contain;
        }

        h1 {
            font-family: 'Playfair Display', serif;
            text-align: center;
            font-size: 26px;
            color: #000000;
            text-transform: uppercase;
            letter-spacing: 2px;
            border-bottom: 2px solid var(--primary-gold);
            display: inline-block;
            width: 100%;
            padding-bottom: 10px;
            margin-top: 0;
            font-weight: 700;
        }

        /* Content Section */
        .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin: 15px 0;
            line-height: 1.6;
        }

        .details-item b {
            color: #000000;
            font-weight: 700;
        }
        
        .details-item p {
            color: #000000;
        }
        
        .details-item {
            color: #000000;
        }

        .amount-section {
            background: #f9f6f0;
            padding: 15px;
            border-left: 4px solid var(--primary-gold);
            margin: 15px 0;
        }
        
        .amount-section p {
            color: #000000;
        }
        
        .amount-section b {
            color: #000000;
            font-weight: 700;
        }

        .agreement-text {
            text-align: justify;
            font-size: 14px;
            line-height: 1.8;
            color: #000000;
        }
        
        .agreement-text p {
            color: #000000;
        }

        .highlight-box {
            font-weight: 700;
            color: #000000;
        }

        /* Footer Stamps & Signature */
        .footer-section {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            position: relative;
            padding: 0 20px 0 30px;
            max-width: 100%;
        }

        .stamp-box {
            text-align: center;
            width: 70px;
            height: 70px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .stamp-box:last-child {
            margin-right: 0;
            width: 90px;
            height: 90px;
            margin-left: -10%;
        }

        .wax-seal {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .wax-seal img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .round-stamp {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .round-stamp img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }


        .signature-area {
            text-align: center;
            min-width: 200px;
        }

        .signature-img {
            font-family: 'Brush Script MT', cursive;
            font-size: 24px;
            color: #00008b;
            margin-bottom: 0;
            border-bottom: none;
        }
        
        .signature-img img {
            max-width: 200px;
            height: auto;
            object-fit: contain;
            border: none;
            display: block;
        }

        .director-title {
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 0;
        }

        .serial-no {
            position: absolute;
            top: 130px;
            right: 130px;
            color: #d32f2f;
            font-weight: bold;
            z-index: 11;
            font-size: 12px;
        }

        /* Disclaimer page (reuses certificate template) */
        .certificate-wrapper.disclaimer-page {
            page-break-before: always;
        }

        .disclaimer-heading {
            font-family: 'Playfair Display', serif;
            font-size: 18px;
            font-weight: 700;
            text-align: center;
            margin: 0 0 12px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #000000;
        }

        .disclaimer-section {
            margin-bottom: 8px;
            font-size: 12px;
            line-height: 1.5;
            color: #000000;
        }

        .disclaimer-section b {
            font-weight: 700;
            color: #000000;
        }

        .disclaimer-footer {
            margin-top: 16px;
            font-style: italic;
            font-size: 13px;
            color: #000000;
        }

        /* Slightly tighter padding for disclaimer pages to fit more content */
        .certificate-wrapper.disclaimer-page .inner-border {
            padding: 30px 40px 28px 40px;
        }

        /* Print styling */
        @media print {
            body { background: white; padding: 0; }
            .certificate-wrapper { box-shadow: none; border: 1px solid var(--primary-gold); }
        }
    </style>
</head>
<body>

<div class="certificate-wrapper">
    <div class="inner-border">
        
        <div class="header-logo">
            <div class="logo-placeholder">
                <img src="${logoBase64}" alt="Secure Infinite Association Logo" />
            </div>
        </div>

        <h1>Receipt-cum-Mutual Agreement</h1>

        <div class="details-grid">
            <div class="details-item">
                <p style="color: #000000;"><b style="color: #000000; font-weight: 700;">To:</b><br>
                <span style="color: #000000;">${data.userName}</span><br>
                <b style="color: #000000; font-weight: 700;">ID Number:</b> <span style="color: #000000;">${data.userDisplayId}</span><br>
                <b style="color: #000000; font-weight: 700;">Address:</b> <span style="color: #000000;">${data.userAddress || 'N/A'}</span></p>
            </div>
            <div class="details-item" style="text-align: right;">
                <p style="color: #000000;"><b style="color: #000000; font-weight: 700;">Date:</b> <span style="color: #000000;">${formattedDate}</span><br>
                <b style="color: #000000; font-weight: 700;">Payment Mode:</b> <span style="color: #000000;">${data.paymentMode}</span><br>
                <b style="color: #000000; font-weight: 700;">Transaction No.:</b> <span style="color: #000000;">${data.transactionNo || '-'}</span></p>
                <!-- Stamp below Transaction No -->
                <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
                    <div style="width: 80px; height: 80px;">
                        <img src="${stampImbosenBase64}" alt="Imbosen Stamp" style="width: 100%; height: 100%; object-fit: contain;" />
                    </div>
                </div>
            </div>
        </div>

        <div class="amount-section">
            <p style="color: #000000;">
              <b style="color: #000000; font-weight: 700;">
                Amount Received: ${formattedAmount} (Rupees ${data.amountInWords} Only)
              </b>
            </p>
            <p style="font-size: 14px; margin-bottom: 0; color: #000000;">
              This is to confirm that Secure Infinite Association has received the above amount
              towards Business Advance / Product Subscription from the above-named member.
            </p>
        </div>

        <div class="agreement-text">
            <p style="color: #000000;">
              As per mutual understanding, any affiliate commissions or rewards shall be processed
              strictly based on individual commitment, sales performance, and the Company&apos;s
              official compensation plan. The Company operates a strictly product / service-based
              model and does not guarantee any fixed returns, monthly ROI, or investment profits.
              The amount received is for business access / products and is strictly not a financial
              deposit or loan.
            </p>

            <p style="color: #000000;">
              This receipt‑agreement is strictly between the member and Secure Infinite Association
              only. Any involvement in fraud, misrepresentation, or violation of Company rules will
              result in immediate cancellation of this agreement, and in such cases, the amount
              shall not be refundable, and action may be taken as per rules and applicable law.
            </p>
        </div>

        <div class="footer-section">
            <div class="stamp-box">
                <div class="wax-seal">
                    <img src="${sealRedBase64}" alt="SIA Red Seal" />
                </div>
            </div>

            <div class="signature-area">
                <div class="signature-img">
                    <img src="${signatureBase64}" alt="Signature" />
                </div>
            </div>

            <div class="stamp-box">
                <div class="round-stamp">
                    <img src="${sealSiaBase64}" alt="SIA Seal" />
                </div>
            </div>
        </div>

    </div>
</div>

<div class="certificate-wrapper disclaimer-page">
  <div class="inner-border">
    <div class="header-logo">
      <div class="logo-placeholder">
        <img src="${logoBase64}" alt="Secure Infinite Association Logo" />
      </div>
    </div>

    <h2 class="disclaimer-heading">Legal Disclaimer &amp; Loan Acknowledgement</h2>

    <div class="disclaimer-section">
      <b>Nature of Funds:</b> The amount provided is an Unsecured Loan given on a mutual
      understanding basis for business expansion in sectors like Construction, Land Development,
      FMCG etc. It is NOT a Public Deposit under the BUDS Act 2019.
    </div>
    <div class="disclaimer-section">
      <b>Terms of Return (Interest):</b> The lender is entitled to an annual interest of 9% to 12%,
      subject to actual business performance and cash flow.
    </div>
    <div class="disclaimer-section">
      <b>No Equity / Partnership:</b> This contribution does not grant any ownership, partnership,
      or voting rights in the Proprietorship firm.
    </div>
    <div class="disclaimer-section">
      <b>Market Risk:</b> The lender acknowledges that business ventures involve inherent risks.
      All repayments are subject to the financial health and cash flow of the projects.
    </div>
    <div class="disclaimer-section">
      <b>Social Commitment:</b> By providing this loan, you support our "Make in India" vision and
      social welfare initiatives for national growth.
    </div>
    <div class="disclaimer-footer">
      “Empowering India through Innovation &amp; Integrity.”
    </div>
  </div>
</div>

<div class="certificate-wrapper disclaimer-page">
  <div class="inner-border">
    <div class="header-logo">
      <div class="logo-placeholder">
        <img src="${logoBase64}" alt="Secure Infinite Association Logo" />
      </div>
    </div>

    <h2 class="disclaimer-heading">User Terms of Service &amp; Affiliate Agreement</h2>

    <div class="disclaimer-section">
      This agreement is a legal contract between the User and Secure Infinite Association. By
      purchasing a course, joining the affiliate program, or entering into a business subscription
      agreement, the User agrees to the following terms:
    </div>

    <div class="disclaimer-section">
      <b>1. Non‑Refundable Course / Product Fee:</b> Once a User purchases a digital course or
      service, the payment is <b>100% non‑refundable</b>. Under no circumstances (including lack of
      interest or dissatisfaction) will the Company issue a refund. If a User wishes to earn money,
      they may voluntarily join the Affiliate Program. The course purchase does not guarantee
      income; earnings depend solely on the User’s affiliate marketing performance.
    </div>

    <div class="disclaimer-section">
      <b>2. Emergency &amp; Financial Assistance Disclaimer:</b> The Company is a business entity
      and not a welfare or insurance organization. The Company will not return funds or provide
      financial help in cases of personal emergencies, medical issues, or urgent financial needs of
      the User.
    </div>

    <div class="disclaimer-section">
      <b>3. Business Subscription &amp; Affiliate Payout Structure:</b> Any funds provided to the
      Company are strictly classified as a <b>Business Advance or Product Subscription</b>, not a
      loan. The Company has the absolute right to use these funds for business operations,
      expansion, or investments. The Company will never distribute affiliate commissions or rewards
      in a single lump sum; payouts will be distributed in <b>monthly installments on the 30th of
      every month</b>. In the 60‑month plan, the maximum total affiliate reward / commission is
      capped at <b>100% of the defined target</b> over 60 months; in the 30‑month plan, the cap is
      <b>50% of the defined target</b> over 30 months. Users cannot demand their subscription
      amount back before the completion of the chosen 60 or 30‑month tenure.
    </div>

    <div class="disclaimer-section">
      <b>4. No Fixed Returns or Guaranteed Profits:</b> Secure Infinite Association does not promise
      “Fixed Returns” or “Doubling Money.” Any payouts are based purely on the mutual affiliate
      agreement and the Company’s performance rules. The Company strictly prohibits and does not
      promote “get‑rich‑quick” schemes.
    </div>

    <div class="disclaimer-section">
      <b>5. Zero Liability for Agent Misconduct:</b> If a User joins based on a “Fake Promise” or an
      “Unofficial PDF” provided by an Agent, the Company shall not be held responsible. The User is
      responsible for reading these official terms. Verbal or written commitments made by Agents
      that contradict these terms are null and void.
    </div>

    <div class="disclaimer-section">
      <b>Additional Strict Legal Clauses for Company Protection:</b> Once a User joins or makes a
      payment, they are bound only by the Company’s official Terms and Conditions; previous
      conversations or external documents will not be entertained. If a User is found violating
      Company policies or engaging in suspicious activity, the Company reserves the right to
      freeze / hold their monthly payouts until an investigation is complete. Users cannot use
      pending payouts as collateral or an “advance against payout” within the system. All monthly
      payouts are subject to applicable bank charges, gateway fees, and a standard 10% Admin Fee.
      Multiple accounts created by the same User to exploit the system may result in the immediate
      permanent freezing of all funds. The Company reserves the right to change affiliate reward
      slabs or payout dates based on market conditions or government regulations. If a User posts
      negative reviews or defamatory content on social media regarding the payout schedule, the
      Company may terminate the agreement and take legal action. Clicking “I Agree” or making a
      payment acts as a digital signature confirming that the User has understood the “No Refund”
      and “Monthly Payout” clauses. The Company recognises only payments made through official bank
      channels; cash given to any third party in the name of the Company will not be recognised.
      All disputes arising from this affiliate agreement shall be settled through arbitration in the
      city where the Secure Infinite Association head office is located.
    </div>
  </div>
</div>

</body>
</html>`;

  return html;
}

/**
 * Download Bond Agreement HTML as file
 */
export function downloadBondAgreement(html: string, filename: string = 'bond-agreement.html') {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert HTML to PDF using html2canvas and jsPDF
 */
export async function convertBondHTMLToPDF(html: string, filename: string = 'bond-agreement.pdf'): Promise<void> {
  // Create a temporary container to render HTML
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '800px'; // Match bond agreement width
  container.style.background = '#f4f4f4';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    // Wait for images to load
    await new Promise((resolve) => {
      const images = container.querySelectorAll('img');
      let loadedCount = 0;
      const totalImages = images.length;

      if (totalImages === 0) {
        resolve(true);
        return;
      }

      images.forEach((img) => {
        if (img.complete) {
          loadedCount++;
          if (loadedCount === totalImages) resolve(true);
        } else {
          img.onload = () => {
            loadedCount++;
            if (loadedCount === totalImages) resolve(true);
          };
          img.onerror = () => {
            loadedCount++;
            if (loadedCount === totalImages) resolve(true);
          };
        }
      });
    });

    // Import html2canvas and jsPDF
    const html2canvasModule = await import('html2canvas');
    const jsPDFModule = await import('jspdf');
    const html2canvas = html2canvasModule.default;
    const jsPDF = jsPDFModule.default;

    // Convert HTML to canvas with better text rendering for PDF
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
      onclone: (clonedDoc) => {
        // Force all text to be black for better PDF visibility
        const style = clonedDoc.createElement('style');
        style.textContent = `
          * {
            color: #000000 !important;
          }
          b, strong {
            color: #000000 !important;
            font-weight: 700 !important;
          }
          .details-item, .details-item p, .details-item b {
            color: #000000 !important;
          }
          .agreement-text, .agreement-text p {
            color: #000000 !important;
          }
          .amount-section, .amount-section p, .amount-section b {
            color: #000000 !important;
          }
          h1 {
            color: #000000 !important;
          }
        `;
        clonedDoc.head.appendChild(style);
      },
    });

    // Calculate PDF dimensions
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const pdfWidth = 210; // A4 width in mm
    const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    let heightLeft = pdfHeight;
    let position = 0;

    // Add first page
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= 297; // A4 height in mm

    // Add additional pages if needed
    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= 297;
    }

    // Download PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Error converting Bond Agreement HTML to PDF:', error);
    throw error;
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}

/**
 * Generate and download Bond Agreement as PDF
 */
export async function generateAndDownloadBondAgreement(data: BondAgreementData) {
  try {
    const html = await generateBondAgreementHTML(data);
    const filename = `bond-agreement-${data.receiptNumber}.pdf`;
    await convertBondHTMLToPDF(html, filename);
  } catch (error) {
    console.error('Error generating bond agreement PDF:', error);
    // Fallback to HTML download if PDF generation fails
    const html = await generateBondAgreementHTML(data);
    const filename = `bond-agreement-${data.receiptNumber}.html`;
    downloadBondAgreement(html, filename);
    throw error;
  }
}

