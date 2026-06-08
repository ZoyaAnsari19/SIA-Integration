"use client";

import { useState } from "react";
import { H1, H3 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BankDetailsCard } from "@/components/payment/BankDetailsCard";
import { Input } from "@/components/ui/Input";

export default function RenewPage() {
  const [expiredPackage, setExpiredPackage] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [utrTxnId, setUtrTxnId] = useState("");
  const [investOneTime, setInvestOneTime] = useState("YES");
  const [investOneTimeMultipleInvoice, setInvestOneTimeMultipleInvoice] =
    useState("YES");
  const [investOneTimeMultipleExpired, setInvestOneTimeMultipleExpired] =
    useState("YES");
  const [investOneTimeRenewedExpired, setInvestOneTimeRenewedExpired] =
    useState("YES");
  const [multipleInvestOneTime, setMultipleInvestOneTime] = useState("YES");
  const [multipleInvestedExpired, setMultipleInvestedExpired] = useState("YES");
  const [multipleInvestedRenewedExpired, setMultipleInvestedRenewedExpired] =
    useState("YES");
  const [clarification, setClarification] = useState("");

  const handleSubmit = () => {
    // TODO: Implement API call for renewal request
    if (process.env.NODE_ENV === 'development') {
      console.log({
        expiredPackage,
        selectedPackage,
        utrTxnId,
        investOneTime,
        investOneTimeMultipleInvoice,
      investOneTimeMultipleExpired,
      investOneTimeRenewedExpired,
      multipleInvestOneTime,
      multipleInvestedExpired,
      multipleInvestedRenewedExpired,
      clarification,
      });
    }
    alert("Renewal request submitted successfully!");
  };

  return (
    <div className="max-w-[900px] mx-auto my-5 md:my-10 px-4 md:px-5">
      <H1 className="mb-6">Manual Renewal</H1>

      {/* Deposit Account Details */}
      <div className="mb-6">
        <BankDetailsCard
          bankName="Bank Of India"
          accountHolderName="Secure Investment Academy"
          accountNumber="964720110000600"
          ifscCode="BKID0009647"
          branch="Wadsa"
          upiId="secureinvestmentacademyinfo@okaxis"
          minInvestment="15000.00"
          showQRCode={false}
        />
      </div>

      {/* Renewal Form */}
      <Card className="p-4 md:p-6 lg:p-7">
        <H3 className="mb-4 text-blue-600 dark:text-blue-400">
          Renewal Form
        </H3>

        <div className="grid gap-4 md:gap-5">
          {/* Select expired package */}
          <div>
            <label className="mb-2 block text-sm md:text-[14px] font-semibold text-[var(--text-strong)]">
              Select expired package
            </label>
            <select
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              value={expiredPackage}
              onChange={(e) => setExpiredPackage(e.target.value)}
            >
              <option value="">-- Select Expired Package --</option>
              <option value="15000.00">
                Offer Price Old Credit & Additional Courses Services [15000.00]
              </option>
              <option value="25000.00">
                Premium Package Old Credit & Additional Courses Services
                [25000.00]
              </option>
              <option value="50000.00">
                Advanced Package Old Credit & Additional Courses Services
                [50000.00]
              </option>
            </select>
          </div>

          {/* Select Package */}
          <div>
            <label className="mb-2 block text-sm md:text-[14px] font-semibold text-[var(--text-strong)]">
              Select Package
            </label>
            <select
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              value={selectedPackage}
              onChange={(e) => setSelectedPackage(e.target.value)}
            >
              <option value="">-- Select Package --</option>
              <option value="15000.00">
                15000.00 - Intermediate Credit + Free III Digital & Courses
              </option>
              <option value="25000.00">
                25000.00 - Advanced Credit + Premium Digital & Courses
              </option>
              <option value="50000.00">
                50000.00 - Professional Credit + Elite Digital & Courses
              </option>
            </select>
          </div>

          {/* UTR No. / TXN ID */}
          <div>
            <Input
              label="UTR No. / TXN ID"
              type="text"
              placeholder="Transaction number"
              value={utrTxnId}
              onChange={(e) => setUtrTxnId(e.target.value)}
              required
            />
          </div>

          {/* Investment Questions */}
          <div className="grid gap-4 md:gap-5 mt-2">
            <div>
              <label className="mb-2 block text-sm md:text-[14px] font-semibold text-[var(--text-strong)]">
                Invest one time?
              </label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                value={investOneTime}
                onChange={(e) => setInvestOneTime(e.target.value)}
              >
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm md:text-[14px] font-semibold text-[var(--text-strong)]">
                Invest one time but multiple invoice generated.
              </label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                value={investOneTimeMultipleInvoice}
                onChange={(e) =>
                  setInvestOneTimeMultipleInvoice(e.target.value)
                }
              >
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm md:text-[14px] font-semibold text-[var(--text-strong)]">
                Invest one time but multiple invoice expired.
              </label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                value={investOneTimeMultipleExpired}
                onChange={(e) =>
                  setInvestOneTimeMultipleExpired(e.target.value)
                }
              >
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm md:text-[14px] font-semibold text-[var(--text-strong)]">
                Invest one time and renewed, but invoice expired.
              </label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                value={investOneTimeRenewedExpired}
                onChange={(e) =>
                  setInvestOneTimeRenewedExpired(e.target.value)
                }
              >
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm md:text-[14px] font-semibold text-[var(--text-strong)]">
                Multiple invest one time?
              </label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                value={multipleInvestOneTime}
                onChange={(e) => setMultipleInvestOneTime(e.target.value)}
              >
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm md:text-[14px] font-semibold text-[var(--text-strong)]">
                Multiple invested, but expired all invoice.
              </label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                value={multipleInvestedExpired}
                onChange={(e) => setMultipleInvestedExpired(e.target.value)}
              >
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm md:text-[14px] font-semibold text-[var(--text-strong)]">
                Multiple invested and renewed. But, invoice expired.
              </label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                value={multipleInvestedRenewedExpired}
                onChange={(e) =>
                  setMultipleInvestedRenewedExpired(e.target.value)
                }
              >
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </div>
          </div>

          {/* Clarification */}
          <div>
            <label className="mb-2 block text-sm md:text-[14px] font-semibold text-[var(--text-strong)]">
              Clarification
            </label>
            <textarea
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-y"
              placeholder="Clarification"
              value={clarification}
              onChange={(e) => setClarification(e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <Button
            className="mt-2 min-h-[44px] w-full"
            onClick={handleSubmit}
            variant="primary"
            size="lg"
          >
            Request Now
          </Button>
        </div>
      </Card>
    </div>
  );
}

