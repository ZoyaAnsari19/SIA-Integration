"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { H1 } from "@/components/ui/Heading";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Edit, Camera, Upload, X, Copy, Share2, Link2, Loader2, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import {
  getUserProfile,
  getKYCStatus,
  uploadKYCDocument,
  submitKYC,
  isKYCSubmissionAllowed,
  updateProfile,
  uploadProfilePhoto,
  sendNameChangeOTP,
  verifyNameChangeOTP,
  checkAccountNumberExists,
  type UserProfileResponse,
  type KYCStatusResponse,
} from "@/lib/api/kyc";
import { getProfileUpdateFee, getNameChangeFee } from "@/lib/api/fees";
import { getUserFriendlyError } from "@/lib/api/errors";
import { FileUpload } from "@/components/ui/FileUpload";

type SectionType = "personal" | "address" | "bank" | null;

export default function Profile() {
  const user = useAppSelector((state) => state.auth.user);
  const [openSection, setOpenSection] = useState<SectionType>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(() => {
    if (typeof window !== "undefined" && user?.id) {
      const stored = localStorage.getItem(`profilePhoto_${user.id}`);
      if (stored) return stored;
    }
    return "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&h=200&fit=crop&crop=faces";
  });
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [referralLinkCopied, setReferralLinkCopied] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);

  // Generate referral link based on user display ID
  const referralLink = `https://app.secureinfiniteassociation.com/register?ref=${user?.display_id || user?.id || "SIA00057"}`;

  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setReferralLinkCopied(true);
      setTimeout(() => setReferralLinkCopied(false), 2000);
    } catch (err) {
      alert("Failed to copy referral link");
    }
  };

  const shareReferralLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Secure Infinite Association",
          text: "Join using my referral link",
          url: referralLink,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      copyReferralLink();
    }
  };
  const [formData, setFormData] = useState({
    personal: {
      name: "",
      mobile: "",
      email: "",
    },
    address: {
      address: "",
      city: "",
      district: "",
      state: "",
      zipCode: "",
    },
    bank: {
      accountHolderName: "",
      accountNumber: "",
      bankName: "",
      branch: "",
      ifscCode: "",
      upiId: "",
      nomineeContact: "",
      nomineeName: "",
      nomineeRelation: "",
    },
  });
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [kycStatus, setKycStatus] = useState<KYCStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileUpdateFee, setProfileUpdateFee] = useState<number>(0);
  const [nameChangeFee, setNameChangeFee] = useState<number>(0);
  const [accountNumberError, setAccountNumberError] = useState<string | null>(null);
  const [isCheckingAccountNumber, setIsCheckingAccountNumber] = useState(false);
  
  // KYC Submission State
  const [isKYCModalOpen, setIsKYCModalOpen] = useState(false);
  const [aadharFront, setAadharFront] = useState<{
    file: File | null;
    image_url: string;
  }>({ file: null, image_url: '' });
  const [aadharBack, setAadharBack] = useState<{
    file: File | null;
    image_url: string;
  }>({ file: null, image_url: '' });
  const [panFront, setPanFront] = useState<{
    file: File | null;
    image_url: string;
  }>({ file: null, image_url: '' });
  const [bankDocument, setBankDocument] = useState<{
    type: 'cheque' | 'passbook';
    file: File | null;
    image_url: string;
  }>({ type: 'cheque', file: null, image_url: '' });
  const [kycFormData, setKycFormData] = useState({
    phone: "",
    date_of_birth: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    pan_number: "",
    aadhar_number: "",
    bank_account_no: "",
    bank_ifsc: "",
    bank_name: "",
    bank_branch: "",
    bank_ac_holder: "",
    bank_upi: "",
  });
  const [isSubmittingKYC, setIsSubmittingKYC] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState<string | null>(null);
  const [uploadingStatus, setUploadingStatus] = useState<Record<string, boolean>>({});
  const [originalName, setOriginalName] = useState<string>("");
  
  // Name Change OTP State
  const [nameChangeOtpSent, setNameChangeOtpSent] = useState(false);
  const [nameChangeOtpVerified, setNameChangeOtpVerified] = useState(false);
  const [nameChangeOtp, setNameChangeOtp] = useState("");
  const [nameChangeVerificationToken, setNameChangeVerificationToken] = useState<string | null>(null);
  const [nameChangeOtpTimer, setNameChangeOtpTimer] = useState(0);
  const [isSendingNameChangeOtp, setIsSendingNameChangeOtp] = useState(false);
  const [isVerifyingNameChangeOtp, setIsVerifyingNameChangeOtp] = useState(false);
  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const profile = await getUserProfile(); // Use /profile endpoint for current user
        setProfileData(profile);
        
        // Fetch KYC status with documents after profile is loaded
        const status = await getKYCStatus(profile?.id || profile?.user_id).catch(() => null);
        if (status) setKycStatus(status);
        
        // Fetch profile update fee
        try {
          const fee = await getProfileUpdateFee();
          console.log('Profile update fee fetched:', fee);
          setProfileUpdateFee(fee);
        } catch (err) {
          console.error('Error fetching profile update fee:', err);
          setProfileUpdateFee(0);
        }
        
        // Fetch name change fee
        try {
          const nameFee = await getNameChangeFee();
          console.log('Name change fee fetched:', nameFee);
          setNameChangeFee(nameFee);
        } catch (err) {
          console.error('Error fetching name change fee:', err);
          setNameChangeFee(0);
        }
        
        // Update profile photo from API if available
        if (profile.profile?.profile_photo_url) {
          const photoUrl = profile.profile.profile_photo_url;
          setProfilePhoto(photoUrl);
          if (typeof window !== "undefined" && user?.id) {
            localStorage.setItem(`profilePhoto_${user.id}`, photoUrl);
          }
        }
        
        // Update form data from API response
        // API returns phone at root level or in profile.phone, email at root level
        const mobile = profile.phone || profile.profile?.phone || "";
        const email = profile.email || "";
        const name = profile.name || user?.name || "";
        
        setFormData(prev => ({
          ...prev,
          personal: {
            name: name,
            mobile: mobile,
            email: email,
          },
        }));
        setKycFormData(prev => ({
          ...prev,
          phone: mobile,
        }));
        // Update address data from API response
        // API returns address fields in profile object (flat structure)
        if (profile.profile) {
          setFormData(prev => ({
            ...prev,
            address: {
              address: profile.profile?.address || "",
              city: profile.profile?.city || "",
              district: "", // API doesn't return district separately
              state: profile.profile?.state || "",
              zipCode: profile.profile?.pincode || "", // API returns pincode, not zipCode
            },
          }));
          setKycFormData(prev => ({
            ...prev,
            address: profile.profile?.address || "",
            city: profile.profile?.city || "",
            state: profile.profile?.state || "",
            pincode: profile.profile?.pincode || "",
            // Pre-fill document numbers and date_of_birth from previous KYC submission
            pan_number: profile.profile?.pan_number || "",
            aadhar_number: profile.profile?.aadhar_number || "",
            date_of_birth: profile.profile?.date_of_birth || "",
          }));
          
          // Update bank data from API response
          // API returns bank fields in profile object (flat structure)
          const profileData = profile.profile as any; // Type assertion for fields not in type definition
          setFormData(prev => ({
            ...prev,
            bank: {
              accountHolderName: profileData?.bank_ac_holder || "",
              accountNumber: profileData?.bank_account_no || "",
              bankName: profileData?.bank_name || "",
              branch: profileData?.bank_branch || "",
              ifscCode: profileData?.bank_ifsc || "",
              upiId: profileData?.bank_upi || "",
              nomineeContact: profileData?.nominee_contact || "",
              nomineeName: profileData?.nominee_name || "",
              nomineeRelation: profileData?.nominee_relation || "",
            },
          }));
          setKycFormData(prev => ({
            ...prev,
            bank_account_no: profile.profile?.bank_account_no || "",
            bank_ifsc: profile.profile?.bank_ifsc || "",
            bank_name: profile.profile?.bank_name || "",
            bank_branch: profile.profile?.bank_branch || "",
            bank_ac_holder: profile.profile?.bank_ac_holder || "",
            bank_upi: profile.profile?.bank_upi || "",
          }));
        }
      } catch (err: any) {
        const errorMessage = err?.userMessage || getUserFriendlyError(err) || "Failed to load profile";
        setError(errorMessage);
        console.error('Profile fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

  // Pre-fill KYC form when modal opens, especially after rejection
  useEffect(() => {
    if (isKYCModalOpen && profileData?.profile) {
      // Pre-fill all KYC form fields from profile data
      setKycFormData(prev => ({
        ...prev,
        phone: profileData.phone || profileData.profile?.phone || "",
        date_of_birth: profileData.profile?.date_of_birth || "",
        address: profileData.profile?.address || "",
        city: profileData.profile?.city || "",
        state: profileData.profile?.state || "",
        pincode: profileData.profile?.pincode || "",
        pan_number: profileData.profile?.pan_number || "",
        aadhar_number: profileData.profile?.aadhar_number || "",
        bank_account_no: profileData.profile?.bank_account_no || "",
        bank_ifsc: profileData.profile?.bank_ifsc || "",
        bank_name: profileData.profile?.bank_name || "",
        bank_branch: profileData.profile?.bank_branch || "",
        bank_ac_holder: profileData.profile?.bank_ac_holder || "",
        bank_upi: profileData.profile?.bank_upi || "",
      }));
    }
  }, [isKYCModalOpen, profileData]);

  // Store original name when Personal Information modal opens (only once when modal opens)
  useEffect(() => {
    if (openSection === "personal") {
      // Get the current name from profileData or user, not from formData (which might be edited)
      const currentName = profileData?.name || user?.name || "";
      setOriginalName(currentName);
    } else {
      // Reset when modal closes
      setOriginalName("");
      setNameChangeOtpSent(false);
      setNameChangeOtpVerified(false);
      setNameChangeOtp("");
      setNameChangeVerificationToken(null);
      setNameChangeOtpTimer(0);
    }
  }, [openSection, profileData?.name, user?.name]);

  // Name Change OTP Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (nameChangeOtpSent && !nameChangeOtpVerified && nameChangeOtpTimer > 0) {
      interval = setInterval(() => {
        setNameChangeOtpTimer((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (nameChangeOtpTimer === 0 && nameChangeOtpSent && !nameChangeOtpVerified) {
      // Timer expired
      setNameChangeOtpSent(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [nameChangeOtpSent, nameChangeOtpVerified, nameChangeOtpTimer]);

  // Handle Send Name Change OTP
  const handleSendNameChangeOTP = async () => {
    const mobile = formData.personal?.mobile || profileData?.phone || "";
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    setIsSendingNameChangeOtp(true);
    try {
      await sendNameChangeOTP(mobile);
      setNameChangeOtpSent(true);
      setNameChangeOtpTimer(600); // 10 minutes = 600 seconds
      setNameChangeOtp(""); // Clear previous OTP
      alert('OTP sent to your mobile number. Valid for 10 minutes.');
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to send OTP. Please try again.';
      alert(errorMsg);
    } finally {
      setIsSendingNameChangeOtp(false);
    }
  };

  // Handle Verify Name Change OTP
  const handleVerifyNameChangeOTP = async () => {
    if (!nameChangeOtp || !/^\d{6}$/.test(nameChangeOtp)) {
      alert('OTP must be 6 digits');
      return;
    }

    const mobile = formData.personal?.mobile || profileData?.phone || "";
    if (!mobile) {
      alert('Mobile number is required');
      return;
    }

    setIsVerifyingNameChangeOtp(true);
    try {
      const result = await verifyNameChangeOTP(mobile, nameChangeOtp);
      if (result.success && result.verificationToken) {
        setNameChangeOtpVerified(true);
        setNameChangeVerificationToken(result.verificationToken);
        setNameChangeOtpTimer(0); // Stop timer
        alert('OTP verified successfully! You can now update your name.');
      } else {
        alert('Invalid OTP. Please try again.');
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Invalid OTP. Please try again.';
      alert(errorMsg);
    } finally {
      setIsVerifyingNameChangeOtp(false);
    }
  };

  const handleSave = async (section: SectionType) => {
    try {
      if (section === 'personal') {
        // Check if name is being changed
        const isNameChanged = formData.personal?.name && originalName && 
          formData.personal.name.trim() !== originalName.trim();
        
        // If name is being changed, require OTP verification
        if (isNameChanged) {
          // Check if OTP is verified
          if (!nameChangeOtpVerified || !nameChangeVerificationToken) {
            alert('Please verify OTP before updating your name. Click "Send OTP" button first.');
            return;
          }

          // Show confirmation if name is being changed and fee applies
          if (nameChangeFee > 0) {
            const confirmMessage = `Aap apna name "${originalName}" se "${formData.personal.name}" me change kar rahe hain.\n\nName change fee: ₹${nameChangeFee.toFixed(2)}\nYe amount aapke wallet se deduct ho jayega aur refund nahi hogi.\n\nKya aap sure hain?`;
            if (!window.confirm(confirmMessage)) {
              return; // User cancelled
            }
          }
        }
        
        const updateData: { name?: string; email?: string; phone?: string; name_change_verification_token?: string } = {};
        
        // Get name from formData
        if (formData.personal?.name) {
          updateData.name = formData.personal.name;
          // Add verification token if name is being changed
          if (isNameChanged && nameChangeVerificationToken) {
            updateData.name_change_verification_token = nameChangeVerificationToken;
          }
        }
        // Get email from formData
        if (formData.personal?.email) {
          updateData.email = formData.personal.email;
        }
        // Mobile number is NOT updated here - user needs to re-KYC to change mobile number
        // if (formData.personal?.mobile) {
        //   updateData.phone = formData.personal.mobile;
        // }
        
        if (Object.keys(updateData).length > 0) {
          await updateProfile(updateData);
          // Refresh profile data
          const updatedProfile = await getUserProfile();
          setProfileData(updatedProfile);
          
          // Update formData with refreshed data
          const mobile = updatedProfile.phone || updatedProfile.profile?.phone || "";
          const email = updatedProfile.email || "";
          const name = updatedProfile.name || user?.name || "";
          
          setFormData(prev => ({
            ...prev,
            personal: {
              name: name,
              mobile: mobile,
              email: email,
            },
          }));
          
          // Reset OTP state after successful update
          if (isNameChanged) {
            setNameChangeOtpSent(false);
            setNameChangeOtpVerified(false);
            setNameChangeOtp("");
            setNameChangeVerificationToken(null);
            setNameChangeOtpTimer(0);
          }
          
          // Show success message
          alert('Profile updated successfully!');
        }
      } else if (section === 'address') {
        const updateData: { 
          address?: string; 
          city?: string; 
          district?: string; 
          state?: string; 
          zipCode?: string;
          pincode?: string;
        } = {};
        
        // Get address fields from formData
        if (formData.address?.address) {
          updateData.address = formData.address.address;
        }
        if (formData.address?.city) {
          updateData.city = formData.address.city;
        }
        if (formData.address?.district) {
          updateData.district = formData.address.district;
        }
        if (formData.address?.state) {
          updateData.state = formData.address.state;
        }
        if (formData.address?.zipCode) {
          updateData.zipCode = formData.address.zipCode;
          updateData.pincode = formData.address.zipCode; // API accepts both
        }
        
        if (Object.keys(updateData).length > 0) {
          await updateProfile(updateData);
          // Refresh profile data
          const updatedProfile = await getUserProfile();
          setProfileData(updatedProfile);
          
          // Update formData with refreshed data
          if (updatedProfile.profile) {
            setFormData(prev => ({
              ...prev,
              address: {
                address: updatedProfile.profile?.address || "",
                city: updatedProfile.profile?.city || "",
                district: "",
                state: updatedProfile.profile?.state || "",
                zipCode: updatedProfile.profile?.pincode || "",
              },
            }));
          }
          
          // Show success message
          alert('Address updated successfully!');
        }
      } else if (section === 'bank') {
        const updateData: {
          accountHolderName?: string;
          accountNumber?: string;
          bankName?: string;
          branch?: string;
          ifscCode?: string;
          bank_ifsc?: string;
          upiId?: string;
          nomineeName?: string;
          nomineeContact?: string;
          nomineeRelation?: string;
        } = {};
        
        // Get bank fields from formData
        if (formData.bank?.accountHolderName) {
          updateData.accountHolderName = formData.bank.accountHolderName;
        }
        if (formData.bank?.accountNumber) {
          // Validate account number before updating
          setIsCheckingAccountNumber(true);
          setAccountNumberError(null);
          try {
            const accountCheck = await checkAccountNumberExists(formData.bank.accountNumber.trim());
            if (accountCheck.exists) {
              setAccountNumberError(accountCheck.message);
              setIsCheckingAccountNumber(false);
              return;
            }
          } catch (err: any) {
            console.error('Account number check error:', err);
            // Continue with update if check fails (network error, etc.)
          } finally {
            setIsCheckingAccountNumber(false);
          }
          updateData.accountNumber = formData.bank.accountNumber;
        }
        if (formData.bank?.bankName) {
          updateData.bankName = formData.bank.bankName;
        }
        if (formData.bank?.branch) {
          updateData.branch = formData.bank.branch;
        }
        if (formData.bank?.ifscCode) {
          updateData.ifscCode = formData.bank.ifscCode;
          updateData.bank_ifsc = formData.bank.ifscCode; // API accepts both
        }
        if (formData.bank?.upiId) {
          updateData.upiId = formData.bank.upiId;
        }
        if (formData.bank?.nomineeName) {
          updateData.nomineeName = formData.bank.nomineeName;
        }
        if (formData.bank?.nomineeContact) {
          updateData.nomineeContact = formData.bank.nomineeContact;
        }
        if (formData.bank?.nomineeRelation) {
          updateData.nomineeRelation = formData.bank.nomineeRelation;
        }
        
        if (Object.keys(updateData).length > 0) {
          await updateProfile(updateData);
          // Refresh profile data
          const updatedProfile = await getUserProfile();
          setProfileData(updatedProfile);
          
          // Update formData with refreshed data
          if (updatedProfile.profile) {
            setFormData(prev => ({
              ...prev,
              bank: {
                accountHolderName: (updatedProfile.profile as any)?.bank_ac_holder || "",
                accountNumber: (updatedProfile.profile as any)?.bank_account_no || "",
                bankName: (updatedProfile.profile as any)?.bank_name || "",
                branch: (updatedProfile.profile as any)?.bank_branch || "",
                ifscCode: (updatedProfile.profile as any)?.bank_ifsc || "",
                upiId: (updatedProfile.profile as any)?.bank_upi || "",
                nomineeContact: (updatedProfile.profile as any)?.nominee_contact || "",
                nomineeName: (updatedProfile.profile as any)?.nominee_name || "",
                nomineeRelation: (updatedProfile.profile as any)?.nominee_relation || "",
              },
            }));
          }
          
          // Show success message
          alert('Bank details updated successfully!');
        }
      }
      setOpenSection(null);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to update profile';
      setError(errorMessage);
      alert(`Failed to update profile: ${errorMessage}`);
      console.error('Failed to update profile:', err);
    }
  };

  const validateAndSetFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file");
      return;
    }
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB");
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handlePhotoSave = async () => {
    if (!selectedFile) {
      setPhotoUploadError("Please select a file");
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoUploadError(null);

    try {
      const response = await uploadProfilePhoto(selectedFile);
      
      // Update profile photo with CDN URL
      const photoUrl = response.profile_photo_url;
      setProfilePhoto(photoUrl);
      
      // Save to localStorage with user-specific key
      if (typeof window !== "undefined" && user?.id) {
        localStorage.setItem(`profilePhoto_${user.id}`, photoUrl);
      }
      
      // Close modal and reset state
      setIsPhotoModalOpen(false);
      setPreviewPhoto(null);
      setSelectedFile(null);
      
      // Refresh profile data to get updated photo
      try {
        const profileData = await getUserProfile();
        if (profileData?.profile?.profile_photo_url) {
          const photoUrl = profileData.profile.profile_photo_url;
          setProfilePhoto(photoUrl);
          if (typeof window !== "undefined" && user?.id) {
            localStorage.setItem(`profilePhoto_${user.id}`, photoUrl);
          }
        }
      } catch (err) {
        // Ignore profile refresh errors
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to upload photo';
      setPhotoUploadError(errorMessage);
      console.error("Profile photo upload error:", error);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoCancel = () => {
    setIsPhotoModalOpen(false);
    setPreviewPhoto(null);
    setSelectedFile(null);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="max-w-[1200px] mx-auto my-4 md:my-5 px-4 md:px-5">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-[1200px] mx-auto my-4 md:my-5 px-4 md:px-5">
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <X className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error loading profile</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto my-4 md:my-5 px-4 md:px-5">
      {/* Identity Card */}
      <Card className="p-4 md:p-5 lg:p-7 mb-5 flex flex-col gap-4 md:gap-5 lg:flex-row lg:items-start lg:justify-between lg:border-l-4 lg:border-l-blue-600 hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="relative group shrink-0">
            <img
              className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-full object-cover border-2 border-(--border) shadow transition-transform duration-200 group-hover:scale-105"
              src={profilePhoto}
              alt="Profile Photo"
            />
            <div
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer"
              onClick={() => setIsPhotoModalOpen(true)}
            >
              <Camera className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs md:text-[12px] min-h-[44px]"
            onClick={() => setIsPhotoModalOpen(true)}
          >
            Change Photo
          </Button>
        </div>
        <div className="flex-1 min-w-0">
          <H1 className="text-base md:text-xl lg:text-2xl md:whitespace-nowrap text-(--text-strong)">
            {formData.personal.name || profileData?.name || user?.name || "Secure Investment Academy"}
          </H1>
          <div className="flex items-center gap-3 md:gap-4 lg:gap-5 mt-2 flex-wrap md:flex-nowrap">
            <p className="m-0 inline-block text-base md:text-lg font-semibold text-blue-600 whitespace-nowrap">
              ID: {user?.display_id || user?.id || "SIA00057"}
            </p>
            {profileData?.kyc_status && (
              <span className={`rounded-full px-2 md:px-3 py-1 text-xs font-bold text-zinc-900 whitespace-nowrap ${
                profileData.kyc_status === 'approved' ? 'bg-green-400' :
                profileData.kyc_status === 'submitted' ? 'bg-yellow-400' :
                profileData.kyc_status === 'rejected' ? 'bg-red-400' :
                'bg-gray-400'
              }`}>
                KYC: {profileData.kyc_status === 'submitted' ? 'SUBMITTED (Pending Verification)' : profileData.kyc_status.toUpperCase()}
              </span>
            )}
          </div>
          {profileData?.kyc_verified_at && (
            <small className="block mt-2 text-xs text-(--text-muted) md:whitespace-nowrap">
              KYC Verified: {new Date(profileData.kyc_verified_at).toLocaleDateString()}
            </small>
          )}
        </div>
        <div className="w-full lg:min-w-[250px] lg:text-right mt-4 lg:mt-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-(--border)">
          <p className="text-xs md:text-[13px] uppercase text-(--text-muted)">
            Sponsor ID
          </p>
          <p className="text-sm md:text-[15px] font-semibold text-(--text-body)">
            {profileData?.referrer_display_id || profileData?.referrer_user_id || "N/A"}
          </p>
          <p className="mt-2 text-xs md:text-[13px] uppercase text-(--text-muted)">
            Sponsor Name
          </p>
          <p className="text-sm md:text-[15px] font-semibold text-(--text-body) wrap-break-word">
            {profileData?.referrer_name || "N/A"}
          </p>
        </div>
      </Card>

      {/* Referral Link Card */}
      <Card className="mb-5 p-4 md:p-5 hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-blue-600 mb-0 text-base">
              Referral Link
            </CardTitle>
          </div>
        </div>
        <div className="space-y-2.5">
          <div className="bg-(--sidebar-hover) rounded-lg border border-(--border) p-2.5 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={referralLink}
              className="flex-1 bg-transparent text-xs md:text-sm text-(--text-strong) outline-none font-mono truncate"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={copyReferralLink}
              className="text-blue-600 hover:bg-(--sidebar-hover) px-2 py-1.5 h-auto shrink-0"
            >
              {referralLinkCopied ? (
                <span className="text-green-600 text-xs">✓ Copied</span>
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={shareReferralLink}
              className="flex-1 min-h-[36px] text-sm"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              Share
            </Button>
          </div>
          <p className="text-[10px] text-(--text-muted) mt-1.5 font-medium">
            Share with friends to earn referral commissions
          </p>
        </div>
      </Card>

      {/* Content Grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Personal Information - Edit disabled; changes via Support */}
        <Card className="p-7 hover:shadow-md transition-shadow duration-200">
          <CardHeader className="mb-5">
            <CardTitle className="text-blue-600">
              Personal Information
            </CardTitle>
            <p className="text-xs text-(--text-muted) mt-1">
              Name, mobile, email change ke liye Support ticket create karein.
            </p>
          </CardHeader>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <div className="flex flex-col md:col-span-2">
              <span className="text-[13px] uppercase text-(--text-muted)">
                Full Name
              </span>
              <span className="text-[16px] font-semibold text-(--text-body)">
                {formData.personal.name || user?.name || "N/A"}
              </span>
            </div>
            <div className="flex flex-col md:col-span-2">
              <span className="text-[13px] uppercase text-(--text-muted)">
                Mobile
              </span>
              <span className="text-[16px] font-semibold text-(--text-body)">
                {formData.personal.mobile}
              </span>
              <p className="text-xs text-amber-600 mt-1 italic">
                ℹ️ Mobile number change karne ke liye re-KYC karna hoga
              </p>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] uppercase text-(--text-muted)">
                E-mail
              </span>
              <span className="text-[16px] font-semibold text-(--text-body) wrap-break-word">
                {formData.personal.email}
              </span>
            </div>
          </div>
        </Card>

        {/* Address Information - Edit disabled; changes via Support */}
        <Card className="p-7 hover:shadow-md transition-shadow duration-200">
          <CardHeader className="mb-5">
            <CardTitle className="text-blue-600">Address Information</CardTitle>
            <p className="text-xs text-(--text-muted) mt-1">
              Address change ke liye Support ticket create karein.
            </p>
          </CardHeader>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4">
            <div className="flex flex-col">
              <span className="text-[13px] uppercase text-(--text-muted)">
                Address
              </span>
              <span className="text-[16px] font-semibold text-(--text-body)">
                {formData.address.address}
              </span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <div className="flex flex-col">
              <span className="text-[13px] uppercase text-(--text-muted)">
                City / Dist
              </span>
              <span className="text-[16px] font-semibold text-(--text-body)">
                {formData.address.city}, {formData.address.district}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] uppercase text-(--text-muted)">
                State / Zip Code
              </span>
              <span className="text-[16px] font-semibold text-(--text-body)">
                {formData.address.state} / {formData.address.zipCode}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Bank and Payment Details Section - First */}
      <Card className="p-7 hover:shadow-md transition-shadow duration-200 mt-5">
        <CardHeader className="mb-5">
          <CardTitle className="text-blue-600">Bank and Payment Details</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <div className="flex flex-col">
              <span className="text-[13px] uppercase text-(--text-muted)">
                A/C Holder Name
              </span>
              <span className="text-[16px] font-semibold text-(--text-body)">
                {formData.bank.accountHolderName}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] uppercase text-(--text-muted)">
                A/C No (Masked)
              </span>
              <span className="text-[16px] font-semibold text-(--text-body)">
                {formData.bank.accountNumber}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] uppercase text-(--text-muted)">
                Bank Name / Branch
              </span>
              <span className="text-[16px] font-semibold text-(--text-body)">
                {formData.bank.bankName} / {formData.bank.branch}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] uppercase text-(--text-muted)">
                IFSC Code
              </span>
              <span className="text-[16px] font-semibold text-(--text-body)">
                {formData.bank.ifscCode}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] uppercase text-(--text-muted)">
                UPI ID
              </span>
              <span className="text-[16px] font-semibold text-(--text-body) wrap-break-word">
                {formData.bank.upiId}
              </span>
            </div>
            </div>
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">
            ℹ️ Bank details ko update karne ke liye KYC resubmit karein.
          </p>
          </div>
        </Card>

      {/* KYC Section - Second */}
      <Card className="p-7 hover:shadow-md transition-shadow duration-200 mt-5">
        <CardHeader className="mb-5 flex items-center justify-between">
          <CardTitle className="text-blue-600">KYC Verification</CardTitle>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsKYCModalOpen(true)}
          >
            <FileText className="w-4 h-4 mr-1.5" />
            {profileData?.kyc_status === 'approved' ? 'Resubmit KYC' : profileData?.kyc_status === 'submitted' ? 'Update KYC' : profileData?.kyc_status === 'rejected' ? 'Resubmit KYC' : 'Submit KYC'}
          </Button>
        </CardHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-[13px] uppercase text-(--text-muted)">Status:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              profileData?.kyc_status === 'approved' ? 'bg-green-100 text-green-800' :
              profileData?.kyc_status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
              profileData?.kyc_status === 'rejected' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {profileData?.kyc_status === 'submitted' ? 'SUBMITTED (Pending Verification)' : (profileData?.kyc_status?.toUpperCase() || 'PENDING')}
            </span>
          </div>

          {/* KYC Fee Amount */}
          {profileData?.kyc_fee_amount !== undefined && profileData.kyc_fee_amount > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-900">
                  {(profileData?.kyc_status === 'rejected' || profileData?.kyc_status === 'approved') ? 'Resubmission Fee:' : 'KYC Submission Fee:'}
                </span>
                <span className="text-lg font-bold text-blue-600">
                  ₹{profileData.kyc_fee_amount.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-blue-700 mt-1">
                {(profileData?.kyc_status === 'rejected' || profileData?.kyc_status === 'approved')
                  ? 'This amount will be deducted from your wallet when you resubmit KYC.'
                  : 'This amount will be deducted from your wallet when you submit KYC.'}
              </p>
              <p className="text-xs text-red-600 mt-2 font-semibold">
                ⚠️ Please note: KYC submission fee ki refund nahi hogi, isliye documents carefully submit karein
              </p>
            </div>
          )}

          {/* Rejection Reason */}
          {profileData?.kyc_status === 'rejected' && profileData?.kyc_rejection_reason && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900 mb-1">Rejection Reason:</p>
                  <p className="text-sm text-red-800">{profileData.kyc_rejection_reason}</p>
                </div>
              </div>
            </div>
          )}
          
          {kycStatus && kycStatus.documents.length > 0 && (() => {
            // Helper function to format date
            const formatDate = (dateString: string) => {
              const date = new Date(dateString);
              return date.toLocaleDateString('en-IN', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            };

            // Helper function to get date key for grouping
            const getDateKey = (dateString: string) => {
              const date = new Date(dateString);
              return date.toLocaleDateString('en-IN', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric'
              });
            };

            // Group documents by submission date
            const documentsByDate = kycStatus.documents.reduce((acc, doc) => {
              const dateKey = getDateKey(doc.submitted_at);
              if (!acc[dateKey]) {
                acc[dateKey] = [];
              }
              acc[dateKey].push(doc);
              return acc;
            }, {} as Record<string, typeof kycStatus.documents>);

            // Sort dates (newest first)
            const sortedDates = Object.keys(documentsByDate).sort((a, b) => {
              // Get the first document's submitted_at from each date group for accurate sorting
              const dateA = documentsByDate[a][0]?.submitted_at || '';
              const dateB = documentsByDate[b][0]?.submitted_at || '';
              return new Date(dateB).getTime() - new Date(dateA).getTime();
            });

            // Sort documents within each date: rejected first, then approved, then pending
            const sortDocuments = (docs: typeof kycStatus.documents) => {
              const statusOrder = { rejected: 0, approved: 1, pending: 2, submitted: 3 };
              return [...docs].sort((a, b) => {
                const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 99;
                const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 99;
                if (aOrder !== bOrder) return aOrder - bOrder;
                // If same status, sort by submitted_at (newest first)
                return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
              });
            };

            return (
              <div>
                <h4 className="text-sm font-semibold text-(--text-strong) mb-3">Uploaded Documents:</h4>
                <div className="space-y-4">
                  {sortedDates.map((dateKey) => {
                    const docs = sortDocuments(documentsByDate[dateKey]);
                    const rejectedDocs = docs.filter(d => d.status === 'rejected');
                    const approvedDocs = docs.filter(d => d.status === 'approved');
                    const pendingDocs = docs.filter(d => d.status === 'pending' || d.status === 'submitted');

                    return (
                      <div key={dateKey} className="border border-(--border) rounded-lg overflow-hidden">
                        {/* Date Header */}
                        <div className="bg-(--sidebar-hover) px-4 py-2 border-b border-(--border)">
                          <p className="text-sm font-semibold text-(--text-strong)">
                            Submitted on: {dateKey}
                          </p>
                        </div>

                        <div className="p-3 space-y-3">
                          {/* Rejected Documents */}
                          {rejectedDocs.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-red-600 mb-2 uppercase tracking-wide">
                                ❌ Rejected Documents ({rejectedDocs.length})
                              </p>
                              <div className="space-y-2">
                                {rejectedDocs.map((doc) => (
                                  <div key={doc.id} className="flex items-start justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="font-semibold text-sm capitalize text-red-900">{doc.document_type.replace('_', ' ')}</p>
                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                          REJECTED
                                        </span>
                                      </div>
                                      {doc.document_number && (
                                        <p className="text-xs text-gray-600 font-mono mb-1">ID: {doc.document_number}</p>
                                      )}
                                      {doc.rejection_reason && (
                                        <p className="text-xs text-red-700 mt-1 font-medium">
                                          <span className="font-semibold">Reason:</span> {doc.rejection_reason}
                                        </p>
                                      )}
                                      {doc.verified_at && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          Rejected on: {formatDate(doc.verified_at)}
                                        </p>
                                      )}
                                      <p className="text-xs text-gray-500 mt-1">
                                        Submitted: {formatDate(doc.submitted_at)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Approved Documents */}
                          {approvedDocs.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-green-600 mb-2 uppercase tracking-wide">
                                ✅ Approved Documents ({approvedDocs.length})
                              </p>
                              <div className="space-y-2">
                                {approvedDocs.map((doc) => (
                                  <div key={doc.id} className="flex items-start justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="font-semibold text-sm capitalize text-green-900">{doc.document_type.replace('_', ' ')}</p>
                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                          APPROVED
                                        </span>
                                      </div>
                                      {doc.document_number && (
                                        <p className="text-xs text-gray-600 font-mono mb-1">ID: {doc.document_number}</p>
                                      )}
                                      {doc.verified_at && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          Approved on: {formatDate(doc.verified_at)}
                                        </p>
                                      )}
                                      <p className="text-xs text-gray-500 mt-1">
                                        Submitted: {formatDate(doc.submitted_at)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Pending/Submitted Documents */}
                          {pendingDocs.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-yellow-600 mb-2 uppercase tracking-wide">
                                ⏳ Pending Review ({pendingDocs.length})
                              </p>
                              <div className="space-y-2">
                                {pendingDocs.map((doc) => (
                                  <div key={doc.id} className="flex items-start justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="font-semibold text-sm capitalize text-yellow-900">{doc.document_type.replace('_', ' ')}</p>
                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                          {doc.status.toUpperCase()}
                                        </span>
                                      </div>
                                      {doc.document_number && (
                                        <p className="text-xs text-gray-600 font-mono mb-1">ID: {doc.document_number}</p>
                                      )}
                                      <p className="text-xs text-gray-500 mt-1">
                                        Submitted: {formatDate(doc.submitted_at)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </Card>

      {/* Edit Modals */}
      {/* Personal Information Modal */}
      <Dialog
        isOpen={openSection === "personal"}
        onClose={() => {
          setOpenSection(null);
          setOriginalName("");
        }}
        title="Edit Personal Information"
        size="md"
      >
        <div className="space-y-4">
          {/* Show fee information - always show name change fee if it exists, otherwise show profile update fee */}
          {(() => {
            const isNameChanged = formData.personal.name && originalName && 
              formData.personal.name.trim() !== originalName.trim();
            
            // In Personal Information modal, always prioritize nameChangeFee if it's > 0
            // because this modal is primarily for name changes
            // Debug: Log the fees to see what's being fetched
            console.log('Fee Debug - nameChangeFee:', nameChangeFee, 'profileUpdateFee:', profileUpdateFee);
            
            const applicableFee = nameChangeFee > 0 ? nameChangeFee : profileUpdateFee;
            const feeLabel = nameChangeFee > 0 ? "Name Change Fee" : "Profile Update Fee";
            const showNameChangeWarning = isNameChanged && nameChangeFee > 0;
            
            return (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-amber-900">
                    {feeLabel}:
              </span>
              <span className="text-lg font-bold text-amber-600">
                    ₹{applicableFee.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-amber-700">
                  {showNameChangeWarning
                    ? `This amount (₹${nameChangeFee.toFixed(2)}) will be deducted from your wallet when you change your name. Please note: Name change fee ki refund nahi hogi, isliye carefully update karein.`
                    : nameChangeFee > 0
                    ? `Name change ke liye ₹${nameChangeFee.toFixed(2)} fee lagti hai. Ye amount aapke wallet se deduct ho jayega aur refund nahi hogi.`
                    : applicableFee > 0
                ? "This amount will be deducted from your wallet when you update your profile details."
                : "No fee will be charged for updating your profile details."}
            </p>
          </div>
            );
          })()}
          <Input
            label="Full Name"
            type="text"
            value={formData.personal.name}
            onChange={(e) =>
              setFormData({
                ...formData,
                personal: { ...formData.personal, name: e.target.value },
              })
            }
            required
          />
          <div>
          <Input
            label="Mobile Number"
            type="tel"
            value={formData.personal.mobile}
              readOnly
              disabled
              className="bg-gray-100 cursor-not-allowed"
            />
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">
                ⚠️ <strong>Note:</strong> Mobile number change karne ke liye aapko re-KYC karna hoga. Mobile number ko update karne ke liye KYC section mein jayein aur documents resubmit karein.
              </p>
            </div>
          </div>
          <Input
            label="Email Address"
            type="email"
            value={formData.personal.email}
            onChange={(e) =>
              setFormData({
                ...formData,
                personal: { ...formData.personal, email: e.target.value },
              })
            }
          />
          
          {/* Name Change OTP Section - Show only if name is being changed */}
          {(() => {
            const isNameChanged = formData.personal?.name && originalName && 
              formData.personal.name.trim() !== originalName.trim();
            
            if (!isNameChanged) return null;
            
            return (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-900">
                    OTP Verification Required for Name Change
                  </p>
                </div>
                <p className="text-xs text-blue-700">
                  Aap apna name change kar rahe hain. Iske liye OTP verification zaroori hai.
                </p>
                
                {!nameChangeOtpSent ? (
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleSendNameChangeOTP}
                    disabled={isSendingNameChangeOtp}
                  >
                    {isSendingNameChangeOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      "Send OTP"
                    )}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    {nameChangeOtpVerified ? (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <p className="text-sm font-semibold text-green-900">
                            OTP Verified Successfully!
                          </p>
                        </div>
                        <p className="text-xs text-green-700 mt-1">
                          Aap ab name update kar sakte hain.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <Input
                            label="Enter OTP"
                            type="text"
                            placeholder="Enter 6 digit OTP"
                            value={nameChangeOtp}
                            onChange={(e) => setNameChangeOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            maxLength={6}
                            className="flex-1"
                            disabled={nameChangeOtpTimer === 0}
                          />
                          <Button
                            variant="primary"
                            onClick={handleVerifyNameChangeOTP}
                            disabled={isVerifyingNameChangeOtp || !nameChangeOtp || nameChangeOtp.length !== 6 || nameChangeOtpTimer === 0}
                            className="self-end"
                          >
                            {isVerifyingNameChangeOtp ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Verifying...
                              </>
                            ) : (
                              "Verify OTP"
                            )}
                          </Button>
                        </div>
                        {nameChangeOtpTimer > 0 && (
                          <p className="text-xs text-blue-600">
                            OTP valid for {Math.floor(nameChangeOtpTimer / 60)}:{(nameChangeOtpTimer % 60).toString().padStart(2, '0')}
                          </p>
                        )}
                        {nameChangeOtpTimer === 0 && nameChangeOtpSent && (
                          <div className="p-2 bg-red-50 border border-red-200 rounded">
                            <p className="text-xs text-red-700">
                              OTP expired. Please request a new OTP.
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={handleSendNameChangeOTP}
                            >
                              Resend OTP
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          
          {(() => {
            const isNameChanged = formData.personal?.name && originalName && 
              formData.personal.name.trim() !== originalName.trim();
            const isSaveDisabled: boolean = Boolean(isNameChanged && !nameChangeOtpVerified);
            
            return (
              <div className="flex gap-3 pt-4">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => handleSave("personal")}
                  disabled={isSaveDisabled}
                >
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOpenSection(null)}
                >
                  Cancel
                </Button>
              </div>
            );
          })()}
        </div>
      </Dialog>

      {/* Address Information Modal */}
      <Dialog
        isOpen={openSection === "address"}
        onClose={() => setOpenSection(null)}
        title="Edit Address Information"
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-amber-900">
                Profile Update Fee:
              </span>
              <span className="text-lg font-bold text-amber-600">
                ₹{profileUpdateFee.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-amber-700">
              {profileUpdateFee > 0 
                ? "This amount will be deducted from your wallet when you update your profile details."
                : "No fee will be charged for updating your profile details."}
            </p>
          </div>
          <Input
            label="Address"
            value={formData.address.address}
            onChange={(e) =>
              setFormData({
                ...formData,
                address: { ...formData.address, address: e.target.value },
              })
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="City"
              value={formData.address.city}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, city: e.target.value },
                })
              }
            />
            <Input
              label="District"
              value={formData.address.district}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, district: e.target.value },
                })
              }
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="State"
              value={formData.address.state}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, state: e.target.value },
                })
              }
            />
            <Input
              label="Zip Code"
              value={formData.address.zipCode}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, zipCode: e.target.value },
                })
              }
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => handleSave("address")}
            >
              Save Changes
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpenSection(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Bank Details Modal */}
      <Dialog
        isOpen={openSection === "bank"}
        onClose={() => setOpenSection(null)}
        title="Edit Bank and Payment Details"
        size="xl"
      >
        <div className="space-y-4">
          {profileUpdateFee > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-amber-900">
                  Profile Update Fee:
                </span>
                <span className="text-lg font-bold text-amber-600">
                  ₹{profileUpdateFee.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-amber-700">
                This amount will be deducted from your wallet when you update your profile details.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Account Holder Name"
              value={formData.bank.accountHolderName}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  bank: { ...formData.bank, accountHolderName: e.target.value },
                })
              }
            />
            <Input
              label="Account Number"
              value={formData.bank.accountNumber}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  bank: { ...formData.bank, accountNumber: e.target.value },
                });
                setAccountNumberError(null); // Clear error when user types
              }}
            />
            {isCheckingAccountNumber && (
              <p className="text-sm text-blue-600 mt-1">Checking account number...</p>
            )}
            {accountNumberError && (
              <p className="text-sm text-red-600 mt-1">{accountNumberError}</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Bank Name"
              value={formData.bank.bankName}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  bank: { ...formData.bank, bankName: e.target.value },
                })
              }
            />
            <Input
              label="Branch"
              value={formData.bank.branch}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  bank: { ...formData.bank, branch: e.target.value },
                })
              }
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="IFSC Code"
              value={formData.bank.ifscCode}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  bank: { ...formData.bank, ifscCode: e.target.value },
                })
              }
            />
            <Input
              label="UPI ID"
              value={formData.bank.upiId}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  bank: { ...formData.bank, upiId: e.target.value },
                })
              }
            />
          </div>
          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold text-(--text-strong) mb-4">
              Nominee Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nominee Name"
                value={formData.bank.nomineeName}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bank: { ...formData.bank, nomineeName: e.target.value },
                  })
                }
              />
              <Input
                label="Nominee Relation"
                value={formData.bank.nomineeRelation}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bank: { ...formData.bank, nomineeRelation: e.target.value },
                  })
                }
              />
            </div>
            <Input
              label="Nominee Contact"
              type="tel"
              value={formData.bank.nomineeContact}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  bank: { ...formData.bank, nomineeContact: e.target.value },
                })
              }
              className="mt-4"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => handleSave("bank")}
            >
              Save Changes
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpenSection(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Change Photo Modal */}
      <Dialog
        isOpen={isPhotoModalOpen}
        onClose={handlePhotoCancel}
        title="Change Profile Photo"
        size="md"
      >
        <div className="space-y-6">
          {/* Preview Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <img
                src={previewPhoto || profilePhoto}
                alt="Profile Preview"
                className="w-32 h-32 rounded-full object-cover border-4 border-(--border) shadow-lg"
              />
              {previewPhoto && (
                <button
                  onClick={() => {
                    setPreviewPhoto(null);
                    setSelectedFile(null);
                  }}
                  className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  aria-label="Remove preview"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-(--text-muted) text-center">
              {previewPhoto
                ? "Preview of your new photo"
                : "Current profile photo"}
            </p>
          </div>

          {/* Upload Section */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
              isDragging
                ? "border-blue-500 bg-(--sidebar-hover)"
                : "border-(--border) hover:border-blue-400"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <label
              htmlFor="photo-upload"
              className="flex flex-col items-center gap-3 cursor-pointer"
            >
              <div className="p-3 bg-(--sidebar-hover) rounded-full">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-(--text-strong)">
                  {previewPhoto
                    ? "Choose a different photo"
                    : "Click to upload or drag and drop"}
                </p>
                <p className="text-xs text-(--text-muted) mt-1">
                  PNG, JPG, JPEG up to 5MB
                </p>
              </div>
              <input
                id="photo-upload"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>

          {/* Error Message */}
          {photoUploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-3">
              <p className="text-sm text-red-600">{photoUploadError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="primary"
              className="flex-1"
              onClick={handlePhotoSave}
              disabled={!previewPhoto || isUploadingPhoto}
            >
              {isUploadingPhoto ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Save Photo"
              )}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handlePhotoCancel}
              disabled={isUploadingPhoto}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>

      {/* KYC Submission Modal */}
      <Dialog
        isOpen={isKYCModalOpen}
        onClose={() => {
          setIsKYCModalOpen(false);
          setAadharFront({ file: null, image_url: '' });
          setAadharBack({ file: null, image_url: '' });
          setBankDocument({ type: 'cheque', file: null, image_url: '' });
        }}
        title="Submit KYC Documents"
        size="xl"
      >
        <div className="space-y-6 max-h-[80vh] overflow-y-auto">
          {/* KYC Fee Information */}
          {profileData?.kyc_fee_amount !== undefined && profileData.kyc_fee_amount > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-blue-900">
                  {(profileData?.kyc_status === 'rejected' || profileData?.kyc_status === 'approved') ? 'Resubmission Fee:' : 'KYC Submission Fee:'}
                </span>
                <span className="text-xl font-bold text-blue-600">
                  ₹{profileData.kyc_fee_amount.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-blue-700">
                This amount will be deducted from your wallet balance when you {(profileData?.kyc_status === 'rejected' || profileData?.kyc_status === 'approved') ? 'resubmit' : 'submit'} KYC.
                {(profileData as any)?.stats?.wallet_balance !== undefined && (
                  <span className="block mt-1">
                    Your current wallet balance: ₹{(profileData as any).stats.wallet_balance.toFixed(2)}
                  </span>
                )}
              </p>
              <p className="text-xs text-red-600 mt-2 font-semibold">
                ⚠️ Please note: KYC submission fee ki refund nahi hogi, isliye documents carefully submit karein
              </p>
            </div>
          )}

          {/* Date Validation Warning */}
          {!isKYCSubmissionAllowed().allowed && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-900 mb-1">KYC Submission Not Allowed</p>
                <p className="text-sm text-red-700">{isKYCSubmissionAllowed().message}</p>
              </div>
            </div>
          )}

          {/* Personal Information */}
          <div>
            <h3 className="font-semibold text-(--text-strong) mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                type="tel"
                value={kycFormData.phone}
                onChange={(e) => setKycFormData({ ...kycFormData, phone: e.target.value })}
                required
              />
              <Input
                label="Date of Birth"
                type="date"
                value={kycFormData.date_of_birth}
                onChange={(e) => setKycFormData({ ...kycFormData, date_of_birth: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h3 className="font-semibold text-(--text-strong) mb-4">Address Information</h3>
            <div className="space-y-4">
              <Input
                label="Address"
                value={kycFormData.address}
                onChange={(e) => setKycFormData({ ...kycFormData, address: e.target.value })}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="City"
                  value={kycFormData.city}
                  onChange={(e) => setKycFormData({ ...kycFormData, city: e.target.value })}
                  required
                />
                <Input
                  label="State"
                  value={kycFormData.state}
                  onChange={(e) => setKycFormData({ ...kycFormData, state: e.target.value })}
                  required
                />
              </div>
              <Input
                label="Pincode"
                value={kycFormData.pincode}
                onChange={(e) => setKycFormData({ ...kycFormData, pincode: e.target.value })}
                maxLength={6}
                required
              />
            </div>
          </div>

          {/* Document Numbers */}
          <div>
            <h3 className="font-semibold text-(--text-strong) mb-4">Document Numbers</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="PAN Number"
                value={kycFormData.pan_number}
                onChange={(e) => setKycFormData({ ...kycFormData, pan_number: e.target.value.toUpperCase() })}
                maxLength={10}
                required
              />
              <Input
                label="Aadhar Number"
                type="tel"
                value={kycFormData.aadhar_number}
                onChange={(e) => setKycFormData({ ...kycFormData, aadhar_number: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                maxLength={12}
                required
              />
            </div>
          </div>

          {/* Bank Information */}
          <div>
            <h3 className="font-semibold text-(--text-strong) mb-4">Bank Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Account Holder Name"
                value={kycFormData.bank_ac_holder}
                onChange={(e) => setKycFormData({ ...kycFormData, bank_ac_holder: e.target.value })}
              />
              <Input
                label="Account Number"
                value={kycFormData.bank_account_no}
                onChange={(e) => {
                  setKycFormData({ ...kycFormData, bank_account_no: e.target.value });
                  setAccountNumberError(null); // Clear error when user types
                }}
              />
              {isCheckingAccountNumber && (
                <p className="text-sm text-blue-600 mt-1">Checking account number...</p>
              )}
              {accountNumberError && (
                <p className="text-sm text-red-600 mt-1">{accountNumberError}</p>
              )}
              <Input
                label="IFSC Code"
                value={kycFormData.bank_ifsc}
                onChange={(e) => setKycFormData({ ...kycFormData, bank_ifsc: e.target.value.toUpperCase() })}
              />
              <Input
                label="Bank Name"
                value={kycFormData.bank_name}
                onChange={(e) => setKycFormData({ ...kycFormData, bank_name: e.target.value })}
              />
              <Input
                label="Branch"
                value={kycFormData.bank_branch}
                onChange={(e) => setKycFormData({ ...kycFormData, bank_branch: e.target.value })}
              />
              <Input
                label="UPI ID"
                value={kycFormData.bank_upi}
                onChange={(e) => setKycFormData({ ...kycFormData, bank_upi: e.target.value })}
              />
            </div>
          </div>

          {/* Document Upload Section */}
          <div>
            <h3 className="font-semibold text-(--text-strong) mb-4">Upload Documents</h3>
            <p className="text-sm text-(--text-muted) mb-4">
              Please upload the following documents (All fields are mandatory):
            </p>
            <div className="space-y-6">
              {/* Aadhar Card Front */}
              <div className="p-4 border border-(--border) rounded-lg">
                <h4 className="font-semibold text-(--text-strong) mb-3">1. Aadhar Card Front *</h4>
                {!aadharFront.image_url ? (
                  <FileUpload
                    label="Aadhar Card Front"
                    accept="image/*"
                    maxSize={10}
                    value={aadharFront.file}
                        required
                    onChange={async (file) => {
                      if (!file) return;
                      
                      setAadharFront({ ...aadharFront, file });
                      
                      try {
                        setUploadingStatus(prev => ({ ...prev, 'aadhar_front': true }));
                        setIsUploadingDoc('Uploading Aadhar front...');
                        
                        const uploadResult = await uploadKYCDocument(file, 'aadhar', 'front');
                        const imageUrl = uploadResult.url || uploadResult.image_url;
                        
                        if (!imageUrl) {
                          throw new Error('Upload succeeded but no image URL returned');
                        }
                        
                        setAadharFront({ file, image_url: imageUrl });
                      } catch (error: any) {
                        console.error('Aadhar front upload error:', error);
                        const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
                        alert(`Failed to upload Aadhar front: ${errorMsg}`);
                        setAadharFront({ file: null, image_url: '' });
                      } finally {
                        setUploadingStatus(prev => ({ ...prev, 'aadhar_front': false }));
                        setIsUploadingDoc(null);
                      }
                    }}
                  />
                ) : (
                  <div>
                    <label className="text-sm font-semibold text-[var(--text-body)] mb-2 block">
                      Aadhar Card Front
                    </label>
                    <div className="relative inline-block">
                      <img
                        src={aadharFront.image_url}
                        alt="Aadhar front"
                        className="max-w-full h-auto rounded-lg border border-[var(--border)] max-h-48"
                      />
                      <p className="text-xs text-green-600 mt-1">✓ Uploaded</p>
                    </div>
                  </div>
                )}
                {uploadingStatus['aadhar_front'] && (
                  <p className="text-xs text-blue-600 mt-1">⏳ Uploading...</p>
                    )}
                  </div>

              {/* Aadhar Card Back */}
              <div className="p-4 border border-(--border) rounded-lg">
                <h4 className="font-semibold text-(--text-strong) mb-3">2. Aadhar Card Back *</h4>
                {!aadharBack.image_url ? (
                        <FileUpload
                    label="Aadhar Card Back"
                          accept="image/*"
                          maxSize={10}
                    value={aadharBack.file}
                    required
                          onChange={async (file) => {
                            if (!file) return;
                            
                      setAadharBack({ ...aadharBack, file });
                      
                            try {
                        setUploadingStatus(prev => ({ ...prev, 'aadhar_back': true }));
                        setIsUploadingDoc('Uploading Aadhar back...');
                              
                        const uploadResult = await uploadKYCDocument(file, 'aadhar', 'back');
                              const imageUrl = uploadResult.url || uploadResult.image_url;
                              
                              if (!imageUrl) {
                                throw new Error('Upload succeeded but no image URL returned');
                              }
                              
                        setAadharBack({ file, image_url: imageUrl });
                            } catch (error: any) {
                        console.error('Aadhar back upload error:', error);
                              const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
                        alert(`Failed to upload Aadhar back: ${errorMsg}`);
                        setAadharBack({ file: null, image_url: '' });
                            } finally {
                        setUploadingStatus(prev => ({ ...prev, 'aadhar_back': false }));
                              setIsUploadingDoc(null);
                            }
                          }}
                        />
                      ) : (
                        <div>
                          <label className="text-sm font-semibold text-[var(--text-body)] mb-2 block">
                      Aadhar Card Back
                          </label>
                          <div className="relative inline-block">
                            <img
                        src={aadharBack.image_url}
                        alt="Aadhar back"
                              className="max-w-full h-auto rounded-lg border border-[var(--border)] max-h-48"
                            />
                            <p className="text-xs text-green-600 mt-1">✓ Uploaded</p>
                          </div>
                        </div>
                      )}
                {uploadingStatus['aadhar_back'] && (
                        <p className="text-xs text-blue-600 mt-1">⏳ Uploading...</p>
                      )}
                    </div>

              {/* PAN Card Front */}
              <div className="p-4 border border-(--border) rounded-lg">
                <h4 className="font-semibold text-(--text-strong) mb-3">3. PAN Card Front *</h4>
                {!panFront.image_url ? (
                        <FileUpload
                    label="PAN Card Front"
                          accept="image/*"
                          maxSize={10}
                    value={panFront.file}
                    required
                          onChange={async (file) => {
                            if (!file) return;
                            
                      setPanFront({ ...panFront, file });
                      
                            try {
                        setUploadingStatus(prev => ({ ...prev, 'pan_front': true }));
                        setIsUploadingDoc('Uploading PAN front...');
                              
                        const uploadResult = await uploadKYCDocument(file, 'pan', 'front');
                              const imageUrl = uploadResult.url || uploadResult.image_url;
                              
                              if (!imageUrl) {
                                throw new Error('Upload succeeded but no image URL returned');
                              }
                              
                        setPanFront({ file, image_url: imageUrl });
                            } catch (error: any) {
                        console.error('PAN front upload error:', error);
                              const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
                        alert(`Failed to upload PAN front: ${errorMsg}`);
                        setPanFront({ file: null, image_url: '' });
                            } finally {
                        setUploadingStatus(prev => ({ ...prev, 'pan_front': false }));
                              setIsUploadingDoc(null);
                            }
                          }}
                        />
                      ) : (
                        <div>
                          <label className="text-sm font-semibold text-[var(--text-body)] mb-2 block">
                      PAN Card Front
                          </label>
                          <div className="relative inline-block">
                            <img
                        src={panFront.image_url}
                        alt="PAN front"
                              className="max-w-full h-auto rounded-lg border border-[var(--border)] max-h-48"
                            />
                            <p className="text-xs text-green-600 mt-1">✓ Uploaded</p>
                          </div>
                        </div>
                      )}
                {uploadingStatus['pan_front'] && (
                        <p className="text-xs text-blue-600 mt-1">⏳ Uploading...</p>
                      )}
                    </div>

              {/* Cheque or Passbook */}
              <div className="p-4 border border-(--border) rounded-lg">
                <h4 className="font-semibold text-(--text-strong) mb-3">4. Cheque or Passbook *</h4>
                <div className="mb-4">
                  <label className="text-sm font-semibold text-[var(--text-body)] mb-2 block">
                    Select Document Type
                  </label>
                  <select
                    value={bankDocument.type}
                    onChange={(e) => {
                      setBankDocument({ ...bankDocument, type: e.target.value as 'cheque' | 'passbook', file: null, image_url: '' });
                    }}
                    className="px-3 py-2 border border-(--border) rounded-lg bg-(--card-bg) text-(--text-strong) w-full"
                    required
                  >
                    <option value="cheque">Cheque</option>
                    <option value="passbook">Passbook</option>
                  </select>
                </div>
                {!bankDocument.image_url ? (
                  <FileUpload
                    label={`${bankDocument.type === 'cheque' ? 'Cheque' : 'Passbook'} Image`}
                    accept="image/*"
                    maxSize={10}
                    value={bankDocument.file}
                    required
                    onChange={async (file) => {
                      if (!file) return;
                      
                      setBankDocument({ ...bankDocument, file });
                      
                      try {
                        setUploadingStatus(prev => ({ ...prev, 'bank_doc': true }));
                        setIsUploadingDoc(`Uploading ${bankDocument.type}...`);
                        
                        // Use 'bank_statement' as document type for both cheque and passbook
                        const uploadResult = await uploadKYCDocument(file, 'bank_statement', 'front');
                        const imageUrl = uploadResult.url || uploadResult.image_url;
                        
                        if (!imageUrl) {
                          throw new Error('Upload succeeded but no image URL returned');
                        }
                        
                        setBankDocument({ ...bankDocument, file, image_url: imageUrl });
                      } catch (error: any) {
                        console.error('Bank document upload error:', error);
                        const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
                        alert(`Failed to upload ${bankDocument.type}: ${errorMsg}`);
                        setBankDocument({ ...bankDocument, file: null, image_url: '' });
                      } finally {
                        setUploadingStatus(prev => ({ ...prev, 'bank_doc': false }));
                        setIsUploadingDoc(null);
                      }
                    }}
                  />
                ) : (
                  <div>
                    <label className="text-sm font-semibold text-[var(--text-body)] mb-2 block">
                      {bankDocument.type === 'cheque' ? 'Cheque' : 'Passbook'} Image
                    </label>
                    <div className="relative inline-block">
                      <img
                        src={bankDocument.image_url}
                        alt={bankDocument.type}
                        className="max-w-full h-auto rounded-lg border border-[var(--border)] max-h-48"
                      />
                      <p className="text-xs text-green-600 mt-1">✓ Uploaded</p>
                    </div>
                  </div>
                )}
                {uploadingStatus['bank_doc'] && (
                  <p className="text-xs text-blue-600 mt-1">⏳ Uploading...</p>
              )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="primary"
              className="flex-1"
              onClick={async () => {
                if (!user?.id) return;
                
                // Check date validation
                const dateCheck = isKYCSubmissionAllowed();
                if (!dateCheck.allowed) {
                  alert(dateCheck.message);
                  return;
                }

                // Validate required fields
                if (!kycFormData.phone || !kycFormData.address || !kycFormData.city || 
                    !kycFormData.state || !kycFormData.pincode || !kycFormData.pan_number || 
                    !kycFormData.aadhar_number) {
                  alert('Please fill all required fields');
                  return;
                }

                // Validate all 4 documents are uploaded
                if (!aadharFront.image_url) {
                  alert('Please upload Aadhar Card Front');
                  return;
                }
                if (!aadharBack.image_url) {
                  alert('Please upload Aadhar Card Back');
                  return;
                }
                if (!panFront.image_url) {
                  alert('Please upload PAN Card Front');
                  return;
                }
                if (!bankDocument.image_url) {
                  alert(`Please upload ${bankDocument.type === 'cheque' ? 'Cheque' : 'Passbook'}`);
                  return;
                }

                // Check if any upload is in progress
                const hasUploadInProgress = Object.values(uploadingStatus).some(status => status === true);
                if (hasUploadInProgress) {
                  alert('Please wait for all images to finish uploading before submitting');
                  return;
                }

                // Validate account number if provided
                if (kycFormData.bank_account_no && kycFormData.bank_account_no.trim()) {
                  setIsCheckingAccountNumber(true);
                  setAccountNumberError(null);
                  try {
                    const accountCheck = await checkAccountNumberExists(kycFormData.bank_account_no.trim());
                    if (accountCheck.exists) {
                      setAccountNumberError(accountCheck.message);
                      setIsCheckingAccountNumber(false);
                      alert(accountCheck.message);
                      return;
                    }
                  } catch (err: any) {
                    console.error('Account number check error:', err);
                    // Continue with submission if check fails (network error, etc.)
                  } finally {
                    setIsCheckingAccountNumber(false);
                  }
                }

                setIsSubmittingKYC(true);
                try {
                  // Prepare documents array with Aadhar and Bank document
                  const uploadedDocs = [];
                  
                  // Add Aadhar document (front and back)
                  uploadedDocs.push({
                    document_type: 'aadhar',
                    document_number: kycFormData.aadhar_number || '',
                    front_image_url: aadharFront.image_url,
                    back_image_url: aadharBack.image_url,
                  });
                  
                  // Add PAN document (front only)
                  uploadedDocs.push({
                    document_type: 'pan',
                    document_number: kycFormData.pan_number || '',
                    front_image_url: panFront.image_url,
                    back_image_url: panFront.image_url, // Use same image for back
                  });
                  
                  // Add Bank document (cheque or passbook)
                  // Use 'bank_statement' as document type (API only accepts: aadhar, pan, passport, driving_license, bank_statement, others)
                  // Use the same image for both front and back since it's a single document
                    uploadedDocs.push({
                    document_type: 'bank_statement',
                    document_number: kycFormData.bank_account_no || '',
                    front_image_url: bankDocument.image_url,
                    back_image_url: bankDocument.image_url, // Use same image for back
                    });

                  // Submit KYC
                  setIsUploadingDoc('Submitting KYC...');
                  
                  // Prepare submit data - ensure all required fields are strings
                  const submitData = {
                    phone: kycFormData.phone || "",
                    address: kycFormData.address || "",
                    city: kycFormData.city || "",
                    state: kycFormData.state || "",
                    pincode: kycFormData.pincode || "",
                    pan_number: kycFormData.pan_number || "",
                    aadhar_number: kycFormData.aadhar_number || "",
                    // Include bank details
                    bank_account_no: kycFormData.bank_account_no || "",
                    bank_ifsc: kycFormData.bank_ifsc || "",
                    bank_name: kycFormData.bank_name || "",
                    bank_branch: kycFormData.bank_branch || "",
                    bank_ac_holder: kycFormData.bank_ac_holder || "",
                    bank_upi: kycFormData.bank_upi || "",
                    documents: uploadedDocs.map(doc => ({
                      document_type: doc.document_type,
                      document_number: doc.document_number || "",
                      front_image_url: doc.front_image_url || "",
                      back_image_url: doc.back_image_url || "",
                    })),
                  };
                  
                  if (process.env.NODE_ENV === 'development') {
                    console.log('Submitting KYC with data:', JSON.stringify(submitData, null, 2));
                  }
                  const userId: string | undefined = profileData?.id || profileData?.user_id;
                  if (!userId) {
                    throw new Error('User ID not found');
                  }
                  const submitResult = await submitKYC(userId as string, submitData);
                  if (process.env.NODE_ENV === 'development') {
                    console.log('KYC submission result:', submitResult);
                  }

                  alert('KYC submitted successfully!');
                  setIsKYCModalOpen(false);
                  setAadharFront({ file: null, image_url: '' });
                  setAadharBack({ file: null, image_url: '' });
                  setBankDocument({ type: 'cheque', file: null, image_url: '' });
                  
                  // Refresh profile and KYC status
                  const [profile, status] = await Promise.all([
                    getUserProfile(),
                    getKYCStatus().catch(() => null),
                  ]);
                  setProfileData(profile);
                  if (status) setKycStatus(status);
                } catch (err: any) {
                  console.error('KYC submission error:', err);
                  console.error('Error response data:', err?.response?.data);
                  
                  let errorMessage = 'Unknown error';
                  if (err?.response?.data) {
                    const errorData = err.response.data;
                    if (errorData.details && Array.isArray(errorData.details)) {
                      errorMessage = errorData.details.map((d: any) => `${d.field || ''}: ${d.message}`).join('\n');
                    } else {
                      errorMessage = errorData.message || errorData.error || err?.message || 'Unknown error';
                    }
                  } else {
                    errorMessage = err?.message || 'Unknown error';
                  }
                  
                  alert(`Failed to submit KYC: ${errorMessage}`);
                  // Don't close modal on error so user can retry
                } finally {
                  setIsSubmittingKYC(false);
                  setIsUploadingDoc(null);
                }
              }}
              disabled={
                isSubmittingKYC || 
                !isKYCSubmissionAllowed().allowed || 
                Object.values(uploadingStatus).some(status => status === true) || 
                !aadharFront.image_url || 
                !aadharBack.image_url || 
                !panFront.image_url || 
                !bankDocument.image_url ||
                !kycFormData.phone?.trim() ||
                !kycFormData.date_of_birth ||
                !kycFormData.address?.trim() ||
                !kycFormData.city?.trim() ||
                !kycFormData.state?.trim() ||
                !kycFormData.pincode?.trim() ||
                !kycFormData.pan_number?.trim() ||
                !kycFormData.aadhar_number?.trim()
              }
            >
              {isSubmittingKYC ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isUploadingDoc || 'Submitting...'}
                </>
              ) : (
                'Submit KYC'
              )}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setIsKYCModalOpen(false);
                setAadharFront({ file: null, image_url: '' });
                setAadharBack({ file: null, image_url: '' });
                setBankDocument({ type: 'cheque', file: null, image_url: '' });
              }}
              disabled={isSubmittingKYC}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
