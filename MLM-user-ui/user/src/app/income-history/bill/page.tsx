"use client";

import React, { useState, useMemo } from "react";
import {
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  ArrowUpDown,
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  Banknote,
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { PayFirstModal } from "@/components/ui/me/PayFirstModal";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { InvoiceTemplate } from "@/components/invoice/InvoiceTemplate";
import { useAppSelector } from "@/redux/hooks";
import { Eye } from "lucide-react";

type PaymentStatus = "successful" | "failed" | "pending";
type BillStatus = "paid" | "pending" | "overdue";
type FilterStatus = "all" | PaymentStatus;
type SortConfig = { key: string; direction: "asc" | "desc" } | null;
type PeriodFilter = "daily" | "weekly" | "monthly" | "all";
type ViewType = "payments" | "bills";

interface PaymentRecord {
  id: string;
  transactionId: string;
  utr: string;
  amount: number;
  paymentMethod: string;
  accountDetails: string;
  status: PaymentStatus;
  paymentDate: string;
  requestId?: string;
  remarks?: string;
}

interface Bill {
  id: string;
  billNumber: string;
  description: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: BillStatus;
  paymentMethod?: string;
  invoiceUrl?: string;
}

/**
 * TODO: MOCK DATA - Replace with actual API call
 *
 * Endpoint: GET /api/payments/history
 * Method: GET
 * Headers: { Authorization: "Bearer <token>" }
 * Query Parameters (optional):
 *   - status: "all" | "successful" | "failed" | "pending"
 *   - period: "daily" | "weekly" | "monthly" | "all"
 *   - search: string
 *   - page: number
 *   - limit: number
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "payments": [
 *       {
 *         "id": "PH001",
 *         "transactionId": "TXN123456789",
 *         "utr": "UTR987654321",
 *         "amount": 5000.00,
 *         "paymentMethod": "Bank Transfer",
 *         "accountDetails": "****1234 - HDFC Bank",
 *         "status": "successful",
 *         "paymentDate": "2025-01-15 10:35:00",
 *         "requestId": "WR001",
 *         "remarks": null
 *       }
 *     ],
 *     "pagination": {
 *       "currentPage": 1,
 *       "totalPages": 2,
 *       "totalItems": 15,
 *       "itemsPerPage": 10
 *     },
 *     "summary": {
 *       "totalSuccessful": 25000.00,
 *       "totalPending": 9000.00,
 *       "totalFailed": 3000.00
 *     }
 *   }
 * }
 */
const mockPaymentRecords: PaymentRecord[] = [
  {
    id: "PH001",
    transactionId: "TXN123456789",
    utr: "UTR987654321",
    amount: 5000.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****1234 - HDFC Bank",
    status: "successful",
    paymentDate: "2025-01-15 10:35:00",
    requestId: "WR001",
  },
  {
    id: "PH002",
    transactionId: "TXN123456790",
    utr: "UTR987654322",
    amount: 3000.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@paytm",
    status: "successful",
    paymentDate: "2025-01-14 14:25:00",
    requestId: "WR002",
  },
  {
    id: "PH003",
    transactionId: "TXN123456791",
    utr: "Pending...",
    amount: 7500.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****5678 - SBI Bank",
    status: "pending",
    paymentDate: "2025-01-13 09:20:00",
    requestId: "WR003",
  },
  {
    id: "PH004",
    transactionId: "TXN123456792",
    utr: "N/A",
    amount: 2000.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@phonepe",
    status: "failed",
    paymentDate: "2025-01-12 11:05:00",
    requestId: "WR004",
    remarks: "Transaction failed due to insufficient balance",
  },
  {
    id: "PH005",
    transactionId: "TXN123456793",
    utr: "UTR987654323",
    amount: 4500.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****9012 - ICICI Bank",
    status: "successful",
    paymentDate: "2025-01-11 12:20:00",
    requestId: "WR005",
  },
  {
    id: "PH006",
    transactionId: "TXN123456794",
    utr: "Pending...",
    amount: 1500.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@googlepay",
    status: "pending",
    paymentDate: "2025-01-10 16:35:00",
    requestId: "WR006",
  },
  {
    id: "PH007",
    transactionId: "TXN123456795",
    utr: "UTR987654324",
    amount: 6000.0,
    paymentMethod: "Bank Transfer",
    accountDetails: "****3456 - Axis Bank",
    status: "successful",
    paymentDate: "2025-01-09 17:10:00",
    requestId: "WR007",
  },
  {
    id: "PH008",
    transactionId: "TXN123456796",
    utr: "UTR987654325",
    amount: 2500.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@paytm",
    status: "successful",
    paymentDate: "2025-01-08 10:05:00",
    requestId: "SWR001",
  },
  {
    id: "PH009",
    transactionId: "TXN123456797",
    utr: "UTR987654326",
    amount: 2000.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@phonepe",
    status: "successful",
    paymentDate: "2025-01-07 14:30:00",
    requestId: "SWR002",
  },
  {
    id: "PH010",
    transactionId: "TXN123456798",
    utr: "N/A",
    amount: 1000.0,
    paymentMethod: "UPI",
    accountDetails: "moin.shaikh@googlepay",
    status: "failed",
    paymentDate: "2025-01-06 11:10:00",
    requestId: "SWR004",
    remarks: "Payment gateway timeout",
  },
];

/**
 * TODO: MOCK DATA - Replace with actual API call
 *
 * Endpoint: GET /api/bills
 * Method: GET
 * Headers: { Authorization: "Bearer <token>" }
 * Query Parameters (optional):
 *   - period: "daily" | "weekly" | "monthly" | "all"
 *   - search: string
 *   - page: number
 *   - limit: number
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "bills": [
 *       {
 *         "id": "B001",
 *         "billNumber": "#00067",
 *         "description": "Offer Price Old Credit & Additional Courses Services",
 *         "amount": 5000.00,
 *         "dueDate": "2025-01-15",
 *         "paidDate": "2025-01-10",
 *         "status": "paid",
 *         "paymentMethod": "UPI",
 *         "invoiceUrl": "/api/invoices/B001"
 *       }
 *     ],
 *     "pagination": {
 *       "currentPage": 1,
 *       "totalPages": 1,
 *       "totalItems": 5,
 *       "itemsPerPage": 10
 *     },
 *     "summary": {
 *       "totalPaid": 15000.00,
 *       "totalPending": 7500.00,
 *       "totalOverdue": 5000.00
 *     }
 *   }
 * }
 */
const mockBills: Bill[] = [
  {
    id: "B001",
    billNumber: "#00067",
    description: "Offer Price Old Credit & Additional Courses Services",
    amount: 5000.0,
    dueDate: "2025-01-15",
    paidDate: "2025-01-10",
    status: "paid",
    paymentMethod: "UPI",
    invoiceUrl: "#",
  },
  {
    id: "B002",
    billNumber: "#00080",
    description: "Monthly Subscription - February 2025",
    amount: 5000.0,
    dueDate: "2025-02-15",
    status: "pending",
    invoiceUrl: "#",
  },
  {
    id: "B003",
    billNumber: "#01876",
    description: "Premium Package Upgrade",
    amount: 10000.0,
    dueDate: "2025-01-20",
    paidDate: "2025-01-18",
    status: "paid",
    paymentMethod: "Bank Transfer",
    invoiceUrl: "#",
  },
  {
    id: "B004",
    billNumber: "#00081",
    description: "Monthly Subscription - December 2024",
    amount: 5000.0,
    dueDate: "2024-12-15",
    status: "overdue",
    invoiceUrl: "#",
  },
  {
    id: "B005",
    billNumber: "#00082",
    description: "Additional Services",
    amount: 2500.0,
    dueDate: "2025-02-20",
    status: "pending",
    invoiceUrl: "#",
  },
];

export default function PaymentHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [showPayFirstModal, setShowPayFirstModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<
    PaymentRecord | Bill | null
  >(null);
  const [viewType, setViewType] = useState<ViewType>("payments");
  const user = useAppSelector((state) => state.auth.user);

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

  // Calculate statistics
  const totalSuccessful = useMemo(
    () =>
      mockPaymentRecords
        .filter((r) => r.status === "successful")
        .reduce((sum, r) => sum + r.amount, 0),
    [],
  );

  const totalPending = useMemo(
    () =>
      mockPaymentRecords
        .filter((r) => r.status === "pending")
        .reduce((sum, r) => sum + r.amount, 0),
    [],
  );

  const totalFailed = useMemo(
    () =>
      mockPaymentRecords
        .filter((r) => r.status === "failed")
        .reduce((sum, r) => sum + r.amount, 0),
    [],
  );

  const totalPayments = useMemo(() => mockPaymentRecords.length, []);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let filtered = mockPaymentRecords.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchesPeriod = filterByPeriod(item.paymentDate, periodFilter);
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.id.toLowerCase().includes(searchLower) ||
        item.transactionId.toLowerCase().includes(searchLower) ||
        item.utr.toLowerCase().includes(searchLower) ||
        item.paymentMethod.toLowerCase().includes(searchLower) ||
        item.accountDetails.toLowerCase().includes(searchLower) ||
        (item.requestId && item.requestId.toLowerCase().includes(searchLower));

      return matchesStatus && matchesPeriod && matchesSearch;
    });

    // Sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof PaymentRecord];
        let bValue: any = b[sortConfig.key as keyof PaymentRecord];

        if (sortConfig.key === "paymentDate") {
          aValue = new Date(aValue || 0).getTime();
          bValue = new Date(bValue || 0).getTime();
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [searchQuery, statusFilter, periodFilter, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
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
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "successful":
        return (
          <Badge
            tone="green"
            soft={false}
            className="uppercase text-xs font-bold"
          >
            Successful
          </Badge>
        );
      case "pending":
        return (
          <Badge
            tone="amber"
            soft={false}
            className="uppercase text-xs font-bold"
          >
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge
            tone="red"
            soft={false}
            className="uppercase text-xs font-bold"
          >
            Failed
          </Badge>
        );
    }
  };

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case "successful":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-amber-600" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const handleExportPDF = () => {
    // Get last one month data
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);

    const oneMonthData = filteredData.filter((item) => {
      const itemDate = new Date(item.paymentDate);
      return itemDate >= oneMonthAgo;
    });

    // Create PDF
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text("Payment History Report (Last 1 Month)", 14, 20);

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
      r.transactionId,
      r.utr,
      `₹${formatCurrency(r.amount)}`,
      r.paymentMethod,
      r.accountDetails,
      r.status.toUpperCase(),
      formatDate(r.paymentDate),
      r.requestId || "-",
    ]);

    // Add table
    (doc as any).autoTable({
      head: [
        [
          "Sr",
          "Transaction ID",
          "UTR",
          "Amount",
          "Payment Method",
          "Account Details",
          "Status",
          "Payment Date",
          "Request ID",
        ],
      ],
      body: tableData,
      startY: 50,
      styles: { fontSize: 7 },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 50 },
    });

    // Save PDF
    doc.save(`payment-history-${new Date().toISOString().split("T")[0]}.pdf`);
  };


  const handleViewInvoice = (item: PaymentRecord | Bill) => {
    if ("transactionId" in item) {
      // Payment Record - only show if successful
      const payment = item as PaymentRecord;
      if (payment.status === "successful") {
        setSelectedInvoice(payment);
      }
    } else {
      // Bill - show for all
      setSelectedInvoice(item);
    }
  };

  const getInvoiceData = (item: PaymentRecord | Bill) => {
    if ("transactionId" in item) {
      // Payment Record
      const payment = item as PaymentRecord;
      return {
        id: payment.id,
        billNumber: payment.transactionId,
        invoiceDate: payment.paymentDate,
        dueDate: payment.paymentDate,
        paidDate: payment.paymentDate,
        status: "paid" as const,
        items: [
          {
            description: `Payment for ${payment.requestId || "Transaction"}`,
            amount: payment.amount,
          },
        ],
        totalAmount: payment.amount,
        paymentMethod: payment.paymentMethod,
        utr:
          payment.utr !== "N/A" && payment.utr !== "Pending..."
            ? payment.utr
            : undefined,
        billedTo: {
          name: user?.name || "Secure Investment Academy",
          email: user?.email || "secureinvestmentacademyinfo@gmail.com",
          phone: "02269621972",
          address: "Sample, Maharashtra",
        },
        payTo: {
          name: "SECURE ACADEMY",
          address:
            "Barampuri, Nagpur Rd, Desaiganj Wadsa, Gadchiroli, Maharashtra, 441207",
          website: "mysecureacademy.in",
        },
      };
    } else {
      // Bill
      const bill = item as Bill;
      return {
        id: bill.id,
        billNumber: bill.billNumber,
        invoiceDate: bill.paidDate || bill.dueDate,
        dueDate: bill.dueDate,
        paidDate: bill.paidDate,
        status: bill.status,
        items: [
          {
            description:
              bill.description ||
              "Offer Price Old Credit & Additional Courses Services",
            amount: bill.amount,
          },
        ],
        totalAmount: bill.amount,
        paymentMethod: bill.paymentMethod,
        utr: bill.status === "paid" ? "UTR987654321" : undefined,
        billedTo: {
          name: user?.name || "Secure Investment Academy",
          email: user?.email || "secureinvestmentacademyinfo@gmail.com",
          phone: "02269621972",
          address: "Sample, Maharashtra",
        },
        payTo: {
          name: "SECURE ACADEMY",
          address:
            "Barampuri, Nagpur Rd, Desaiganj Wadsa, Gadchiroli, Maharashtra, 441207",
          website: "mysecureacademy.in",
        },
      };
    }
  };

  // Bill filtering and sorting
  const filterByPeriodForBills = (
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

  const filteredBills = useMemo(() => {
    let filtered = mockBills.filter((item) => {
      const matchesPeriod = filterByPeriodForBills(item.dueDate, periodFilter);
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
  }, [searchQuery, periodFilter, sortConfig]);

  const totalPaidBills = useMemo(
    () =>
      mockBills
        .filter((r) => r.status === "paid")
        .reduce((sum, r) => sum + r.amount, 0),
    [],
  );

  const totalPendingBills = useMemo(
    () =>
      mockBills
        .filter((r) => r.status === "pending")
        .reduce((sum, r) => sum + r.amount, 0),
    [],
  );

  const totalOverdueBills = useMemo(
    () =>
      mockBills
        .filter((r) => r.status === "overdue")
        .reduce((sum, r) => sum + r.amount, 0),
    [],
  );

  const getBillStatusBadge = (status: BillStatus) => {
    switch (status) {
      case "paid":
        return (
          <Badge
            tone="green"
            soft={false}
            className="uppercase text-xs font-bold"
          >
            Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge
            tone="amber"
            soft={false}
            className="uppercase text-xs font-bold"
          >
            Pending
          </Badge>
        );
      case "overdue":
        return (
          <Badge
            tone="red"
            soft={false}
            className="uppercase text-xs font-bold"
          >
            Overdue
          </Badge>
        );
    }
  };

  const formatDateForBills = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Pagination for bills
  const totalPagesBills = Math.ceil(filteredBills.length / itemsPerPage);
  const paginatedBills = filteredBills.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  return (
    <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7 bg-[var(--content-bg)] min-h-screen transition-colors duration-200">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <H1>Payment History</H1>
        <div className="flex gap-2 bg-[var(--sidebar-hover)] p-1 rounded-lg transition-colors duration-200">
          <button
            onClick={() => {
              setViewType("payments");
              setCurrentPage(1);
            }}
            className={[
              "px-4 py-2 rounded-md text-sm font-semibold transition-colors duration-200",
              viewType === "payments"
                ? "bg-[var(--card-bg)] text-blue-600 shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-strong)]",
            ].join(" ")}
          >
            Payments
          </button>
          <button
            onClick={() => {
              setViewType("bills");
              setCurrentPage(1);
            }}
            className={[
              "px-4 py-2 rounded-md text-sm font-semibold transition-colors duration-200",
              viewType === "bills"
                ? "bg-[var(--card-bg)] text-blue-600 shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-strong)]",
            ].join(" ")}
          >
            Bills
          </button>
        </div>
      </div>

      {/* Summary Statistics */}
      {viewType === "payments" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                    Total Successful
                  </p>
                  <p className="text-xl font-bold text-emerald-600">
                    ₹{formatCurrency(totalSuccessful)}
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50" />
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                    Total Pending
                  </p>
                  <p className="text-xl font-bold text-amber-600">
                    ₹{formatCurrency(totalPending)}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-amber-500 opacity-50" />
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                    Total Failed
                  </p>
                  <p className="text-xl font-bold text-red-600">
                    ₹{formatCurrency(totalFailed)}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                    Total Payments
                  </p>
                  <p className="text-xl font-bold text-[var(--text-strong)]">
                    {totalPayments}
                  </p>
                </div>
                <Banknote className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </Card>
          </div>

          {/* Filters and Controls */}
          <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border)] p-4 md:p-5 transition-colors duration-200">
              <div>
                <p className="text-xs md:text-[13px] text-[var(--text-muted)] font-semibold">
                  Track all your payment transactions and history
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="primary" size="md" onClick={handleExportPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_auto] gap-3 p-4 md:p-5 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  className="w-full pl-10 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-body)] px-4 py-3 text-sm md:text-[15px] shadow-sm min-h-[44px] transition-colors duration-200 focus:ring-blue-500 focus:ring-2"
                  placeholder="Search by Transaction ID, UTR, Payment Method, Account..."
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
                  { value: "all", label: "All" },
                  { value: "successful", label: "Successful" },
                  { value: "pending", label: "Pending" },
                  { value: "failed", label: "Failed" },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => {
                      setStatusFilter(filter.value as FilterStatus);
                      setCurrentPage(1);
                    }}
                    className={[
                      "px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition-colors min-h-[44px]",
                      statusFilter === filter.value
                        ? "bg-blue-600 text-white border border-blue-600"
                        : "bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--hover-bg)]",
                    ].join(" ")}
                  >
                    {filter.label}
                  </button>
                ))}
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
                        ? "bg-blue-600 text-white border border-blue-600"
                        : "bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--hover-bg)]",
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
            {paginatedData.length === 0 ? (
              <div className="p-12 text-center">
                <CreditCard className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4" />
                <p className="text-[var(--text-muted)] font-medium">
                  No payment records found matching your criteria.
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
                        <TH>Transaction ID</TH>
                        <TH>UTR</TH>
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
                        <TH>Payment Method</TH>
                        <TH>Account Details</TH>
                        <TH>Status</TH>
                        <TH
                          className="cursor-pointer select-none hover:bg-[var(--hover-bg)] transition-colors"
                          onClick={() => handleSort("paymentDate")}
                        >
                          <div className="flex items-center gap-1">
                            Payment Date
                            {sortConfig?.key === "paymentDate" && (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                          </div>
                        </TH>
                        <TH>Request ID</TH>
                        <TH>Actions</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {paginatedData.map((row, index) => (
                        <TR
                          key={row.id}
                          className="transition-all duration-200"
                        >
                          <TD className="whitespace-nowrap text-[var(--text-muted)]">
                            {startIndex + index + 1}
                          </TD>
                          <TD className="whitespace-nowrap font-medium text-blue-600">
                            {row.transactionId}
                          </TD>
                          <TD className="whitespace-nowrap text-[var(--text-muted)] text-sm font-mono">
                            {row.utr}
                          </TD>
                          <TD className="whitespace-nowrap font-semibold text-emerald-600">
                            ₹{formatCurrency(row.amount)}
                          </TD>
                          <TD className="whitespace-nowrap text-[var(--text-body)]">
                            {row.paymentMethod}
                          </TD>
                          <TD className="whitespace-nowrap text-[var(--text-muted)] text-sm">
                            {row.accountDetails}
                          </TD>
                          <TD className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(row.status)}
                              {getStatusBadge(row.status)}
                            </div>
                          </TD>
                          <TD className="whitespace-nowrap text-[var(--text-muted)] text-sm">
                            {formatDate(row.paymentDate)}
                          </TD>
                          <TD className="whitespace-nowrap text-[var(--text-muted)] text-sm">
                            {row.requestId ? (
                              <span className="text-purple-600 font-medium">
                                {row.requestId}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TD>
                          <TD className="whitespace-nowrap">
                            {row.status === "successful" ? (
                              <button
                                onClick={() => handleViewInvoice(row)}
                                className="p-1.5 rounded hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--hover-text)] transition-colors"
                                title="View Invoice"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            ) : (
                              <span className="text-[var(--text-muted)]">
                                -
                              </span>
                            )}
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
                      className={`p-4 border-l-4 rounded-lg hover:bg-[var(--hover-bg)] transition-colors duration-200 bg-[var(--card-bg)] border-[var(--border)] ${
                        row.status === "successful"
                          ? "border-l-emerald-500"
                          : row.status === "pending"
                            ? "border-l-amber-500"
                            : "border-l-red-500"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--text-muted)]">
                            Transaction ID
                          </span>
                          <span className="text-sm font-semibold text-blue-600">
                            {row.transactionId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(row.status)}
                          {getStatusBadge(row.status)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          Amount
                        </span>
                        <span className="text-lg font-bold text-emerald-600">
                          ₹{formatCurrency(row.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          UTR
                        </span>
                        <span className="text-xs text-[var(--text-muted)] font-mono">
                          {row.utr}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          Payment Method
                        </span>
                        <span className="text-sm text-[var(--text-body)]">
                          {row.paymentMethod}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          Account Details
                        </span>
                        <span className="text-sm text-[var(--text-muted)] break-words text-right">
                          {row.accountDetails}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          Payment Date
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatDate(row.paymentDate)}
                        </span>
                      </div>
                      {row.requestId && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-[var(--text-muted)]">
                            Request ID
                          </span>
                          <span className="text-xs text-purple-600 font-medium">
                            {row.requestId}
                          </span>
                        </div>
                      )}
                      {row.remarks && (
                        <div className="mt-2 pt-2 border-t border-[var(--border)]">
                          <span className="text-xs text-[var(--text-muted)]">
                            Remarks:{" "}
                          </span>
                          <span className="text-xs text-red-600">
                            {row.remarks}
                          </span>
                        </div>
                      )}
                      {row.status === "successful" && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                          <button
                            onClick={() => handleViewInvoice(row)}
                            className="flex-1 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-sm font-semibold flex items-center justify-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View Invoice
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 md:p-5 border-t border-[var(--border)] transition-colors duration-200">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-muted)]">
                        Items per page:
                      </span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-body)] px-3 py-1.5 text-sm transition-colors duration-200"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-muted)]">
                        Showing {startIndex + 1} to{" "}
                        {Math.min(
                          startIndex + itemsPerPage,
                          filteredData.length,
                        )}{" "}
                        of {filteredData.length} payments
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-[var(--card-bg)]"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-sm text-[var(--text-muted)]">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1),
                          )
                        }
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-[var(--card-bg)]"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </>
      ) : (
        <>
          {/* Bills Summary Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="p-4 border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                    Total Paid
                  </p>
                  <p className="text-xl font-bold text-emerald-600">
                    ₹{formatCurrency(totalPaidBills)}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-emerald-500 opacity-50" />
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                    Total Pending
                  </p>
                  <p className="text-xl font-bold text-amber-600">
                    ₹{formatCurrency(totalPendingBills)}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-amber-500 opacity-50" />
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">
                    Total Overdue
                  </p>
                  <p className="text-xl font-bold text-red-600">
                    ₹{formatCurrency(totalOverdueBills)}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </Card>
          </div>

          {/* Bills Filters and Controls */}
          <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border)] p-4 md:p-5">
              <div>
                <p className="text-xs md:text-[13px] text-[var(--text-muted)] font-semibold">
                  View and manage all your bills and invoices
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    const now = new Date();
                    const oneMonthAgo = new Date(now);
                    oneMonthAgo.setMonth(now.getMonth() - 1);

                    const oneMonthData = filteredBills.filter((item) => {
                      const itemDate = new Date(item.dueDate);
                      return itemDate >= oneMonthAgo;
                    });

                    const doc = new jsPDF();
                    doc.setFontSize(18);
                    doc.text("Bill View Report (Last 1 Month)", 14, 20);
                    doc.setFontSize(10);
                    doc.text(
                      `Generated on: ${new Date().toLocaleString("en-IN")}`,
                      14,
                      30,
                    );
                    doc.text(`Total Records: ${oneMonthData.length}`, 14, 36);
                    doc.text(
                      `Total Amount: ₹${formatCurrency(oneMonthData.reduce((sum, item) => sum + item.amount, 0))}`,
                      14,
                      42,
                    );

                    const tableData = oneMonthData.map((r, index) => [
                      index + 1,
                      r.billNumber,
                      r.description,
                      `₹${formatCurrency(r.amount)}`,
                      formatDateForBills(r.dueDate),
                      r.paidDate ? formatDateForBills(r.paidDate) : "-",
                      r.status.toUpperCase(),
                      r.paymentMethod || "-",
                    ]);

                    (doc as any).autoTable({
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
                    });

                    doc.save(
                      `bill-view-${new Date().toISOString().split("T")[0]}.pdf`,
                    );
                  }}
                >
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
                  className="w-full pl-10 rounded-lg border border-[var(--border)] px-4 py-3 text-sm md:text-[15px] shadow-sm min-h-[44px]"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-body)]"
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
                        ? "bg-blue-600 text-white border border-blue-600"
                        : "bg-white text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--sidebar-hover)]",
                    ].join(" ")}
                  >
                    <Calendar className="h-3 w-3" />
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Bills Table Card */}
          <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {paginatedBills.length === 0 ? (
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
                          className="cursor-pointer select-none hover:bg-[var(--sidebar-hover)] transition-colors"
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
                          className="cursor-pointer select-none hover:bg-[var(--sidebar-hover)] transition-colors"
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
                      {paginatedBills.map((row, index) => (
                        <TR
                          key={row.id}
                          className="hover:bg-[var(--sidebar-hover)] transition-all duration-200"
                        >
                          <TD className="whitespace-nowrap text-[var(--text-body)]">
                            {startIndex + index + 1}
                          </TD>
                          <TD className="whitespace-nowrap font-medium text-blue-600">
                            {row.billNumber}
                          </TD>
                          <TD className="text-[var(--text-body)]">
                            {row.description}
                          </TD>
                          <TD className="whitespace-nowrap font-semibold text-emerald-600">
                            ₹{formatCurrency(row.amount)}
                          </TD>
                          <TD className="whitespace-nowrap text-[var(--text-body)] text-sm">
                            {formatDateForBills(row.dueDate)}
                          </TD>
                          <TD className="whitespace-nowrap text-[var(--text-body)] text-sm">
                            {row.paidDate
                              ? formatDateForBills(row.paidDate)
                              : "-"}
                          </TD>
                          <TD className="whitespace-nowrap">
                            {getBillStatusBadge(row.status)}
                          </TD>
                          <TD className="whitespace-nowrap">
                            <button
                              onClick={() => handleViewInvoice(row)}
                              className="p-1.5 rounded hover:bg-[var(--sidebar-hover)] text-[var(--text-muted)] hover:text-[var(--hover-text)] transition-colors"
                              title="View Invoice"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </div>

                {/* Mobile/Tablet Card View */}
                <div className="lg:hidden mb-5 space-y-3">
                  {paginatedBills.map((row, index) => (
                    <div
                      key={row.id}
                      className={`p-4 border-l-4 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors duration-200 ${
                        row.status === "paid"
                          ? "border-l-emerald-500"
                          : row.status === "pending"
                            ? "border-l-amber-500"
                            : "border-l-red-500"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--text-muted)]">
                            Bill Number
                          </span>
                          <span className="text-sm font-semibold text-blue-600">
                            {row.billNumber}
                          </span>
                        </div>
                        {getBillStatusBadge(row.status)}
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
                        <span className="text-lg font-bold text-emerald-600">
                          ₹{formatCurrency(row.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          Due Date
                        </span>
                        <span className="text-xs text-[var(--text-body)]">
                          {formatDateForBills(row.dueDate)}
                        </span>
                      </div>
                      {row.paidDate && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-[var(--text-muted)]">
                            Paid Date
                          </span>
                          <span className="text-xs text-[var(--text-body)]">
                            {formatDateForBills(row.paidDate)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                        <button
                          onClick={() => handleViewInvoice(row)}
                          className="flex-1 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-sm font-semibold flex items-center justify-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View Invoice
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPagesBills > 1 && (
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
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
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
                        {Math.min(
                          startIndex + itemsPerPage,
                          filteredBills.length,
                        )}{" "}
                        of {filteredBills.length} bills
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--sidebar-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-sm text-[var(--text-body)]">
                        Page {currentPage} of {totalPagesBills}
                      </span>
                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPagesBills, prev + 1),
                          )
                        }
                        disabled={currentPage === totalPagesBills}
                        className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--sidebar-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </>
      )}

      {/* Pay First Modal */}
      <PayFirstModal
        isOpen={showPayFirstModal}
        onClose={() => setShowPayFirstModal(false)}
      />

      {/* Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-4xl">
            <div className="bg-white rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
              {/* Action Buttons - Top Right */}
              <div className="sticky top-0 bg-white border-b border-[var(--border)] p-4 flex justify-end gap-2 rounded-t-lg z-10 shadow-sm">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    // Create and download PDF
                    const invoiceData = getInvoiceData(selectedInvoice);
                    const doc = new jsPDF();
                    const pageWidth = doc.internal.pageSize.getWidth();
                    const margin = 14;
                    let yPos = margin;

                    // Logo and Header
                    doc.setFontSize(20);
                    doc.setTextColor(128, 0, 128);
                    doc.text("SECURE INVESTMENT ACADEMY", pageWidth / 2, yPos, {
                      align: "center",
                    });
                    yPos += 10;

                    // Invoice Title
                    doc.setFontSize(16);
                    doc.setTextColor(0, 0, 0);
                    doc.text("INVOICE", pageWidth / 2, yPos, {
                      align: "center",
                    });
                    yPos += 15;

                    // Invoice Number and Date
                    doc.setFontSize(10);
                    doc.text(
                      `Invoice #: ${invoiceData.billNumber}`,
                      margin,
                      yPos,
                    );
                    doc.text(
                      `Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
                      pageWidth - margin,
                      yPos,
                      { align: "right" },
                    );
                    yPos += 10;

                    // Billed To
                    doc.setFontSize(12);
                    doc.setFont("helvetica", "bold");
                    doc.text("Billed To:", margin, yPos);
                    yPos += 6;
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(10);
                    doc.text(invoiceData.billedTo.name, margin, yPos);
                    yPos += 5;
                    doc.text(invoiceData.billedTo.email, margin, yPos);
                    yPos += 5;
                    doc.text(invoiceData.billedTo.phone, margin, yPos);
                    yPos += 5;
                    doc.text(invoiceData.billedTo.address, margin, yPos);
                    yPos += 10;

                    // Pay To
                    doc.setFont("helvetica", "bold");
                    doc.text("Pay To:", pageWidth - margin, yPos, {
                      align: "right",
                    });
                    yPos += 6;
                    doc.setFont("helvetica", "normal");
                    doc.text(invoiceData.payTo.name, pageWidth - margin, yPos, {
                      align: "right",
                    });
                    yPos += 5;
                    doc.text(
                      invoiceData.payTo.address,
                      pageWidth - margin,
                      yPos,
                      { align: "right" },
                    );
                    yPos += 5;
                    doc.text(
                      invoiceData.payTo.website,
                      pageWidth - margin,
                      yPos,
                      { align: "right" },
                    );
                    yPos += 15;

                    // Items Table
                    const tableData = invoiceData.items.map((item, index) => [
                      index + 1,
                      item.description,
                      `₹${item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    ]);

                    (doc as any).autoTable({
                      head: [["Sr", "Description", "Amount"]],
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
                    });

                    yPos = (doc as any).lastAutoTable.finalY + 10;

                    // Total
                    doc.setFontSize(12);
                    doc.setFont("helvetica", "bold");
                    doc.text(
                      `Total Amount: ₹${invoiceData.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      pageWidth - margin,
                      yPos,
                      { align: "right" },
                    );
                    yPos += 5;
                    doc.setFontSize(9);
                    doc.setFont("helvetica", "normal");
                    doc.text(`(0% tax)`, pageWidth - margin, yPos, {
                      align: "right",
                    });
                    yPos += 10;

                    // Thank You Message
                    yPos += 15;
                    doc.setFontSize(10);
                    doc.text(
                      "Thank You For Your Interest in Our Business,",
                      pageWidth / 2,
                      yPos,
                      { align: "center" },
                    );
                    yPos += 5;
                    doc.text(
                      `We have Received Rs. ${invoiceData.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/- as credit from You.`,
                      pageWidth / 2,
                      yPos,
                      { align: "center" },
                    );
                    yPos += 5;
                    doc.text(
                      "You are getting additionally access to our course.",
                      pageWidth / 2,
                      yPos,
                      { align: "center" },
                    );

                    doc.save(`invoice-${invoiceData.billNumber}.pdf`);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
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
                <InvoiceTemplate
                  invoice={getInvoiceData(selectedInvoice)}
                  onClose={() => setSelectedInvoice(null)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
