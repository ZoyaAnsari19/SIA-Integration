"use client";

import { useState, useEffect } from "react";
import { H1, H3, Text } from "@/components/ui/Heading";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { BankDetailsCard } from "@/components/payment/BankDetailsCard";
import { FileUpload } from "@/components/ui/FileUpload";
import { Tabs } from "@/components/ui/Tabs";
import { Dialog } from "@/components/ui/Dialog";
import { Send, X, Loader2 } from "lucide-react";
import {
  getPackages,
  getMyPackages,
  uploadPaymentProof,
  submitManualDeposit,
  checkUtrExists,
  checkReinvestmentAmount,
} from "@/lib/api/packages";
import { getActiveCompanyBankAccount } from "@/lib/api/company-bank";
import { getCourseByPackageId } from "@/lib/api/courses";
import type { Package, PackagePurchase, CompanyBankAccount } from "@/lib/api/types";
import { useAppSelector } from "@/redux/hooks";

export default function PayNow() {
  const { user } = useAppSelector((state) => state.auth);
  const [tab, setTab] = useState<"gateway" | "manual">("manual");
  const [gatewayPackage, setGatewayPackage] = useState("");
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [isGatewaySubmitting, setIsGatewaySubmitting] = useState(false);

  // Gateway payment enabled for package purchase (ICICI)
  const isGatewayDisabled = false;
  const COURSE_APP_URL =
    process.env.NEXT_PUBLIC_COURSE_APP_URL || "https://app.secureinfiniteassociation.com";
  const [formData, setFormData] = useState({
    inactiveId: user?.display_id || user?.id || "",
    packageSelect: "",
    txnId: "",
    proofUpload: null as File | null,
    paymentType: "",
  });
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  
  // API States
  const [packages, setPackages] = useState<Package[]>([]);
  const [myPackages, setMyPackages] = useState<PackagePurchase[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [bankDetails, setBankDetails] = useState<CompanyBankAccount | null>(null);
  const [isLoadingBankDetails, setIsLoadingBankDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [utrError, setUtrError] = useState<string | null>(null);
  const [isCheckingUtr, setIsCheckingUtr] = useState(false);

  // Fetch packages and bank details on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingPackages(true);
      setIsLoadingBankDetails(true);
      setError(null);
      try {
        const [packagesData, myPackagesData, bankData] = await Promise.all([
          getPackages(),
          getMyPackages().catch(() => ({ count: 0, items: [] })), // Don't fail if packages fail
          getActiveCompanyBankAccount().catch(() => null), // Don't fail if bank details fail
        ]);
        
        // Filter only active packages
        const activePackages = packagesData.filter(pkg => pkg.status === 'active');
        setPackages(activePackages);
        setMyPackages(myPackagesData.items);
        
        if (bankData) {
          setBankDetails(bankData);
        }
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to load packages';
        setError(errorMessage);
        console.error('Failed to fetch data:', err);
      } finally {
        setIsLoadingPackages(false);
        setIsLoadingBankDetails(false);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (file: File | null) => {
    setFormData((prev) => ({ ...prev, proofUpload: file }));
  };

  const handleGatewayPayment = async () => {
    if (!gatewayPackage) {
      setError("Please select a package before proceeding to payment.");
      return;
    }

    const selectedPackage = packages.find(
      (pkg) => pkg.id.toString() === gatewayPackage,
    );

    if (!selectedPackage) {
      setError("Selected package not found. Please refresh and try again.");
      return;
    }

    setIsGatewaySubmitting(true);
    setError(null);

    try {
      const course = await getCourseByPackageId(selectedPackage.id);

      if (!course?.id) {
        setError("Selected package is not linked to any course. Please contact support.");
        setIsGatewaySubmitting(false);
        return;
      }

      const params = new URLSearchParams();
      params.set("course", course.id);

      if (myPackages.length > 0) {
        const hasActivePackage = myPackages.some((pkg) => pkg.is_active === true);
        const hasExpiredPackage = myPackages.some((pkg) => !pkg.is_active);

        if (hasActivePackage) {
          try {
            await checkReinvestmentAmount(Number(selectedPackage.price));
          } catch (err: any) {
            const errorMessage =
              err?.response?.data?.message || err?.message || "Reinvestment validation failed";
            setError(errorMessage);
            setShowGatewayModal(false);
            setIsGatewaySubmitting(false);
            return;
          }
          params.set("request_type", "reinvestment");
        } else if (hasExpiredPackage) {
          params.set("request_type", "renew");
        }
      }

      window.location.href = `${COURSE_APP_URL}/checkout?${params.toString()}`;
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || err?.message || "Gateway checkout failed";
      setError(errorMessage);
      setIsGatewaySubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.packageSelect || !formData.txnId || !formData.proofUpload || !formData.paymentType) {
      setError("Please fill all required fields");
      return;
    }

    // Validate UTR number before submitting
    if (formData.txnId.trim()) {
      setIsCheckingUtr(true);
      setUtrError(null);
      try {
        const utrCheck = await checkUtrExists(formData.txnId.trim());
        if (utrCheck.exists) {
          setUtrError(utrCheck.message);
          setIsCheckingUtr(false);
          return;
        }
      } catch (err: any) {
        console.error('UTR check error:', err);
        // Continue with submission if check fails (network error, etc.)
      } finally {
        setIsCheckingUtr(false);
      }
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setUtrError(null);

    try {
      // 1. Upload payment proof first
      const uploadResult = await uploadPaymentProof(formData.proofUpload);
      
      // 2. Find selected package by ID (dropdown stores package ID, not price)
      const selectedPackage = packages.find(
        pkg => pkg.id.toString() === formData.packageSelect
      );
      
      if (!selectedPackage) {
        throw new Error('Selected package not found');
      }

      // 3. Determine request type based on user's purchase history
      let requestType: 'activation' | 'renew' | 'reinvestment' = 'activation';
      
      if (myPackages.length > 0) {
        // Check if user has active packages (not expired, not 2x reached)
        const hasActivePackage = myPackages.some(
          pkg => pkg.is_active === true
        );
        
        // Check if user has expired packages (2x reached)
        // Note: API sets is_active=false when expired, status is always 'completed'
        const hasExpiredPackage = myPackages.some(
          pkg => !pkg.is_active
        );
        
        if (hasActivePackage) {
          // User has active purchase → reinvestment
          requestType = 'reinvestment';
        } else if (hasExpiredPackage) {
          // User has expired purchase → renew
          requestType = 'renew';
        }
        // else: all packages expired but no active → activation (first purchase after expiry)
      }
      // else: no packages → activation (first purchase)

      // 4. Submit manual deposit request
      const result = await submitManualDeposit({
        package_id: selectedPackage.id,
        request_type: requestType,
        amount: selectedPackage.price,
        utr_number: formData.txnId,
        payment_proof_url: uploadResult.url,
        payment_type: formData.paymentType,
        remarks: formData.inactiveId ? `Inactive ID: ${formData.inactiveId}` : undefined,
      });

      setSuccessMessage(
        result.message || 'Payment request submitted successfully! Admin will review and approve.',
      );
      
      // Reset form
      setFormData({
        inactiveId: user?.display_id || user?.id || "",
        packageSelect: "",
        txnId: "",
        proofUpload: null,
        paymentType: "",
      });
      setProofPreview(null);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to submit payment';
      setError(errorMessage);
      console.error('Manual deposit submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="max-w-[1300px] mx-auto animate-in fade-in duration-500 bg-[var(--content-bg)] min-h-screen p-4 md:p-6 transition-colors duration-200">
      <h1 className="text-[26px] font-bold text-[var(--text-strong)] mb-6">
        Select Payment Method & Enroll
      </h1>

      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as any)}
          items={[
            { value: "gateway", label: "Pay Gateway (Quick Enroll)" },
            { value: "manual", label: "Pay Manual (Bank/UPI Deposit)" },
          ]}
        />
      </div>

      {tab === "gateway" && (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 md:gap-6">
        <Card className="p-4 md:p-6 lg:p-7 text-center">
          <H3 className="mb-3 text-base md:text-lg">
            1. Select Course Package
          </H3>
          <div className="mx-auto mb-5 max-w-full md:max-w-[450px]">
            <select
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] px-4 py-3 text-sm md:text-[16px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition-colors"
              value={gatewayPackage}
              onChange={(e) => setGatewayPackage(e.target.value)}
            >
              <option value="">-- Select Package --</option>
              {isLoadingPackages ? (
                <option disabled>Loading packages...</option>
              ) : packages.length === 0 ? (
                <option disabled>No packages available</option>
              ) : (
                packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id.toString()}>
                    ₹{Number(pkg.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - {pkg.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <Text className="mt-4 md:mt-6 text-sm md:text-base">
            Click Pay Now to proceed to the secure payment gateway to complete
            the transaction instantly using UPI, Netbanking, or Card.
          </Text>
          <Button
            className="mt-4 md:mt-6 w-full sm:w-1/2 min-h-[44px]"
            onClick={() => setShowGatewayModal(true)}
            disabled={!gatewayPackage}
          >
            Pay Now
          </Button>
        </Card>

          {/* RIGHT COLUMN: Deposit Details */}
          <BankDetailsCard
            bankName={bankDetails?.bank_name}
            accountHolderName={bankDetails?.bank_ac_holder}
            accountNumber={bankDetails?.bank_ac_no}
            ifscCode={bankDetails?.bank_ifsc}
            branch={bankDetails?.bank_branch || undefined}
            upiId={bankDetails?.bank_upi || undefined}
            qrCodeUrl={bankDetails?.qr_image || undefined}
            minInvestment="₹2,500.00"
            onQRDownload={() => {
              if (bankDetails?.qr_image) {
                const link = document.createElement('a');
                link.href = bankDetails.qr_image;
                link.download = 'qr-code.png';
                link.click();
              } else {
                alert("QR code not available");
              }
            }}
          />
        </div>
      )}

      {tab === "manual" && (
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 md:gap-6">
            {/* LEFT COLUMN: Form */}
        <Card className="p-4 md:p-6 lg:p-7">
              <CardHeader>
                <CardTitle className="text-[20px] text-blue-600 dark:text-blue-400 border-b border-[var(--border)] pb-3 transition-colors duration-200">
                  Step 2: Submit Proof of Payment
                </CardTitle>
              </CardHeader>

              <div className="space-y-5 mt-5">
                <div>
                  <Input
                    label="Current ID"
                    type="text"
                    name="inactiveId"
                    value={formData.inactiveId}
                    readOnly
                    className="bg-[var(--sidebar-hover)] cursor-not-allowed"
                    placeholder="Your User ID"
                  />
            </div>

            <div>
                  <label className="block text-sm font-semibold text-[var(--text-body)] mb-2">
                    Select Package <span className="text-red-500">*</span>
              </label>
              <select
                    name="packageSelect"
                    value={formData.packageSelect}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-strong)] rounded-lg text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition-colors duration-200 hover:border-[var(--hover-border)]"
              >
                    <option value="" disabled>
                      -- Select Package --
                    </option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id.toString()}>
                        {pkg.name} - ₹{pkg.price}
                      </option>
                    ))}
              </select>
            </div>

            <div>
                  <Input
                    label="UTR No / TXN ID"
                type="text"
                    name="txnId"
                    value={formData.txnId}
                    onChange={(e) => {
                      handleInputChange(e);
                      setUtrError(null); // Clear error when user types
                    }}
                    placeholder="Enter Transaction number"
                    required
              />
              {isCheckingUtr && (
                <p className="text-sm text-blue-600 mt-1">Checking UTR number...</p>
              )}
              {utrError && (
                <p className="text-sm text-red-600 mt-1">{utrError}</p>
              )}
            </div>

                <FileUpload
                  label="Upload Payment Proof (Image)"
                  accept=".jpg,.png,.jpeg"
                  value={formData.proofUpload}
                  onChange={handleFileChange}
                  preview={proofPreview}
                  onPreviewChange={setProofPreview}
                  required
                  maxSize={5}
              />

            <div>
                  <label className="block text-sm font-semibold text-[var(--text-body)] mb-2">
                    Select Payment Type <span className="text-red-500">*</span>
              </label>
                  <select
                    name="paymentType"
                    value={formData.paymentType}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-body)] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] focus:border-transparent transition-colors duration-200 hover:border-[var(--hover-border)]"
                  >
                    <option value="" disabled>
                      --select here--
                    </option>
                    <option value="UPI">UPI</option>
                    <option value="BankTransfer">
                      Bank Transfer (NEFT/RTGS)
                    </option>
                  </select>
            </div>

            {successMessage && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            )}

            <Button
                  type="submit"
                  className="w-full min-h-[44px] h-12 text-base md:text-lg font-bold"
                  size="lg"
                  disabled={isSubmitting}
            >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Request Now
                    </>
                  )}
            </Button>
          </div>
        </Card>

            {/* RIGHT COLUMN: Deposit Details - use same API bank details as gateway tab */}
            <BankDetailsCard
              bankName={bankDetails?.bank_name}
              accountHolderName={bankDetails?.bank_ac_holder}
              accountNumber={bankDetails?.bank_ac_no}
              ifscCode={bankDetails?.bank_ifsc}
              branch={bankDetails?.bank_branch || undefined}
              upiId={bankDetails?.bank_upi || undefined}
              qrCodeUrl={bankDetails?.qr_image || undefined}
              minInvestment="₹2,500.00"
              onQRDownload={() => {
                if (bankDetails?.qr_image) {
                  const link = document.createElement('a');
                  link.href = bankDetails.qr_image;
                  link.download = 'qr-code.png';
                  link.click();
                } else {
                  alert("QR code not available");
                }
              }}
            />
          </div>
        </form>
      )}

      {/* Error modal - bada popup for submit/API errors (e.g. reinvestment rule) */}
      {error && (
        <Dialog
          isOpen={!!error}
          onClose={() => setError(null)}
          title="Request failed"
          size="lg"
        >
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-base text-red-700 dark:text-red-300 whitespace-pre-wrap">{error}</p>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setError(null)} variant="primary">
              OK
            </Button>
          </div>
        </Dialog>
      )}

      {/* Gateway Modal */}
      {showGatewayModal && !isGatewayDisabled && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setShowGatewayModal(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-[92%] sm:w-[560px] -translate-x-1/2 -translate-y-1/2">
            <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <div>
                  <H3 className="mb-0 text-[16px] md:text-[18px]">
                    Choose a payment option
                  </H3>
                  <Text className="text-[var(--text-muted)] text-sm">
                    Package:{" "}
                    {(() => {
                      const selected = packages.find(
                        (pkg) => pkg.id.toString() === gatewayPackage,
                      );
                      return selected
                        ? `${selected.name} — ₹${Number(selected.price).toLocaleString("en-IN")}`
                        : "— select package —";
                    })()}
                  </Text>
                </div>
                <button
                  className="rounded-full p-2 hover:bg-[var(--hover-bg)] transition-colors"
                  onClick={() => setShowGatewayModal(false)}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-5 pb-5 pt-4">
                <div className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--text-muted)] mb-4">
                  You&apos;ll be able to choose UPI, Card, NetBanking or Wallet on the
                  secure payment gateway screen. Click the button below to
                  continue to the bank&apos;s payment page.
                </div>
                <Button
                  className="min-h-[44px] w-full"
                  onClick={handleGatewayPayment}
                  disabled={isGatewaySubmitting || !gatewayPackage}
                >
                  {isGatewaySubmitting ? "Processing..." : "Pay via Gateway"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
