"use client";

import { CreditCard, AlertCircle, X } from "lucide-react";
import Button from "@/components/ui/Button";

interface PayFirstModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToPayment?: () => void;
  title?: string;
  message?: string;
}

export function PayFirstModal({
  isOpen,
  onClose,
  onGoToPayment,
  title = "Payment Required",
  message = "Please complete your payment first to access this feature.",
}: PayFirstModalProps) {
  if (!isOpen) return null;

  const handleGoToPayment = () => {
    onClose();
    if (onGoToPayment) {
      onGoToPayment();
    } else {
      window.location.href = "/pay-now";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 md:p-8 animate-in zoom-in-95 duration-200 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 transition-colors p-1"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-amber-100 rounded-full">
            <AlertCircle className="h-8 w-8 text-amber-600" />
          </div>
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-zinc-900 text-center mb-2">
          {title}
        </h3>
        <p className="text-sm md:text-base text-zinc-600 text-center mb-6">
          {message}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1 min-h-[44px]"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button className="flex-1 min-h-[44px]" onClick={handleGoToPayment}>
            <CreditCard className="h-4 w-4 mr-2" />
            Go to Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
