/**
 * Generate HTML Invoice from bill/invoice data
 * Based on SIA-invoice.html template
 */

import { InvoiceDetails } from "@/lib/api/bills";

interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  display_id?: string;
}

export interface HTMLInvoiceData {
  invoiceDetails: InvoiceDetails;
  userProfile: UserProfile;
}

/**
 * Convert image URL to base64 data URL
 */
async function imageToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn(`Failed to load image ${url}:`, error);
    return url; // Fallback to original URL
  }
}

export async function generateHTMLInvoice(data: HTMLInvoiceData): Promise<string> {
  const { invoiceDetails, userProfile } = data;
  
  // Convert images to base64 for embedding (so they work in downloaded HTML)
  let logoBase64 = '/SIA-png-logo.png'; // Default fallback
  let sealBase64 = '/seal.png'; // Default fallback
  let paidStampBase64 = '/paid-stamp.png'; // Default fallback
  let signatureBase64 = '/secure-signature.png'; // Default fallback
  let invoiceTemplateBase64 = ''; // SVG template
  
  try {
    // Try to load logo and seal from public folder
    try {
      logoBase64 = await imageToBase64('/SIA-png-logo.png');
    } catch (err) {
      console.warn('Could not load logo, using URL fallback');
    }
    
    try {
      sealBase64 = await imageToBase64('/seal.png');
    } catch (err) {
      console.warn('Could not load seal, using URL fallback');
    }
    
    try {
      paidStampBase64 = await imageToBase64('/paid-stamp.png');
    } catch (err) {
      console.warn('Could not load paid stamp, using URL fallback');
    }
    
    try {
      signatureBase64 = await imageToBase64('/secure-signature.png');
    } catch (err) {
      console.warn('Could not load signature, using URL fallback');
    }
    
    // SVG template disabled - using HTML invoice only
    // Try to load SVG invoice template
    // try {
    //   const svgResponse = await fetch('/invoice-template.svg');
    //   if (svgResponse.ok) {
    //     const svgText = await svgResponse.text();
    //     // Convert SVG to base64 data URL
    //     invoiceTemplateBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
    //   }
    // } catch (err) {
    //   console.warn('Could not load invoice template SVG:', err);
    // }
  } catch (err) {
    console.warn('Error loading images:', err);
  }
  
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const invoiceDate = formatDate(invoiceDetails.purchased_at);
  const receiptNumber = invoiceDetails.invoice_number.replace('INV-', '#');
  const packageName = invoiceDetails.package.name;
  const packagePrice = invoiceDetails.breakdown.package_price;
  const totalAmount = invoiceDetails.breakdown.total;
  const utrNumber = invoiceDetails.txn_id || "Pending...";
  const paymentMethod = invoiceDetails.payment_type || "Manual";
  
  // User details
  const userName = userProfile.name || invoiceDetails.user.name;
  const userEmail = invoiceDetails.user.email;
  const userPhone = userProfile.phone || "";
  const userAddress = userProfile.address || "";
  const userDisplayId = userProfile.display_id || invoiceDetails.user.id;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Infinite Association Receipt</title>
    <style>
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
            .container {
                box-shadow: none;
                margin: 0;
            }
        }
        
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            gap: 24px;
        }

        .container {
            ${invoiceTemplateBase64 ? `
            background-image: url('${invoiceTemplateBase64}');
            background-size: 100% 100%;
            background-position: top left;
            background-repeat: no-repeat;
            background-color: white;
            ` : `
            background-color: white;
            `}
            width: 100%;
            max-width: 750px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            position: relative;
            padding-bottom: 0;
            overflow: hidden;
            min-height: 842px; /* A4 height in pixels at 96dpi */
            page-break-inside: avoid;
        }
        
        @media print {
            .container {
                page-break-after: avoid;
                page-break-inside: avoid;
            }
        }
        
        /* SIA Logo Background Watermark */
        .container::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 500px;
            height: 500px;
            background-image: url('${logoBase64}');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            opacity: 0.08;
            z-index: 0;
            pointer-events: none;
            filter: grayscale(100%);
        }
        
        /* Ensure content is above watermark */
        .container > * {
            position: relative;
            z-index: 1;
        }

        /* Header Section */
        .header {
            padding: 20px 40px 15px 40px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .logo-placeholder {
            width: 120px;
            height: 120px;
            border: none;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #302b63;
            font-size: 10px;
            text-align: center;
            overflow: hidden;
            padding: 5px;
        }

        .header-text {
            flex: 1;
            text-align: center;
            color: #000080; /* Dark Blue */
        }

        .header-text h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #000080;
        }

        .receipt-title {
            text-align: center;
            color: #000080;
            font-size: 24px;
            font-weight: bold;
            margin-top: 5px;
            margin-bottom: 15px;
            text-transform: uppercase;
            ${invoiceTemplateBase64 ? 'padding: 5px 0;' : ''}
        }

        /* Info Section */
        .info-section {
            display: flex;
            justify-content: space-between;
            padding: 0 40px;
            margin-bottom: 12px;
            font-size: 12px;
            color: #000;
            ${invoiceTemplateBase64 ? 'padding: 10px 40px;' : ''}
        }

        .info-left, .info-right {
            width: 48%;
        }

        .info-row {
            display: flex;
            margin-bottom: 4px;
        }

        .label {
            font-weight: bold;
            min-width: 110px;
            color: #000;
        }

        .value {
            font-weight: bold;
            color: #000;
        }
        
        .address-value {
            display: block;
        }

        .receipt-no {
            color: #302b63;
            font-weight: bold;
        }

        /* Table Section */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }

        thead {
            background-color: #3b2a6b; /* Dark Purple */
            color: white;
        }

        th {
            padding: 8px 12px;
            text-align: left;
            text-transform: uppercase;
            font-size: 12px;
        }
        
        th:nth-child(2), th:nth-child(3), th:nth-child(4) {
            text-align: center;
        }

        td {
            padding: 10px 12px;
            border-bottom: 1px solid #ddd;
            font-weight: bold;
            color: #000;
            font-size: 12px;
        }

        td:nth-child(2), td:nth-child(3), td:nth-child(4) {
            text-align: center;
        }

        /* Total Section */
        .total-row td {
            border-bottom: 2px solid #ddd;
            color: #000;
            font-size: 16px;
        }

        .total-label {
            text-align: left;
            padding-left: 40px;
        }
        
        .total-amount {
            text-align: right;
            padding-right: 40px;
        }

        /* Total Section */
        .total-section {
            padding: 10px 0;
            border-bottom: 1px solid #ddd;
            margin: 0 40px;
        }
        
        .total-content {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 16px;
            color: #000;
        }

        /* Paid Stamp */
        .stamp-container {
            position: relative;
            height: 90px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            margin: 5px 0;
            padding-left: 40px;
        }

        .paid-stamp-img {
            width: 90px;
            height: 90px;
            object-fit: contain;
            display: block;
        }

        /* Notes */
        .notes-section {
            text-align: center;
            padding: 10px 40px;
            font-size: 11px;
            color: #000;
            margin-bottom: 20px;
        }

        .notes-title {
            font-weight: bold;
            margin-bottom: 3px;
            font-size: 12px;
        }

        /* Signature Section */
        .signature-section {
            display: flex;
            justify-content: space-between;
            padding: 20px 40px 15px 40px;
            margin-top: 30px;
            align-items: flex-end;
        }

        .sig-left {
            text-align: left;
            position: relative;
            max-width: 300px;
            font-size: 12px;
            color: #000;
        }

        .sig-image {
            position: relative;
            top: 0;
            left: 0;
            width: 280px;
            height: auto;
            max-height: 180px;
            object-fit: contain;
            display: block;
            margin-bottom: 10px;
        }

        .auth-text {
            color: #302b63;
            font-weight: bold;
            text-transform: uppercase;
            border-top: 1px solid #302b63;
            display: inline-block;
            margin-bottom: 5px;
        }

        .sig-right {
            text-align: right;
            position: relative;
        }

        .stamp-round-placeholder {
            width: 120px;
            height: 120px;
            border: none;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #302b63;
            font-weight: bold;
            font-size: 9px;
            text-align: center;
            margin-left: auto;
            overflow: hidden;
            padding: 3px;
        }

        /* Footer */
        .footer {
            background-color: ${invoiceTemplateBase64 ? 'rgba(48, 43, 99, 0.95)' : '#302b63'};
            color: white;
            padding: 12px 20px;
            display: flex;
            justify-content: space-around;
            align-items: center;
            font-size: 11px;
            margin-top: 20px;
        }

        .footer div {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        /* Legal page content (uses same container template) */
        .legal-section {
            padding: 40px 40px 32px 40px;
            font-size: 13px;
            line-height: 1.6;
            color: #000000;
        }

        .legal-section h2 {
            margin-top: 0;
            margin-bottom: 16px;
            font-size: 18px;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .legal-section p {
            margin: 0 0 10px 0;
        }

        .legal-section .legal-quote {
            margin-top: 12px;
            font-style: italic;
            text-align: center;
        }
    </style>
</head>
<body>

    <div class="container">
        <div class="header">
            <div class="logo-placeholder">
                <img src="${logoBase64}" alt="Secure Infinite Association Logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;">
            </div>
            <div class="header-text">
                <h1>SECURE INFINITE ASSOCIATION</h1>
            </div>
        </div>

        <div class="receipt-title">RECEIPT</div>

        <div class="info-section">
            <div class="info-left">
                <div class="info-row">
                    <span class="label">Date Issued:</span>
                    <span class="value">${invoiceDate}</span>
                </div>
                <div class="info-row">
                    <span class="label">Name:</span>
                    <div class="value address-value">
                        ${userName}${userAddress ? `<br>${userAddress}` : ''}
                    </div>
                </div>
                <div class="info-row">
                    <span class="label">ID Number:</span>
                    <span class="value">${userDisplayId}</span>
                </div>
                ${userPhone ? `<div class="info-row">
                    <span class="label">Mobile Number:</span>
                    <span class="value">${userPhone}</span>
                </div>` : ''}
            </div>

            <div class="info-right">
                <div class="info-row">
                    <span class="label">Receipt No:</span>
                    <span class="value receipt-no">${receiptNumber}</span>
                </div>
                <div class="info-row">
                    <span class="label">Transaction Details</span>
                </div>
                <div class="info-row">
                    <span class="value">UPI /Gateway/UTR<br>${utrNumber}</span>
                </div>
                <div class="info-row" style="margin-top: 10px;">
                    <span class="label">Purpose:</span>
                    <span class="value">Amount given as Credit</span>
                </div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="padding-left: 40px;">DESCRIPTION</th>
                    <th>RATE</th>
                    <th>HOURS</th>
                    <th style="padding-right: 40px; text-align: right;">AMOUNT</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding-left: 40px;">${packageName}</td>
                    <td>Rs ${formatCurrency(packagePrice)}</td>
                    <td>1</td>
                    <td style="padding-right: 40px; text-align: right;">Rs ${formatCurrency(packagePrice)}</td>
                </tr>
                <tr>
                    <td style="padding-left: 40px;">Sub-Total</td>
                    <td>Rs ${formatCurrency(packagePrice)}</td>
                    <td>1</td>
                    <td style="padding-right: 40px; text-align: right;">Rs ${formatCurrency(packagePrice)}</td>
                </tr>
                <tr>
                    <td style="padding-left: 40px;">Tax (0%)</td>
                    <td>Rs 0</td>
                    <td>0</td>
                    <td style="padding-right: 40px; text-align: right;">Rs 0</td>
                </tr>
            </tbody>
        </table>

        <div class="total-section">
            <div class="total-content">
                <span style="color: #000;">TOTAL</span>
                <span style="color: #000;">Rs ${formatCurrency(totalAmount)}</span>
            </div>
        </div>

        <div class="stamp-container">
            <img src="${paidStampBase64}" alt="PAID THANK YOU Stamp" class="paid-stamp-img" />
        </div>

        <div class="notes-section">
            <div class="notes-title">NOTES</div>
            <p style="margin: 0; line-height: 1.5;">
                Thank you for providing the amount as credit. We appreciate your support and encourage you to learn additional courses, refer others, and grow together with us.
            </p>
        </div>

        <div class="signature-section">
            <div class="sig-left">
                <img src="${signatureBase64}" alt="Authorized Signatory Signature" class="sig-image" />
            </div>

            <div class="sig-right">
                <div class="stamp-round-placeholder">
                    <img src="${sealBase64}" alt="Secure Infinite Association Seal" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;">
                </div>
            </div>
        </div>

        <div class="footer">
            <div>&#128222; 02269719182</div>
            <div>&#127760; www.secureinfiniteassociation.com</div>
            <div>&#9993; secureinfiniteassociation@gmail.com</div>
        </div>

    </div>

    <!-- Second page: Legal disclosure about this receipt -->
    <div class="container">
        <div class="header">
            <div class="logo-placeholder">
                <img src="${logoBase64}" alt="Secure Infinite Association Logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;">
            </div>
            <div class="header-text">
                <h1>SECURE INFINITE ASSOCIATION</h1>
            </div>
        </div>

        <div class="receipt-title">RECEIPT – LEGAL DISCLOSURE</div>

        <div class="legal-section">
            <h2>Receipt – Legal Disclosure</h2>
            <p>
                <strong>1. Nature of Business &amp; Platform Use</strong><br>
                Welcome to the Secure Infinite Association platform. By accessing this software, you
                acknowledge that this platform is strictly designed for direct selling, e-commerce, and
                the management of product purchases (including FMCG, Pharma, and Agro products). This
                platform is <strong>NOT</strong> an investment portal, financial scheme, or a public
                deposit collection system.
            </p>
            <p>
                <strong>2. No Guaranteed Returns or &quot;ROI&quot;</strong><br>
                The company strictly prohibits and does not offer any fixed monthly returns, interest
                payouts, or &quot;money doubling&quot; schemes. Any commissions, incentives, or bonuses
                displayed in this software are strictly generated through the active sales of company
                products and are subject to the official compensation plan, including all applicable
                system caps and limits.
            </p>
            <p>
                <strong>3. Product Purchase Acknowledgement</strong><br>
                Any funds transferred to the company are exclusively for the purchase of products,
                goods, or services, or as a standard business advance for such purchases. You confirm
                that you are not depositing funds as a loan or financial investment.
            </p>
            <p>
                <strong>4. Prohibition of Misrepresentation</strong><br>
                Independent distributors, leaders, and users are strictly forbidden from
                misrepresenting the company&apos;s business model. Promoting the company&apos;s product
                packages as &quot;investments&quot; or promising guaranteed financial returns to third
                parties is a direct violation of company policy and will result in immediate
                termination of the user account and potential legal action.
            </p>
            <p>
                <strong>5. Risk &amp; Liability</strong><br>
                Success in this business depends entirely on individual effort, sales volume, and
                market conditions. The company holds no liability for any unauthorized financial
                promises made by independent agents or third parties outside of the official,
                published company materials.
            </p>
            <p>
                <strong>6. Jurisdiction</strong><br>
                By continuing to use this software, you agree to these terms. All legal disputes shall
                be subject to the exclusive jurisdiction of the competent courts in Desaiganj.
            </p>
            <p class="legal-quote">&quot;Empowering India through Innovation &amp; Integrity.&quot;</p>
        </div>
    </div>

</body>
</html>`;

  return html;
}

/**
 * Download HTML invoice as file
 */
export function downloadHTMLInvoice(html: string, filename: string = 'invoice.html') {
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
export async function convertHTMLToPDF(html: string, filename: string = 'invoice.pdf'): Promise<void> {
  // Create a temporary container to render HTML
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '750px'; // Match invoice width
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

    // Convert HTML to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
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
    console.error('Error converting HTML to PDF:', error);
    throw error;
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}

/**
 * Generate and download HTML invoice as PDF (wrapper function)
 */
export async function generateAndDownloadHTMLInvoice(
  data: HTMLInvoiceData,
  filename?: string
) {
  const html = await generateHTMLInvoice(data);
  const invoiceFilename = filename || `invoice-${data.invoiceDetails.invoice_number}.pdf`;
  await convertHTMLToPDF(html, invoiceFilename);
}

/**
 * Convert HTML to PDF using browser print
 */
export function printHTMLInvoice(html: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print invoice');
    return;
  }
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for images to load
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}

