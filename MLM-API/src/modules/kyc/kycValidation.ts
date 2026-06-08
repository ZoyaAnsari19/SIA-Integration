import { z } from 'zod';

// KYC Submission Schema
export const kycSubmitSchema = z.object({
  // Profile Information
  phone: z.string().min(10).max(15).optional(),
  date_of_birth: z.union([z.string().datetime(), z.date(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  pincode: z.string().min(6).max(6).optional(),
  
  // Bank Details
  bank_account_no: z.string().optional(),
  bank_ifsc: z.string().optional(),
  bank_name: z.string().min(1).optional(),
  bank_branch: z.string().optional(),
  bank_ac_holder: z.string().optional(),
  bank_upi: z.string().optional(),
  
  // Document Numbers - just string, no format validation
  pan_number: z.string().optional(),
  aadhar_number: z.string().optional(),
  
  // Documents (image URLs or base64)
  documents: z.array(z.object({
    document_type: z.enum(['aadhar', 'pan', 'passport', 'driving_license', 'bank_statement', 'others']),
    document_number: z.string().optional(),
    front_image_url: z.union([
      z.string().url(),
      z.string().length(0), // Allow empty string
      z.undefined(),
    ]).optional(),
    back_image_url: z.union([
      z.string().url(),
      z.string().length(0), // Allow empty string
      z.undefined(),
    ]).optional(),
  })).min(1, 'At least one document is required'),
});

// KYC Reject Schema
export const kycRejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

// Type exports
export type KYCSubmitInput = z.infer<typeof kycSubmitSchema>;
export type KYCRejectInput = z.infer<typeof kycRejectSchema>;

