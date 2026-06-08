"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { InvoiceTemplate } from "@/components/invoice/InvoiceTemplate";
import { useAppSelector } from "@/redux/hooks";
import { getBills, getInvoiceDetails, getBondDownloadFee, authorizeBondDownload, type Bill as ApiBill, type InvoiceDetails } from "@/lib/mock/bills";
import { getUserProfile } from "@/lib/mock/profile";
import { generateAndDownloadHTMLInvoice } from "@/utils/generateHTMLInvoice";
import { generateAndDownloadBondAgreement } from "@/utils/generateBondAgreement";

type SortConfig = { key: string; direction: "asc" | "desc" } | null;
type PeriodFilter = "daily" | "weekly" | "monthly" | "all";

interface Bill {
  id: string;
  billNumber: string;
  description: string;
  amount: number;
  dueDate: string;
  paidDate: string;
  status: "paid"; // Bills are always paid (only generated after successful payment)
  paymentMethod: string;
  invoiceDetails?: InvoiceDetails;
}

// Map API bill to frontend Bill format
function mapApiBillToBill(apiBill: ApiBill): Bill {
  // Generate bill number from purchase ID
  const billNumber = `#${apiBill.id.padStart(5, '0')}`;
  
  return {
    id: apiBill.id,
    billNumber,
    description: apiBill.description || apiBill.package_name,
    amount: apiBill.amount,
    dueDate: apiBill.purchased_at, // Use purchased_at as due date
    paidDate: apiBill.purchased_at, // Bills are always paid, so paid date = purchase date
    status: "paid", // Always paid for bills
    paymentMethod: apiBill.payment_type || (apiBill.is_manual ? 'Manual' : 'Gateway'),
  };
}

export default function BillPage() {
  const user = useAppSelector((state) => state.auth.user);
  const [searchQuery, setSearchQuery] = useState("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  
  // Check if bond should be shown for this package amount (1 lakh to 23 lakh)
  const shouldShowBond = (amount: number): boolean => {
    return amount >= 100000 && amount <= 2300000;
  };
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Bill | null>(null);
  
  // API state
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Fetch bills from API
  useEffect(() => {
    const fetchBills = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getBills({
          page: currentPage,
          limit: itemsPerPage,
        });
        
        const mappedBills = response.items.map(mapApiBillToBill);
        setBills(mappedBills);
        setTotalItems(response.total);
        setTotalPages(Math.ceil(response.total / itemsPerPage));
      } catch (err: any) {
        console.error('Failed to fetch bills:', err);
        setError(err?.message || 'Failed to load bills');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBills();
  }, [currentPage, itemsPerPage]);

  // Helper function to filter by period
  const filterByPeriod = (
    dateString: string,
    period: PeriodFilter,
  ): boolean => {
    if (period === "all") return true;

    const itemDate = new Date(dateString);
    const now = new Date();

    if (period === "daily") {
      return (
        itemDate.getDate() === now.getDate() &&
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    }

    if (period === "weekly") {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return itemDate >= weekStart && itemDate <= weekEnd;
    }

    if (period === "monthly") {
      return (
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    }

    return true;
  };

  // Calculate statistics - bills are always paid
  const totalPaid = useMemo(
    () =>
      bills.reduce((sum, r) => sum + r.amount, 0),
    [bills],
  );

  const totalPending = useMemo(() => 0, []); // Bills are always paid
  const totalOverdue = useMemo(() => 0, []); // Bills are always paid

  // Filter and sort data
  const filteredData = useMemo(() => {
    let filtered = bills.filter((item) => {
      const matchesPeriod = filterByPeriod(item.dueDate, periodFilter);
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.billNumber.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower) ||
        item.id.toLowerCase().includes(searchLower);

      return matchesPeriod && matchesSearch;
    });

    // Sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Bill];
        let bValue: any = b[sortConfig.key as keyof Bill];

        if (sortConfig.key === "dueDate" || sortConfig.key === "paidDate") {
          aValue = new Date(aValue || 0).getTime();
          bValue = new Date(bValue || 0).getTime();
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [bills, searchQuery, periodFilter, sortConfig]);

  // Pagination - use client-side pagination for filtered data
  const filteredTotalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null;
      }
      return { key, direction: "asc" };
    });
  };

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

  const getStatusBadge = () => {
    // Bills are always paid (only generated after successful payment)
    return (
      <Badge
        tone="green"
        soft={false}
        className="uppercase text-xs font-bold"
      >
        Paid
      </Badge>
    );
  };

  const handleExportPDF = async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('Export PDF clicked, filteredData length:', filteredData.length);
      }
      
      if (filteredData.length === 0) {
        alert('No data available to export');
        return;
      }

      // Get last one month data
      const now = new Date();
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);

      const oneMonthData = filteredData.filter((item) => {
        const itemDate = new Date(item.dueDate);
        return itemDate >= oneMonthAgo;
      });

      // IMPORTANT: For jspdf-autotable v5, import plugin FIRST, then jsPDF
      let autoTableModule: any = null;
      if (typeof window !== "undefined") {
        autoTableModule = await import("jspdf-autotable");
      }
      
      // Now import jsPDF - the plugin should attach to it
      const jsPDFModule = await import("jspdf");
      const jsPDF = jsPDFModule.default;
      
      // Create PDF instance
      const doc = new jsPDF();
      
      // Determine how to use autoTable
      let autoTableFn: any = null;
      
      // Try method first (doc.autoTable)
      if (typeof (doc as any).autoTable === "function") {
        autoTableFn = (config: any) => (doc as any).autoTable(config);
        if (process.env.NODE_ENV === 'development') {
          console.log("Using autoTable as method");
        }
      } 
      // Try function (autoTable(doc, ...))
      else if (autoTableModule && typeof (autoTableModule as any).default === "function") {
        autoTableFn = (config: any) => (autoTableModule as any).default(doc, config);
        if (process.env.NODE_ENV === 'development') {
          console.log("Using autoTable as function");
        }
      }
      // Try named export
      else if (autoTableModule && typeof (autoTableModule as any).autoTable === "function") {
        autoTableFn = (config: any) => (autoTableModule as any).autoTable(doc, config);
        if (process.env.NODE_ENV === 'development') {
          console.log("Using autoTable as named export");
        }
      }
      
      if (!autoTableFn) {
        console.error("autoTable not available. Plugin module:", autoTableModule);
        throw new Error("autoTable plugin not loaded. Please refresh the page and try again.");
      }

      // Title
      doc.setFontSize(18);
      doc.text("Bill Report (Last 1 Month)", 14, 20);

      // Date
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 14, 30);
      doc.text(`Total Records: ${oneMonthData.length}`, 14, 36);
      doc.text(
        `Total Amount: ₹${formatCurrency(oneMonthData.reduce((sum, item) => sum + item.amount, 0))}`,
        14,
        42,
      );

      // Table data
      const tableData = oneMonthData.map((r, index) => [
        index + 1,
        r.billNumber,
        r.description,
        `₹${formatCurrency(r.amount)}`,
        formatDate(r.dueDate),
        r.paidDate ? formatDate(r.paidDate) : "-",
        r.status.toUpperCase(),
        r.paymentMethod || "-",
      ]);

      // Add table using the correct autoTable function
      const tableConfig = {
        head: [
          [
            "Sr",
            "Bill Number",
            "Description",
            "Amount",
            "Due Date",
            "Paid Date",
            "Status",
            "Payment Method",
          ],
        ],
        body: tableData,
        startY: 50,
        styles: { fontSize: 8 },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 50 },
      };
      
      autoTableFn(tableConfig);

      // Save PDF
      doc.save(`bill-${new Date().toISOString().split("T")[0]}.pdf`);
      if (process.env.NODE_ENV === 'development') {
        console.log('PDF exported successfully');
      }
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      alert(`Failed to export PDF: ${error?.message || 'Unknown error'}`);
    }
  };

  // Helper function to convert number to words
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

  const amountInWords = (amount: number): string => {
    const rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);
    let words = numberToWords(rupees);
    if (paise > 0) {
      words += " and " + numberToWords(paise) + " paise";
    }
    return words.charAt(0).toUpperCase() + words.slice(1);
  };

  const handleDownloadInvoice = async (bill: Bill) => {
    try {
      // Fetch invoice details from API
      const invoiceDetails = await getInvoiceDetails(bill.id);
      
      // Fetch user profile for complete user information
      let userProfile = {
        name: invoiceDetails.user.name,
        email: invoiceDetails.user.email,
        phone: "",
        address: "",
        display_id: user?.display_id || user?.id || "",
      };
      
      try {
        const profile = await getUserProfile();
        userProfile.phone = profile.phone || profile.profile?.phone || "";
        // Handle address - can be object or string
        if (typeof profile.address === 'string') {
          userProfile.address = profile.address;
        } else if (profile.address && typeof profile.address === 'object') {
          // Format address object to string
          const addrParts = [
            profile.address.address,
            profile.address.city,
            profile.address.district,
            profile.address.state,
            profile.address.zipCode
          ].filter(Boolean);
          userProfile.address = addrParts.join(', ') || profile.profile?.address || "";
        } else {
          userProfile.address = profile.profile?.address || "";
        }
      } catch (err) {
        console.warn("Could not fetch user profile:", err);
      }
      
      // Generate and download HTML invoice
      await generateAndDownloadHTMLInvoice({
        invoiceDetails,
        userProfile,
      });
    } catch (err: any) {
      console.error('Failed to fetch invoice details:', err);
      alert(err?.message || 'Failed to load invoice');
    }
  };

  const handleDownloadBond = async (bill: Bill) => {
    // STEP 1: Get fee amount first (without deducting)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔒 Starting bond download - Checking fee amount...');
    }
    let feeInfo: any = null;
    
    try {
      feeInfo = await getBondDownloadFee();
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Fee amount retrieved:', feeInfo);
      }
    } catch (feeError: any) {
      console.error('❌ Failed to get fee amount:', feeError);
      if (feeError.response?.data?.error === 'FEE_RULE_NOT_FOUND' || feeError.response?.data?.error === 'FEE_RULE_INACTIVE') {
        const errorMessage = feeError.response?.data?.message || 'Fee rule not configured. Please contact administrator.';
        alert(`Error: ${errorMessage}\n\nBond download has been BLOCKED.`);
        return; // BLOCK DOWNLOAD
      }
      alert(`Error: Failed to get fee information. Please try again.`);
      return; // BLOCK DOWNLOAD
    }
    
    if (!feeInfo || !feeInfo.fee_amount || feeInfo.fee_amount <= 0) {
      alert('Invalid fee amount. Bond download has been BLOCKED.');
      return; // BLOCK DOWNLOAD
    }
    
    // STEP 2: Show confirmation popup BEFORE deducting fee
    const confirmDownload = confirm(
      `Bond Download Fee\n\n` +
      `Fee Amount: ₹${feeInfo.fee_amount.toFixed(2)}\n` +
      `This amount will be deducted from your wallet (if not already paid).\n\n` +
      `Click OK to proceed with download.`
    );
    
    if (!confirmDownload) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ User cancelled - Fee will NOT be deducted');
      }
      return; // User cancelled, don't deduct fee and don't download
    }
    
    // STEP 3: User confirmed - Now check and deduct fee (if not already paid)
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ User confirmed - Checking fee status...');
    }
    let feeResponse: any = null;
    
    try {
      feeResponse = await authorizeBondDownload(bill.id);
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Fee check completed:', feeResponse);
      }
    } catch (feeError: any) {
      console.error('❌ Fee authorization failed:', feeError);
      if (feeError.response?.data?.error === 'FEE_RULE_NOT_FOUND' || feeError.response?.data?.error === 'FEE_RULE_INACTIVE') {
        const errorMessage = feeError.response?.data?.message || 'Fee rule not configured. Please contact administrator.';
        alert(`Error: ${errorMessage}\n\nBond download has been BLOCKED.`);
        return; // BLOCK DOWNLOAD
      }
      alert(`Error: Failed to authorize bond download. Please try again.`);
      return; // BLOCK DOWNLOAD
    }
    
    // Validate fee authorization response
    if (!feeResponse || !feeResponse.success) {
      alert('Fee authorization failed. Bond download has been BLOCKED.');
      return; // BLOCK DOWNLOAD
    }
    
    // Log fee status (development only)
    if (process.env.NODE_ENV === 'development') {
      if (feeResponse.already_paid) {
        console.log(`✅ Fee already paid for this bill - Proceeding with bond download...`);
      } else {
        console.log(`✅ Fee deducted: ₹${feeResponse.fee_deducted} - Proceeding with bond download...`);
      }
    }

    // Now proceed with bond download - fee has been successfully deducted
    try {

      // Fetch invoice details from API
      const invoiceDetails = await getInvoiceDetails(bill.id);
      
      // Fetch user profile for complete user information
      let userProfile = {
        name: invoiceDetails.user.name,
        email: invoiceDetails.user.email,
        phone: "",
        address: "",
        display_id: user?.display_id || user?.id || "",
      };
      
      try {
        const profile = await getUserProfile();
        userProfile.phone = profile.phone || profile.profile?.phone || "";
        // Handle address - can be object or string
        if (typeof profile.address === 'string') {
          userProfile.address = profile.address;
        } else if (profile.address && typeof profile.address === 'object') {
          // Format address object to string
          const addrParts = [
            profile.address.address,
            profile.address.city,
            profile.address.district,
            profile.address.state,
            profile.address.zipCode
          ].filter(Boolean);
          userProfile.address = addrParts.join(', ') || profile.profile?.address || "";
        } else {
          userProfile.address = profile.profile?.address || "";
        }
      } catch (err) {
        console.warn("Could not fetch user profile:", err);
      }

      // Format receipt number
      const receiptNumber = invoiceDetails.invoice_number.replace('INV-', '');
      
      // Generate and download Bond Agreement
      await generateAndDownloadBondAgreement({
        userName: userProfile.name,
        userDisplayId: userProfile.display_id,
        userAddress: userProfile.address || 'N/A',
        date: invoiceDetails.purchased_at,
        paymentMode: invoiceDetails.payment_type || 'Online',
        transactionNo: invoiceDetails.txn_id || '-',
        amount: invoiceDetails.breakdown.total,
        amountInWords: amountInWords(invoiceDetails.breakdown.total),
        receiptNumber: receiptNumber,
      });
    } catch (err: any) {
      console.error('Failed to generate bond agreement:', err);
      const feeMessage = feeResponse.already_paid 
        ? 'Note: Fee was already paid for this bill previously.'
        : `Note: Fee (₹${feeResponse.fee_deducted}) has already been deducted.`;
      alert(`Error generating bond: ${err?.message || 'Unknown error'}\n\n${feeMessage} Please contact support if you need assistance.`);
    }
  };

  const generateInvoicePDF = async (bill: Bill, invoiceDetails: InvoiceDetails) => {
    try {
      // Fetch user profile to get phone number
      let userPhone = "";
      try {
        const profile = await getUserProfile();
        userPhone = profile.phone || profile.profile?.phone || "";
      } catch (err) {
        console.warn("Could not fetch user profile for phone number:", err);
      }

      // Import jspdf and autotable dynamically
      let autoTableModule: any = null;
      if (typeof window !== "undefined") {
        autoTableModule = await import("jspdf-autotable");
      }
      
      const jsPDFModule = await import("jspdf");
      const jsPDF = jsPDFModule.default;
      
      const doc = new jsPDF();
      
      // Determine how to use autoTable
      let autoTableFn: any = null;
      if (typeof (doc as any).autoTable === "function") {
        autoTableFn = (config: any) => (doc as any).autoTable(config);
      } else if (autoTableModule && typeof (autoTableModule as any).default === "function") {
        autoTableFn = (config: any) => (autoTableModule as any).default(doc, config);
      } else if (autoTableModule && typeof (autoTableModule as any).autoTable === "function") {
        autoTableFn = (config: any) => (autoTableModule as any).autoTable(doc, config);
      }
      
      if (!autoTableFn) {
        throw new Error("autoTable plugin not loaded. Please refresh the page and try again.");
      }
      
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
                if (ctx) {
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
                }
                resolve(true);
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
      const invoiceDate = new Date(invoiceDetails.purchased_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Invoice #", margin, yPos);
      doc.setFont("helvetica", "bold");
      doc.text(invoiceDetails.invoice_number.replace('INV-', '#'), margin + 25, yPos);
      
      doc.setFont("helvetica", "normal");
      doc.text("Date:", pageWidth - margin - 60, yPos, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(invoiceDate, pageWidth - margin, yPos, { align: "right" });
      yPos += 5;
      
      doc.setFont("helvetica", "normal");
      doc.text("Paid on:", pageWidth - margin - 60, yPos, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(invoiceDate, pageWidth - margin, yPos, { align: "right" });
      doc.setFont("helvetica", "normal");
      yPos += 10;

      // Billed To
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Billed To:", margin, yPos);
      yPos += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(invoiceDetails.user.name, margin, yPos);
      yPos += 5;
      doc.text(invoiceDetails.user.email, margin, yPos);
      yPos += 5;
      // Phone number
      if (userPhone) {
        doc.text(userPhone, margin, yPos);
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
      doc.text("Package:", margin, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(invoiceDetails.package.name, margin + 25, yPos);
      yPos += 8;

      // Payment Confirmation Box (Green)
      const paidBoxWidth = 40;
      const paidBoxHeight = 10;
      const paidBoxX = margin;
      const paidBoxY = yPos;
      doc.setFillColor(34, 197, 94); // Green color
      doc.rect(paidBoxX, paidBoxY, paidBoxWidth, paidBoxHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("PAID", paidBoxX + paidBoxWidth / 2, paidBoxY + 4, { align: "center" });
      doc.text("THANK YOU", paidBoxX + paidBoxWidth / 2, paidBoxY + 7, { align: "center" });
      doc.setTextColor(0, 0, 0);
      yPos += 15;

      // Items Table
      const tableData = [
        [
          1,
          invoiceDetails.package.name,
          invoiceDetails.breakdown.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        ],
      ];

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
      
      autoTableFn(invoiceTableConfig);

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
        `₹${invoiceDetails.breakdown.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Transaction Details:", margin, yPos);
      yPos += 5;
      doc.setFont("helvetica", "normal");
      doc.text(`Payment Date: ${invoiceDate}`, margin, yPos);
      yPos += 4;
      if (invoiceDetails.payment_type) {
        doc.text(`Payment Method: ${invoiceDetails.payment_type}`, margin, yPos);
        yPos += 4;
      }
      if (invoiceDetails.txn_id) {
        doc.text(`UTR No.: ${invoiceDetails.txn_id}`, margin, yPos);
        yPos += 4;
      } else {
        doc.text(`UTR No.: Pending...`, margin, yPos);
        yPos += 4;
      }
      yPos += 5;

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
        `We have Received Rs. ${invoiceDetails.breakdown.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/- as credit from You.`,
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
                const img = new (Image as any)();
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

      doc.save(`invoice-${invoiceDetails.invoice_number}.pdf`);
    } catch (error: any) {
      console.error("Error generating invoice PDF:", error);
      alert(`Failed to download PDF: ${error?.message || "Unknown error"}`);
    }
  };


  return (
    <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7">
      <H1>Receipt</H1>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-[var(--accent-green-text)] hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                Total Paid
              </p>
              <p className="text-xl font-bold text-[var(--accent-green-text)]">
                ₹{formatCurrency(totalPaid)}
              </p>
            </div>
            <FileText className="w-8 h-8 text-[var(--accent-green-text)] opacity-50" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-[var(--accent-amber-text)] hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                Total Pending
              </p>
              <p className="text-xl font-bold text-[var(--accent-amber-text)]">
                ₹{formatCurrency(totalPending)}
              </p>
            </div>
            <FileText className="w-8 h-8 text-[var(--accent-amber-text)] opacity-50" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-[var(--accent-red-text)] hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                Total Overdue
              </p>
              <p className="text-xl font-bold text-[var(--accent-red-text)]">
                ₹{formatCurrency(totalOverdue)}
              </p>
            </div>
            <FileText className="w-8 h-8 text-[var(--accent-red-text)] opacity-50" />
          </div>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border)] p-4 md:p-5">
          <div>
            <p className="text-xs md:text-[13px] text-[var(--text-muted)] font-semibold">
              View and manage all your bills and invoices
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="primary" size="md" onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 p-4 md:p-5 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              className="w-full pl-10 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[15px] shadow-sm min-h-[44px] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition-colors"
              placeholder="Search by Bill Number, Description..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { value: "all", label: "All Time" },
              { value: "daily", label: "Today" },
              { value: "weekly", label: "This Week" },
              { value: "monthly", label: "This Month" },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => {
                  setPeriodFilter(filter.value as PeriodFilter);
                  setCurrentPage(1);
                }}
                className={[
                  "px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition-colors min-h-[44px] flex items-center gap-1",
                  periodFilter === filter.value
                    ? "bg-[var(--brand-blue)] text-white border border-[var(--brand-blue)]"
                    : "bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-strong)]",
                ].join(" ")}
              >
                <Calendar className="h-3 w-3" />
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Main Table Card */}
      <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4 animate-spin" />
            <p className="text-[var(--text-muted)] font-medium">Loading bills...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-[var(--accent-red-text)] mx-auto mb-4" />
            <p className="text-[var(--text-muted)] font-medium">{error}</p>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4" />
            <p className="text-[var(--text-muted)] font-medium">
              No bills found matching your criteria.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block w-full overflow-x-auto mb-5">
              <Table className="w-full">
                <THead>
                  <tr>
                    <TH>Sr No</TH>
                    <TH>Bill Number</TH>
                    <TH>Description</TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-[var(--hover-bg)] transition-colors"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center gap-1">
                        Amount (₹)
                        {sortConfig?.key === "amount" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    </TH>
                    <TH
                      className="cursor-pointer select-none hover:bg-[var(--hover-bg)] transition-colors"
                      onClick={() => handleSort("dueDate")}
                    >
                      <div className="flex items-center gap-1">
                        Due Date
                        {sortConfig?.key === "dueDate" && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    </TH>
                    <TH>Paid Date</TH>
                    <TH>Status</TH>
                    <TH>Actions</TH>
                  </tr>
                </THead>
                <tbody>
                  {paginatedData.map((row, index) => (
                    <TR
                      key={row.id}
                      className="hover:bg-[var(--hover-bg)] transition-all duration-200"
                    >
                      <TD className="whitespace-nowrap text-[var(--text-body)]">
                        {startIndex + index + 1}
                      </TD>
                      <TD className="whitespace-nowrap font-medium text-[var(--brand-blue)]">
                        {row.billNumber}
                      </TD>
                      <TD className="text-[var(--text-body)]">
                        {row.description}
                      </TD>
                      <TD className="whitespace-nowrap font-semibold text-[var(--accent-green-text)]">
                        ₹{formatCurrency(row.amount)}
                      </TD>
                      <TD className="whitespace-nowrap text-[var(--text-body)] text-sm">
                        {formatDate(row.dueDate)}
                      </TD>
                      <TD className="whitespace-nowrap text-[var(--text-body)] text-sm">
                        {row.paidDate ? formatDate(row.paidDate) : "-"}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {getStatusBadge()}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownloadInvoice(row)}
                            className="p-1.5 rounded hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--hover-text)] transition-colors"
                            title="Download Invoice"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          {shouldShowBond(row.amount) && (
                            <button
                              onClick={() => handleDownloadBond(row)}
                              className="p-1.5 rounded hover:bg-[var(--hover-bg)] text-[var(--accent-green)] hover:text-[var(--accent-green)] transition-colors"
                              title="Download Bond"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden mb-5 space-y-3">
              {paginatedData.map((row, index) => (
                <div
                  key={row.id}
                  className="p-4 border-l-4 border-l-[var(--accent-green-text)] rounded-lg hover:bg-[var(--hover-bg)] transition-colors duration-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-muted)]">
                        Bill Number
                      </span>
                      <span className="text-sm font-semibold text-[var(--brand-blue)]">
                        {row.billNumber}
                      </span>
                    </div>
                    {getStatusBadge()}
                  </div>
                  <div className="mb-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      Description
                    </span>
                    <p className="text-sm text-[var(--text-body)] mt-1">
                      {row.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      Amount
                    </span>
                    <span className="text-lg font-bold text-[var(--accent-green-text)]">
                      ₹{formatCurrency(row.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      Due Date
                    </span>
                    <span className="text-xs text-[var(--text-body)]">
                      {formatDate(row.dueDate)}
                    </span>
                  </div>
                  {row.paidDate && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[var(--text-muted)]">
                        Paid Date
                      </span>
                      <span className="text-xs text-[var(--text-body)]">
                        {formatDate(row.paidDate)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                    <button
                      onClick={() => handleDownloadInvoice(row)}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--accent-blue-bg)] text-[var(--brand-blue)] hover:bg-[var(--hover-bg)] transition-colors text-sm font-semibold flex items-center justify-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Download Invoice
                    </button>
                    {shouldShowBond(row.amount) && (
                      <button
                        onClick={() => handleDownloadBond(row)}
                        className="flex-1 px-3 py-2 rounded-lg bg-[var(--accent-green-bg)] text-[var(--accent-green)] hover:bg-[var(--hover-bg)] transition-colors text-sm font-semibold flex items-center justify-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        Download Bond
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 md:p-5 border-t border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-body)]">
                    Items per page:
                  </span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition-colors"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-body)]">
                    Showing {startIndex + 1} to{" "}
                    {Math.min(startIndex + itemsPerPage, filteredData.length)}{" "}
                    of {filteredData.length} bills
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1 || isLoading}
                    className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-[var(--text-body)]">
                    Page {currentPage} of {filteredTotalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === filteredTotalPages}
                    className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-4xl">
            <div className="bg-[var(--card-bg)] rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
              {/* Action Buttons - Top Right */}
              <div className="sticky top-0 bg-[var(--card-bg)] border-b border-[var(--border)] p-4 flex justify-end gap-2 rounded-t-lg z-10 shadow-sm">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    // Generate and download HTML invoice
                    if (selectedInvoice?.invoiceDetails) {
                      // Fetch user profile for complete user information
                      let userProfile = {
                        name: selectedInvoice.invoiceDetails.user.name,
                        email: selectedInvoice.invoiceDetails.user.email,
                        phone: user?.phone || "",
                        address: "",
                        display_id: user?.display_id || user?.id || "",
                      };
                      
                      try {
                        const profile = await getUserProfile();
                        userProfile.phone = profile.phone || profile.profile?.phone || "";
                        // Handle address - can be object or string
                        if (typeof profile.address === 'string') {
                          userProfile.address = profile.address;
                        } else if (profile.address && typeof profile.address === 'object') {
                          // Format address object to string
                          const addrParts = [
                            profile.address.address,
                            profile.address.city,
                            profile.address.district,
                            profile.address.state,
                            profile.address.zipCode
                          ].filter(Boolean);
                          userProfile.address = addrParts.join(', ') || profile.profile?.address || "";
                        } else {
                          userProfile.address = profile.profile?.address || "";
                        }
                      } catch (err) {
                        console.warn("Could not fetch user profile:", err);
                      }
                      
                      await generateAndDownloadHTMLInvoice({
                        invoiceDetails: selectedInvoice.invoiceDetails,
                        userProfile,
                      });
                    } else {
                      // Fallback: fetch invoice details first
                      try {
                        const invoiceDetails = await getInvoiceDetails(selectedInvoice.id);
                        
                        // Fetch user profile
                        let userProfile = {
                          name: invoiceDetails.user.name,
                          email: invoiceDetails.user.email,
                          phone: user?.phone || "",
                          address: "",
                          display_id: user?.display_id || user?.id || "",
                        };
                        
                        try {
                          const profile = await getUserProfile();
                          userProfile.phone = profile.phone || profile.profile?.phone || "";
                          // Handle address - can be object or string
                          if (typeof profile.address === 'string') {
                            userProfile.address = profile.address;
                          } else if (profile.address && typeof profile.address === 'object') {
                            // Format address object to string
                            const addrParts = [
                              profile.address.address,
                              profile.address.city,
                              profile.address.district,
                              profile.address.state,
                              profile.address.zipCode
                            ].filter(Boolean);
                            userProfile.address = addrParts.join(', ') || profile.profile?.address || "";
                          } else {
                            userProfile.address = profile.profile?.address || "";
                          }
                        } catch (err) {
                          console.warn("Could not fetch user profile:", err);
                        }
                        
                        await generateAndDownloadHTMLInvoice({
                          invoiceDetails,
                          userProfile,
                        });
                      } catch (err: any) {
                        console.error('Failed to fetch invoice details:', err);
                        alert(err?.message || 'Failed to load invoice');
                      }
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Invoice
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedInvoice(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="overflow-y-auto max-h-[calc(100vh-120px)]">
                {selectedInvoice?.invoiceDetails ? (
                  <InvoiceTemplate
                    invoice={{
                      id: selectedInvoice.invoiceDetails.id,
                      billNumber: selectedInvoice.invoiceDetails.invoice_number,
                      invoiceDate: selectedInvoice.invoiceDetails.purchased_at,
                      dueDate: selectedInvoice.invoiceDetails.purchased_at,
                      paidDate: selectedInvoice.invoiceDetails.purchased_at,
                      status: (selectedInvoice.invoiceDetails.status as "pending" | "paid" | "overdue") || "paid",
                      items: [
                        {
                          description: selectedInvoice.invoiceDetails.package.name,
                          amount: selectedInvoice.invoiceDetails.breakdown.total,
                        },
                      ],
                      totalAmount: selectedInvoice.invoiceDetails.breakdown.total,
                      paymentMethod: selectedInvoice.invoiceDetails.payment_type,
                      utr: selectedInvoice.invoiceDetails.txn_id || undefined,
                      billedTo: {
                        name: selectedInvoice.invoiceDetails.user.name,
                        email: selectedInvoice.invoiceDetails.user.email,
                        phone: user?.phone || "",
                        address: "",
                      },
                      payTo: {
                        name: "SECURE ACADEMY",
                        address:
                          "Barampuri, Nagpur Rd, Desaiganj Wadsa, Gadchiroli, Maharashtra, 441207",
                        website: "mysecureacademy.in",
                      },
                    }}
                    onClose={() => setSelectedInvoice(null)}
                  />
                ) : (
                  <div className="p-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">Loading invoice details...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

