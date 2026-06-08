"use client";

import React, { useEffect, useState } from "react";
import { Download, Printer, X } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Image from "next/image";

interface InvoiceItem {
  description: string;
  amount: number;
}

interface InvoiceData {
  id: string;
  billNumber: string;
  invoiceDate: string;
  dueDate: string;
  paidDate?: string;
  status: "paid" | "pending" | "overdue";
  items: InvoiceItem[];
  totalAmount: number;
  paymentMethod?: string;
  utr?: string;
  billedTo: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  payTo: {
    name: string;
    address: string;
    website: string;
  };
}

interface InvoiceTemplateProps {
  invoice: InvoiceData;
  onClose?: () => void;
}

export function InvoiceTemplate({ invoice, onClose }: InvoiceTemplateProps) {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const numberToWords = (num: number): string => {
    const ones = [
      "",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
    ];
    const teens = [
      "ten",
      "eleven",
      "twelve",
      "thirteen",
      "fourteen",
      "fifteen",
      "sixteen",
      "seventeen",
      "eighteen",
      "nineteen",
    ];
    const tens = [
      "",
      "",
      "twenty",
      "thirty",
      "forty",
      "fifty",
      "sixty",
      "seventy",
      "eighty",
      "ninety",
    ];

    if (num === 0) return "zero";
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100)
      return (
        tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "")
      );
    if (num < 1000)
      return (
        ones[Math.floor(num / 100)] +
        " hundred" +
        (num % 100 ? " " + numberToWords(num % 100) : "")
      );
    if (num < 100000)
      return (
        numberToWords(Math.floor(num / 1000)) +
        " thousand" +
        (num % 1000 ? " " + numberToWords(num % 1000) : "")
      );
    if (num < 10000000)
      return (
        numberToWords(Math.floor(num / 100000)) +
        " lakh" +
        (num % 100000 ? " " + numberToWords(num % 100000) : "")
      );
    return (
      numberToWords(Math.floor(num / 10000000)) +
      " crore" +
      (num % 10000000 ? " " + numberToWords(num % 10000000) : "")
    );
  };

  const amountInWords = () => {
    const rupees = Math.floor(invoice.totalAmount);
    const paise = Math.round((invoice.totalAmount - rupees) * 100);
    let words = numberToWords(rupees) + " rupees";
    if (paise > 0) {
      words += " and " + numberToWords(paise) + " paise";
    }
    return words + " only.";
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let yPos = margin;

    // Add logo as background watermark
    try {
      const response = await fetch('/SIA-png-logo.png');
      if (response.ok) {
        const blob = await response.blob();
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = async () => {
            try {
              const logoDataUrl = reader.result as string;
              // Create a canvas to apply opacity to the watermark
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve(true);
                return;
              }
              
              // Check if we're in browser environment
              if (typeof window === 'undefined' || typeof Image === 'undefined') {
                resolve(true);
                return;
              }
              
              const img = new (Image as any)();
              await new Promise((imgResolve, imgReject) => {
                img.onload = () => {
                  canvas.width = img.width;
                  canvas.height = img.height;
                  ctx.globalAlpha = 0.1; // Set opacity
                  ctx.drawImage(img, 0, 0);
                  ctx.globalAlpha = 1.0; // Reset
                  
                  const watermarkDataUrl = canvas.toDataURL('image/png');
                  const watermarkSize = 150;
                  const watermarkX = (pageWidth - watermarkSize) / 2;
                  const watermarkY = (pageHeight - watermarkSize) / 2;
                  doc.addImage(watermarkDataUrl, 'PNG', watermarkX, watermarkY, watermarkSize, watermarkSize);
                  imgResolve(true);
                };
                img.onerror = imgReject;
                img.src = logoDataUrl;
              });
            } catch (err) {
              console.warn('Watermark processing error:', err);
              resolve(true);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (err) {
      console.warn('Could not add logo watermark:', err);
    }

    // Official Invoice Box (Top Right) - Draw first
    const boxWidth = 50;
    const boxHeight = 12;
    const boxX = pageWidth - margin - boxWidth;
    const boxY = margin;
    doc.setFillColor(128, 0, 128);
    doc.rect(boxX, boxY, boxWidth, boxHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("OFFICIAL INVOICE", boxX + boxWidth / 2, boxY + boxHeight / 2 + 3, {
      align: "center",
    });
    doc.setTextColor(0, 0, 0);

    // Company Name (Top Left)
    doc.setFontSize(14);
    doc.setTextColor(128, 0, 128);
    doc.setFont("helvetica", "bold");
    doc.text("SECURE INFINITE ASSOCIATION", margin, yPos);
    yPos += 6;

    // Company Address
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.text("Barampuri, Nagpur Rd, Desaiganj Wadsa, Gadchiroli, Maharashtra, 441207", margin, yPos);
    yPos += 10;

    // Invoice Number, Date, and Paid On
    const invoiceDate = formatDate(invoice.invoiceDate);
    const paidDate = invoice.paidDate ? formatDate(invoice.paidDate) : invoiceDate;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Invoice #", margin, yPos);
    doc.setFont("helvetica", "bold");
    doc.text(invoice.billNumber.replace('INV-', '#'), margin + 25, yPos);
    
    doc.setFont("helvetica", "normal");
    doc.text("Date:", pageWidth - margin - 60, yPos, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(invoiceDate, pageWidth - margin, yPos, { align: "right" });
    yPos += 5;
    
    doc.setFont("helvetica", "normal");
    doc.text("Paid on:", pageWidth - margin - 60, yPos, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(paidDate, pageWidth - margin, yPos, { align: "right" });
    doc.setFont("helvetica", "normal");
    yPos += 10;

    // Billed To
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Billed To:", margin, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(invoice.billedTo.name, margin, yPos);
    yPos += 5;
    doc.text(invoice.billedTo.email, margin, yPos);
    yPos += 5;
    if (invoice.billedTo.phone) {
      doc.text(invoice.billedTo.phone, margin, yPos);
      yPos += 5;
    }
    if (invoice.billedTo.address) {
      doc.text(invoice.billedTo.address, margin, yPos);
      yPos += 5;
    }
    yPos += 5;

    // Pay To (Right Column)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Pay To:", pageWidth - margin, yPos, {
      align: "right",
    });
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("SECURE ACADEMY", pageWidth - margin, yPos, {
      align: "right",
    });
    yPos += 5;
    doc.text(
      "Barampuri, Nagpur Rd, Desaiganj Wadsa, Gadchiroli, Maharashtra, 441207",
      pageWidth - margin,
      yPos,
      { align: "right" },
    );
    yPos += 5;
    doc.text(
      "mysecureacademy.in",
      pageWidth - margin,
      yPos,
      { align: "right" },
    );
    yPos += 10;

    // Package/Description
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Description:", margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.items[0]?.description || "Offer Price Old Credit & Additional Courses Services", margin + 30, yPos);
    yPos += 8;

    // Payment Confirmation Stamp (PAID THANK YOU)
    if (invoice.status === "paid") {
      try {
        const stampResponse = await fetch('/paid-stamp.png');
        if (stampResponse.ok) {
          const stampBlob = await stampResponse.blob();
          const stampReader = new FileReader();
          await new Promise((resolve, reject) => {
            stampReader.onload = () => {
              try {
                const stampDataUrl = stampReader.result as string;
                const img = new window.Image();
                img.onload = () => {
                  const stampSize = 50; // Size in mm
                  const stampX = margin;
                  const stampY = yPos;
                  // Maintain aspect ratio
                  const aspectRatio = img.width / img.height;
                  let stampWidth = stampSize;
                  let stampHeight = stampSize / aspectRatio;
                  
                  doc.addImage(stampDataUrl, 'PNG', stampX, stampY, stampWidth, stampHeight);
                  yPos += stampHeight + 5;
                  resolve(true);
                };
                img.onerror = () => {
                  yPos += 15;
                  resolve(true);
                };
                img.src = stampDataUrl;
              } catch (err) {
                yPos += 15;
                resolve(true);
              }
            };
            stampReader.onerror = reject;
            stampReader.readAsDataURL(stampBlob);
          });
        } else {
          yPos += 15;
        }
      } catch (err) {
        console.warn('Could not add paid stamp:', err);
        yPos += 15;
      }
    }

    // Items Table
    const tableData = invoice.items.map((item, index) => [
      index + 1,
      item.description,
      `₹${formatCurrency(item.amount)}`,
    ]);

    const invoiceTableConfig = {
      head: [["Sr", "Description", "Sub Total"]],
      body: tableData,
      startY: yPos,
      styles: { fontSize: 9 },
      headStyles: {
        fillColor: [128, 0, 128],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: margin, right: margin },
    };
    
    (doc as any).autoTable(invoiceTableConfig);

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Amount Total
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Amount Total", pageWidth - margin - 50, yPos, {
      align: "right",
    });
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(
      `₹${formatCurrency(invoice.totalAmount)}`,
      pageWidth - margin,
      yPos,
      { align: "right" },
    );
    yPos += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`(0% tax)`, pageWidth - margin, yPos, {
      align: "right",
    });
    yPos += 5;
    // Date at bottom
    doc.text(
      invoiceDate,
      pageWidth - margin,
      yPos,
      { align: "right" },
    );
    yPos += 10;

    // Transaction Details (Left side)
    if (invoice.status === "paid") {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Transaction Details:", margin, yPos);
      yPos += 5;
      doc.setFont("helvetica", "normal");
      doc.text(`Payment Date: ${paidDate}`, margin, yPos);
      yPos += 4;
      if (invoice.paymentMethod) {
        doc.text(`Payment Method: ${invoice.paymentMethod}`, margin, yPos);
        yPos += 4;
      }
      if (invoice.utr) {
        doc.text(`UTR No.: ${invoice.utr}`, margin, yPos);
        yPos += 4;
      } else {
        doc.text(`UTR No.: Pending...`, margin, yPos);
        yPos += 4;
      }
      yPos += 5;
    }

    // Amount in Words
    doc.setFontSize(8);
    doc.text(`*${amountInWords()}`, margin, yPos);
    yPos += 10;

    // Thank You Message
    yPos += 10;
    doc.setFontSize(9);
    doc.text(
      "Thank You For Your Interest in Our Business,",
      pageWidth / 2,
      yPos,
      { align: "center" },
    );
    yPos += 4;
    doc.text(
      `We have Received Rs. ${formatCurrency(invoice.totalAmount)}/- as credit from You.`,
      pageWidth / 2,
      yPos,
      { align: "center" },
    );
    yPos += 4;
    doc.text(
      "You are getting additionally access to our course.",
      pageWidth / 2,
      yPos,
      { align: "center" },
    );
    yPos += 5;
    doc.setFontSize(7);
    doc.setTextColor(128, 128, 128);
    doc.text(
      "Invoice generated by Secure Investment Academy system.",
      pageWidth / 2,
      yPos,
      { align: "center" },
    );
    doc.setTextColor(0, 0, 0);

    // Add seal/stamp at bottom right
    try {
      const sealResponse = await fetch('/seal.png');
      if (sealResponse.ok) {
        const sealBlob = await sealResponse.blob();
        const sealReader = new FileReader();
        await new Promise((resolve, reject) => {
          sealReader.onload = () => {
            try {
              const sealDataUrl = sealReader.result as string;
              // Load image to get actual dimensions
              const img = new window.Image();
              img.onload = () => {
                const maxSize = 50;
                // Maintain aspect ratio
                const aspectRatio = img.width / img.height;
                let sealWidth = maxSize;
                let sealHeight = maxSize;
                
                if (aspectRatio > 1) {
                  // Wider than tall
                  sealHeight = maxSize / aspectRatio;
                } else {
                  // Taller than wide
                  sealWidth = maxSize * aspectRatio;
                }
                
                const sealX = pageWidth - margin - sealWidth - 5;
                const sealY = pageHeight - margin - sealHeight - 10;
                doc.addImage(sealDataUrl, 'PNG', sealX, sealY, sealWidth, sealHeight);
                resolve(true);
              };
              img.onerror = () => {
                // Fallback to square if image load fails
                const sealSize = 50;
                const sealX = pageWidth - margin - sealSize - 5;
                const sealY = pageHeight - margin - sealSize - 10;
                doc.addImage(sealDataUrl, 'PNG', sealX, sealY, sealSize, sealSize);
                resolve(true);
              };
              img.src = sealDataUrl;
            } catch (err) {
              reject(err);
            }
          };
          sealReader.onerror = reject;
          sealReader.readAsDataURL(sealBlob);
        });
      } else {
        throw new Error('Seal not found');
      }
    } catch (err) {
      console.warn('Could not add seal at bottom:', err);
      // Draw a simple circular stamp as fallback
      const stampSize = 40;
      const stampX = pageWidth - margin - stampSize - 5;
      const stampY = pageHeight - margin - stampSize - 10;
      const stampCenterX = stampX + stampSize / 2;
      const stampCenterY = stampY + stampSize / 2;
      const stampRadius = stampSize / 2;
      
      // Draw outer circle (double border)
      doc.setDrawColor(128, 0, 128);
      doc.setLineWidth(0.5);
      doc.circle(stampCenterX, stampCenterY, stampRadius, 'S');
      doc.circle(stampCenterX, stampCenterY, stampRadius - 1.5, 'S');
      
      // Add text around the circle
      doc.setFontSize(5);
      doc.setTextColor(128, 0, 128);
      doc.text("SECURE INFINITE", stampCenterX, stampCenterY - 8, { align: "center" });
      doc.text("ASSOCIATION", stampCenterX, stampCenterY + 8, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("SIA", stampCenterX, stampCenterY + 2, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
    }

    doc.save(`invoice-${invoice.billNumber}.pdf`);
  };

  return (
    <div className="print:block relative">
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .invoice-print,
          .invoice-print * {
            visibility: visible;
          }
          .invoice-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .logo-watermark {
            opacity: 0.1 !important;
          }
        }
      `}</style>

      {/* Logo Watermark Background - Low Opacity */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
        <div className="logo-watermark" style={{ opacity: 0.08 }}>
          <Image
            src="/SIA-png-logo.png"
            alt="SIA Logo Watermark"
            width={500}
            height={500}
            className="object-contain"
            priority
            style={{ 
              opacity: 0.08,
              filter: 'grayscale(100%)'
            }}
          />
        </div>
      </div>

      <div className="invoice-print max-w-4xl mx-auto bg-white p-6 md:p-8 relative z-10">
        {/* Invoice Content */}
        <Card className="p-6 md:p-8 border-2 border-zinc-200 relative bg-white overflow-visible">
          {/* Official Invoice Box - Top Right */}
          <div className="absolute top-6 right-6 bg-purple-600 text-white px-4 py-2 rounded">
            <p className="text-xs font-bold">OFFICIAL INVOICE</p>
          </div>

          {/* Company Name and Address - Top Left */}
          <div className="mb-6 pr-32">
            <h1 className="text-lg md:text-xl font-bold text-purple-600 mb-2">
              SECURE INFINITE ASSOCIATION
            </h1>
            <p className="text-xs text-zinc-700">
              Barampuri, Nagpur Rd, Desaiganj Wadsa, Gadchiroli, Maharashtra, 441207
            </p>
          </div>

          {/* Invoice Number, Date, and Paid On */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xs text-zinc-600 mb-1">Invoice #</p>
              <p className="text-sm font-bold text-zinc-900">
                {invoice.billNumber.replace('INV-', '#')}
              </p>
            </div>
            <div className="text-right">
              <div className="mb-2">
                <p className="text-xs text-zinc-600 mb-1">Date</p>
                <p className="text-sm font-semibold text-zinc-900">
                  {formatDate(invoice.invoiceDate)}
                </p>
              </div>
              {invoice.status === "paid" && (
                <div>
                  <p className="text-xs text-zinc-600 mb-1">Paid on</p>
                  <p className="text-sm font-semibold text-zinc-900">
                    {invoice.paidDate ? formatDate(invoice.paidDate) : formatDate(invoice.invoiceDate)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Billed To and Pay To */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 mb-3">
                Billed To:
              </h3>
              <div className="text-sm text-zinc-700 space-y-1">
                <p className="font-semibold">{invoice.billedTo.name}</p>
                <p>{invoice.billedTo.email}</p>
                {invoice.billedTo.phone && <p>{invoice.billedTo.phone}</p>}
                {invoice.billedTo.address && <p>{invoice.billedTo.address}</p>}
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-sm font-bold text-zinc-900 mb-3">Pay To:</h3>
              <div className="text-sm text-zinc-700 space-y-1">
                <p className="font-semibold">SECURE ACADEMY</p>
                <p>Barampuri, Nagpur Rd, Desaiganj Wadsa, Gadchiroli, Maharashtra, 441207</p>
                <p>mysecureacademy.in</p>
              </div>
            </div>
          </div>

          {/* Package/Description */}
          <div className="mb-4">
            <p className="text-sm font-bold text-zinc-900 mb-1">Description:</p>
            <p className="text-sm text-zinc-700">
              {invoice.items[0]?.description ||
                "Offer Price Old Credit & Additional Courses Services"}
            </p>
          </div>

          {/* Payment Status Stamp */}
          {invoice.status === "paid" && (
            <div className="flex items-center gap-4 mb-6">
              <div className="relative w-32 h-32 flex-shrink-0">
                <Image
                  src="/paid-stamp.png"
                  alt="PAID THANK YOU Stamp"
                  width={128}
                  height={128}
                  className="object-contain w-full h-full"
                  priority
                />
              </div>
              <div>
                <p className="text-xs text-zinc-600">Status: Payment Confirmed</p>
                <p className="text-xs text-zinc-600">*{amountInWords()}</p>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="mb-6 border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-purple-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold">Sr</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-bold">
                    Sub Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? "bg-white" : "bg-zinc-50"}
                  >
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {item.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 text-right">
                      ₹{formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total Amount */}
          <div className="flex justify-end mb-6">
            <div className="text-right">
              <p className="text-xs text-zinc-600 mb-1">Amount Total</p>
              <p className="text-xl font-bold text-zinc-900">
                ₹{formatCurrency(invoice.totalAmount)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">(0% tax)</p>
              <p className="text-xs text-zinc-500 mt-1">
                {formatDate(invoice.invoiceDate)}
              </p>
            </div>
          </div>

          {/* Transaction Details */}
          {invoice.status === "paid" && (
            <div className="mb-6 border-t border-zinc-200 pt-6">
              <h3 className="text-sm font-bold text-zinc-900 mb-3">
                Transaction Details:
              </h3>
              <div className="space-y-2 text-sm">
                {invoice.paidDate && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Payment Date:</span>
                    <span className="text-zinc-900 font-semibold">
                      {formatDate(invoice.paidDate)}
                    </span>
                  </div>
                )}
                {invoice.paymentMethod && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Payment Method:</span>
                    <span className="text-zinc-900 font-semibold">
                      {invoice.paymentMethod}
                    </span>
                  </div>
                )}
                {invoice.utr ? (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">UTR No.:</span>
                    <span className="text-zinc-900 font-semibold">
                      {invoice.utr}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">UTR No.:</span>
                    <span className="text-zinc-500">Pending...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Thank You Message */}
          <div className="border-t border-zinc-200 pt-6 text-center mb-8">
            <p className="text-sm text-zinc-700 mb-1">
              Thank You For Your Interest in Our Business,
            </p>
            <p className="text-sm text-zinc-700 mb-1">
              We have Received Rs. {formatCurrency(invoice.totalAmount)}/- as
              credit from You.
            </p>
            <p className="text-sm text-zinc-700">
              You are getting additionally access to our course.
            </p>
          </div>

          {/* System Note */}
          <div className="text-center mb-6">
            <p className="text-xs text-zinc-500">
              Invoice generated by Secure Investment Academy system.
            </p>
          </div>

          {/* Seal/Stamp - Bottom Right */}
          <div className="absolute bottom-4 right-4 z-20 w-20 h-20 flex items-center justify-center">
            <Image
              src="/seal.png"
              alt="Seal"
              width={80}
              height={80}
              className="object-contain w-full h-full"
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
