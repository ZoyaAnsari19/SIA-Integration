"use client";

import React from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Copy, Download } from "lucide-react";

type BankDetailsCardProps = {
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
  upiId?: string;
  showQRCode?: boolean;
  qrCodeUrl?: string;
  onQRDownload?: () => void;
  onUPICopy?: (upiId: string) => void;
  minInvestment?: string;
  className?: string;
};

export function BankDetailsCard({
  bankName = "Bank Of India",
  accountHolderName = "Secure Investment Academy",
  accountNumber = "964720110000630",
  ifscCode = "BKID0009647",
  branch = "Wadsa",
  upiId = "secureinvestmentacademyinfo@bkofindcbank",
  showQRCode = true,
  qrCodeUrl,
  onQRDownload,
  onUPICopy,
  minInvestment,
  className = "",
}: BankDetailsCardProps) {
  const [upiCopied, setUpiCopied] = React.useState(false);

  const handleCopyUPI = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setUpiCopied(true);
      setTimeout(() => setUpiCopied(false), 2000);
      if (onUPICopy) onUPICopy(upiId);
    } catch (err) {
      // Fallback for older browsers
      const tempInput = document.createElement("textarea");
      tempInput.value = upiId;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      document.body.removeChild(tempInput);
      setUpiCopied(true);
      setTimeout(() => setUpiCopied(false), 2000);
    }
  };

  const handleQRDownload = () => {
    if (onQRDownload) {
      onQRDownload();
    } else {
      alert("Downloading QR...");
    }
  };

  const upiIdDisplay =
    upiId.length > 30 ? `${upiId.substring(0, 30)}...` : upiId;

  return (
    <Card
      className={`p-4 md:p-6 lg:p-7 bg-[var(--sidebar-hover)] border-dashed border-blue-600 transition-colors duration-200 ${className}`}
    >
      <CardHeader>
        <CardTitle className="text-base text-[var(--text-strong)] border-b border-[var(--border)] pb-3 transition-colors duration-200">
          Deposit Account Details
        </CardTitle>
      </CardHeader>

      <div className="space-y-3 mt-5">
        {bankName && (
          <div className="flex justify-between items-center py-1">
            <span className="text-sm text-[var(--text-muted)] font-medium">
              Bank Name:
            </span>
            <span className="text-[15px] font-bold text-[var(--text-strong)]">
              {bankName}
            </span>
          </div>
        )}

        {accountHolderName && (
          <div className="flex justify-between items-center py-1">
            <span className="text-sm text-[var(--text-muted)] font-medium">
              Ac Holder Name:
            </span>
            <span className="text-[15px] font-bold text-[var(--text-strong)] break-words text-right">
              {accountHolderName}
            </span>
          </div>
        )}

        {accountNumber && (
          <div className="flex justify-between items-center py-1">
            <span className="text-sm text-[var(--text-muted)] font-medium">
              Ac No:
            </span>
            <span className="text-[15px] font-bold text-[var(--text-strong)] break-all text-right">
              {accountNumber}
            </span>
          </div>
        )}

        {ifscCode && (
          <div className="flex justify-between items-center py-1">
            <span className="text-sm text-[var(--text-muted)] font-medium">
              IFSC Code:
            </span>
            <span className="text-[15px] font-bold text-[var(--text-strong)]">
              {ifscCode}
            </span>
          </div>
        )}

        {branch && (
          <div className="flex justify-between items-center py-1">
            <span className="text-sm text-[var(--text-muted)] font-medium">
              Branch:
            </span>
            <span className="text-[15px] font-bold text-[var(--text-strong)]">
              {branch}
            </span>
          </div>
        )}
      </div>

      {upiId && (
        <div className="mt-5 pt-5 border-t border-[var(--border)] transition-colors duration-200">
          <div className="flex justify-between items-center gap-3">
            <span className="text-sm font-semibold text-blue-600 break-all flex-1">
              {upiIdDisplay}
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={handleCopyUPI}
              className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-0 px-3 py-2 h-auto whitespace-nowrap min-h-[44px]"
            >
              {upiCopied ? (
                <>
                  <span className="text-green-600 mr-1">✓</span> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {showQRCode && (
        <div className="mt-6 text-center">
          <div className="w-[120px] h-[120px] bg-[var(--hover-bg)] mx-auto mb-3 rounded-lg flex items-center justify-center text-sm text-[var(--text-muted)] border border-[var(--border)] transition-colors duration-200">
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="w-full h-full object-contain rounded-lg"
              />
            ) : (
              "[QR Code]"
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleQRDownload}
            className="min-h-[44px]"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Download QR
          </Button>
        </div>
      )}

      {minInvestment && (
        <div className="mt-5 pt-4 border-t border-[var(--border)] transition-colors duration-200">
          <div className="text-lg font-bold text-red-600 text-center">
            Min. Investment: {minInvestment}
          </div>
        </div>
      )}
    </Card>
  );
}

export default BankDetailsCard;
