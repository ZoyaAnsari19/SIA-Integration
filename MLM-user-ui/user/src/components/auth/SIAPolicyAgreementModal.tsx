"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import { FileText } from "lucide-react";

const SIA_POLICY_TEXT = `1. Nature of Business & Platform Use
Welcome to the Secure Infinite Association platform. By accessing this software, you acknowledge that this platform is strictly designed for direct selling, e-commerce, and the management of product purchases (including FMCG, Pharma, and Agro products). This platform is NOT an investment portal, financial scheme, or a public deposit collection system.

2. No Guaranteed Returns or "ROI"
The company strictly prohibits and does not offer any fixed monthly returns, interest payouts, or "money doubling" schemes. Any commissions, incentives, or bonuses displayed in this software are strictly generated through the active sales of company products and are subject to the official compensation plan, including all applicable system caps and limits.

3. Product Purchase Acknowledgement
Any funds transferred to the company are exclusively for the purchase of products, goods, or services, or as a standard business advance for such purchases. You confirm that you are not depositing funds as a loan or financial investment.

4. Prohibition of Misrepresentation
Independent distributors, leaders, and users are strictly forbidden from misrepresenting the company’s business model. Promoting the company's product packages as "investments" or promising guaranteed financial returns to third parties is a direct violation of company policy and will result in immediate termination of the user account and potential legal action.

5. Risk & Liability
Success in this business depends entirely on individual effort, sales volume, and market conditions. The company holds no liability for any unauthorized financial promises made by independent agents or third parties outside of the official, published company materials.

6. Jurisdiction
By continuing to use this software, you agree to these terms. All legal disputes shall be subject to the exclusive jurisdiction of the competent courts in Desaiganj.

"Empowering India through Innovation & Integrity."`;

interface SIAPolicyAgreementModalProps {
  isOpen: boolean;
  onAgree: () => void;
}

/**
 * Modal shown after login requiring the user to read and agree to the SIA
 * Business Partnership Contribution policy before proceeding. Non-dismissible.
 */
export function SIAPolicyAgreementModal({ isOpen, onAgree }: SIAPolicyAgreementModalProps) {
  const [hasAgreed, setHasAgreed] = useState(false);

  if (!isOpen) return null;

  const handleAgree = () => {
    if (!hasAgreed) return;
    setHasAgreed(false);
    onAgree();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - no close button, policy is mandatory */}
        <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-xl">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 id="policy-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Software End-User Agreement &amp; Legal Disclaimer
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Please read and accept to continue
            </p>
          </div>
        </div>

        {/* Scrollable policy text */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="p-4 bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {SIA_POLICY_TEXT}
            </p>
          </div>
        </div>

        {/* Agreement section */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(e) => setHasAgreed(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-2 focus:ring-purple-500 cursor-pointer accent-purple-600"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              I have read and agree to the above Software End-User Agreement &amp; Legal Disclaimer. I understand that this platform is not an investment or deposit scheme, that any earnings are purely sales and performance based, and that no fixed or guaranteed returns are promised by the company.
            </span>
          </label>

          <Button
            onClick={handleAgree}
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!hasAgreed}
          >
            I Agree & Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
