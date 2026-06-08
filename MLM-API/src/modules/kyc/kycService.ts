import { prisma } from '../../config/prisma.js';
import { FeeService } from '../fees/feeService.js';

export class KYCService {
  /**
   * Check if KYC submission is allowed on current date
   * Blocked dates: 1, 9, 10, 19, 20, 29, 30, 31 of each month
   * KYC is allowed on all other dates.
   */
  static isKYCSubmissionAllowed(): { allowed: boolean; message?: string } {
    const today = new Date();
    const dayOfMonth = today.getDate();

    const blockedDays = [1, 9, 10, 19, 20, 29, 30, 31];
    const isAllowed = !blockedDays.includes(dayOfMonth);

    if (!isAllowed) {
      return {
        allowed: false,
        message: `KYC submission is not allowed on dates 1, 9, 10, 19, 20, 29, 30 and 31 of each month. Today is ${dayOfMonth}. Please try again on another date.`
      };
    }

    return { allowed: true };
  }

  /**
   * Submit KYC documents and profile information
   * Deducts fee from wallet before submission
   */
  static async submitKYC(userId: bigint, data: {
    phone?: string;
    date_of_birth?: Date | string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    bank_account_no?: string;
    bank_ifsc?: string;
    bank_name?: string;
    bank_branch?: string;
    bank_ac_holder?: string;
    bank_upi?: string;
    pan_number?: string;
    aadhar_number?: string;
    documents: Array<{
      document_type: 'aadhar' | 'pan' | 'passport' | 'driving_license' | 'bank_statement' | 'others';
      document_number?: string;
      front_image_url?: string;
      back_image_url?: string;
    }>;
  }) {
    // Check if KYC submission is allowed on current date
    const dateCheck = this.isKYCSubmissionAllowed();
    if (!dateCheck.allowed) {
      const error: any = new Error(dateCheck.message || 'KYC submission not allowed on this date');
      error.code = 'KYC_SUBMISSION_NOT_ALLOWED';
      throw error;
    }

    // KYC fee will be deducted even if wallet goes negative
    // User will recover from commissions after package activation
    const ALLOW_NEGATIVE_FOR_KYC = true;
    
    // Check fee rule exists and get amount
    const feeCheck = await FeeService.checkFeeApplicable(userId, 'KYC_SUBMISSION', ALLOW_NEGATIVE_FOR_KYC);
    if (!feeCheck.applicable && feeCheck.amount === 0) {
      // Only fail if fee rule doesn't exist
      const error: any = new Error(feeCheck.message || 'KYC fee rule not configured');
      error.code = 'FEE_RULE_NOT_FOUND';
      throw error;
    }

    // Deduct fee - allow negative balance for KYC
    // User will recover from SELF/SPOT commissions after purchasing package
    try {
      await FeeService.deductFee(userId, 'KYC_SUBMISSION', null, 'kyc', ALLOW_NEGATIVE_FOR_KYC);
    } catch (error: any) {
      // Only re-throw if it's not an insufficient balance error
      // (we're allowing negative balance for KYC)
      if (error.code !== 'INSUFFICIENT_BALANCE') {
        throw error;
      }
    }

    return prisma.$transaction(async (tx) => {
      // Helper function to convert empty strings to null
      const toNullIfEmpty = (value: string | undefined | null): string | null => {
        if (value === undefined || value === null || value === '') {
          return null;
        }
        return value;
      };

      // Create or update user profile
      let dateOfBirth: Date | null = null;
      if (data.date_of_birth) {
        if (typeof data.date_of_birth === 'string') {
          // Handle ISO string or YYYY-MM-DD format
          dateOfBirth = new Date(data.date_of_birth);
          if (isNaN(dateOfBirth.getTime())) {
            throw new Error('Invalid date format for date_of_birth');
          }
        } else {
          dateOfBirth = data.date_of_birth;
        }
      }

      // Check if user profile exists, then create or update
      const existingProfile = await tx.user_profiles.findUnique({
        where: { user_id: userId },
      });

      if (existingProfile) {
        // Update existing profile
        await tx.user_profiles.update({
          where: { user_id: userId },
          data: {
            phone: data.phone !== undefined ? toNullIfEmpty(data.phone) : undefined,
            date_of_birth: dateOfBirth ?? undefined,
            address: data.address !== undefined ? toNullIfEmpty(data.address) : undefined,
            city: data.city !== undefined ? toNullIfEmpty(data.city) : undefined,
            state: data.state !== undefined ? toNullIfEmpty(data.state) : undefined,
            pincode: data.pincode !== undefined ? toNullIfEmpty(data.pincode) : undefined,
            bank_account_no: data.bank_account_no !== undefined ? toNullIfEmpty(data.bank_account_no) : undefined,
            bank_ifsc: data.bank_ifsc !== undefined ? toNullIfEmpty(data.bank_ifsc) : undefined,
            bank_name: data.bank_name !== undefined ? toNullIfEmpty(data.bank_name) : undefined,
            bank_branch: data.bank_branch !== undefined ? toNullIfEmpty(data.bank_branch) : undefined,
            bank_ac_holder: data.bank_ac_holder !== undefined ? toNullIfEmpty(data.bank_ac_holder) : undefined,
            bank_upi: data.bank_upi !== undefined ? toNullIfEmpty(data.bank_upi) : undefined,
            pan_number: data.pan_number !== undefined ? toNullIfEmpty(data.pan_number) : undefined,
            aadhar_number: data.aadhar_number !== undefined ? toNullIfEmpty(data.aadhar_number) : undefined,
            updated_at: new Date(),
          },
        });
      } else {
        // Create new profile
        await tx.user_profiles.create({
          data: {
            user_id: userId,
            phone: toNullIfEmpty(data.phone),
            date_of_birth: dateOfBirth,
            address: toNullIfEmpty(data.address),
            city: toNullIfEmpty(data.city),
            state: toNullIfEmpty(data.state),
            pincode: toNullIfEmpty(data.pincode),
            bank_account_no: toNullIfEmpty(data.bank_account_no),
            bank_ifsc: toNullIfEmpty(data.bank_ifsc),
            bank_name: toNullIfEmpty(data.bank_name),
            bank_branch: toNullIfEmpty(data.bank_branch),
            bank_ac_holder: toNullIfEmpty(data.bank_ac_holder),
            bank_upi: toNullIfEmpty(data.bank_upi),
            pan_number: toNullIfEmpty(data.pan_number),
            aadhar_number: toNullIfEmpty(data.aadhar_number),
          },
        });
      }

      // Create KYC documents
      for (const doc of data.documents) {
        await tx.kyc_documents.create({
          data: {
            user_id: userId,
            document_type: doc.document_type,
            document_number: doc.document_number ?? null,
            front_image_url: doc.front_image_url ?? null,
            back_image_url: doc.back_image_url ?? null,
            status: 'submitted',
          },
        });
      }

      // Update user KYC status
      await tx.users.update({
        where: { id: userId },
        data: {
          kyc_status: 'submitted',
        },
      });

      return { success: true };
    });
  }

  /**
   * Get KYC status for a user
   */
  static async getKYCStatus(userId: bigint) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kyc_status: true,
        kyc_verified_at: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const documents = await prisma.kyc_documents.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        document_type: true,
        document_number: true,
        status: true,
        rejection_reason: true,
        submitted_at: true,
        verified_at: true,
      },
      orderBy: { submitted_at: 'desc' },
    });

    return {
      user_id: user.id.toString(),
      kyc_status: user.kyc_status,
      kyc_verified_at: user.kyc_verified_at,
      documents,
    };
  }

  /**
   * Get user profile (only if KYC is approved)
   */
  static async getUserProfile(userId: bigint) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        kyc_status: true,
        kyc_verified_at: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // KYC approval no longer required for profile viewing
    // Profile data is available regardless of KYC status
    const profile = await prisma.user_profiles.findUnique({
      where: { user_id: userId },
    });

    return {
      user_id: user.id.toString(),
      name: user.name,
      email: user.email,
      kyc_status: user.kyc_status,
      kyc_verified_at: user.kyc_verified_at,
      profile: profile ? {
        phone: profile.phone,
        date_of_birth: profile.date_of_birth,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        pincode: profile.pincode,
        bank_account_no: profile.bank_account_no,
        bank_ifsc: profile.bank_ifsc,
        bank_name: profile.bank_name,
        pan_number: profile.pan_number,
        aadhar_number: profile.aadhar_number,
      } : null,
    };
  }

  /**
   * Get pending KYC submissions (Admin)
   * Returns same shape as /profiles items so admin KYC page can use for "KYC Requests" tab
   * without depending on paginated getAllProfiles (which can miss users).
   */
  static async getPendingKYCs() {
    const users = await prisma.users.findMany({
      where: {
        kyc_status: 'submitted',
      },
      select: {
        id: true,
        display_id: true,
        name: true,
        email: true,
        kyc_status: true,
        kyc_verified_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const userIds = users.map(u => u.id);

    const [userProfiles, kycDocs] = await Promise.all([
      prisma.user_profiles.findMany({
        where: { user_id: { in: userIds } },
      }),
      prisma.kyc_documents.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true, submitted_at: true },
        orderBy: { submitted_at: 'asc' },
      }),
    ]);

    const profileMap = new Map(userProfiles.map(p => [p.user_id.toString(), p]));
    const kycDocMap = new Map<string, Date | null>();
    for (const doc of kycDocs) {
      const uid = doc.user_id.toString();
      if (!kycDocMap.has(uid) || (doc.submitted_at && (!kycDocMap.get(uid) || doc.submitted_at < kycDocMap.get(uid)!))) {
        kycDocMap.set(uid, doc.submitted_at);
      }
    }

    return users.map(user => {
      const userProfile = profileMap.get(user.id.toString());
      const submittedAt = kycDocMap.get(user.id.toString()) || null;
      return {
        user_id: user.id.toString(),
        display_id: user.display_id,
        name: user.name,
        email: user.email,
        kyc_status: user.kyc_status,
        kyc_verified_at: user.kyc_verified_at,
        created_at: user.created_at,
        submitted_at: submittedAt,
        profile: userProfile
          ? {
              phone: userProfile.phone,
              account_holder: userProfile.bank_ac_holder || user.name,
              date_of_birth: userProfile.date_of_birth,
              address: userProfile.address,
              city: userProfile.city,
              state: userProfile.state,
              pincode: userProfile.pincode,
              bank_account_no: userProfile.bank_account_no,
              bank_ifsc: userProfile.bank_ifsc,
              bank_name: userProfile.bank_name,
              bank_branch: userProfile.bank_branch,
              pan_number: userProfile.pan_number,
              aadhar_number: userProfile.aadhar_number,
            }
          : null,
      };
    });
  }

  /**
   * Approve user KYC (Admin)
   */
  static async approveKYC(userId: bigint, adminUserId?: bigint) {
    return prisma.$transaction(async (tx) => {
      // Update user KYC status
      await tx.users.update({
        where: { id: userId },
        data: {
          kyc_status: 'approved',
          kyc_verified_at: new Date(),
        },
      });

      // Update all documents status
      await tx.kyc_documents.updateMany({
        where: {
          user_id: userId,
          status: { in: ['pending', 'submitted'] },
        },
        data: {
          status: 'approved',
          verified_at: new Date(),
          verified_by: adminUserId ?? null,
        },
      });

      return { success: true };
    });
  }

  /**
   * Reject user KYC (Admin)
   */
  static async rejectKYC(userId: bigint, reason: string, adminUserId?: bigint) {
    return prisma.$transaction(async (tx) => {
      // Update user KYC status
      await tx.users.update({
        where: { id: userId },
        data: {
          kyc_status: 'rejected',
        },
      });

      // Update all submitted documents with rejection reason
      await tx.kyc_documents.updateMany({
        where: {
          user_id: userId,
          status: { in: ['pending', 'submitted'] },
        },
        data: {
          status: 'rejected',
          rejection_reason: reason,
          verified_at: new Date(),
          verified_by: adminUserId ?? null,
        },
      });

      return { success: true };
    });
  }

  /**
   * Get all user profiles (Admin)
   * Returns all users with their profiles (only approved profiles have full details)
   */
  static async getAllProfiles() {
    const users = await prisma.users.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        kyc_status: true,
        kyc_verified_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const userIds = users.map(u => u.id);
    const profiles = await prisma.user_profiles.findMany({
      where: {
        user_id: { in: userIds },
      },
    });

    const profileMap = new Map(profiles.map(p => [p.user_id.toString(), p]));

    return users.map(user => {
      const profile = profileMap.get(user.id.toString());
      return {
        user_id: user.id.toString(),
        name: user.name,
        email: user.email,
        kyc_status: user.kyc_status,
        kyc_verified_at: user.kyc_verified_at,
        created_at: user.created_at,
        // Profile data available regardless of KYC status
        profile: profile ? {
          phone: profile.phone,
          date_of_birth: profile.date_of_birth,
          address: profile.address,
          city: profile.city,
          state: profile.state,
          pincode: profile.pincode,
          bank_account_no: profile.bank_account_no,
          bank_ifsc: profile.bank_ifsc,
          bank_name: profile.bank_name,
          pan_number: profile.pan_number,
          aadhar_number: profile.aadhar_number,
        } : null,
      };
    });
  }

  /**
   * Get all KYC documents for a user (Admin)
   */
  static async getUserDocuments(userId: bigint) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        kyc_status: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const documents = await prisma.kyc_documents.findMany({
      where: { user_id: userId },
      orderBy: { submitted_at: 'desc' },
    });

    return {
      user: {
        user_id: user.id.toString(),
        name: user.name,
        email: user.email,
        kyc_status: user.kyc_status,
      },
      documents: documents.map(doc => ({
        id: doc.id.toString(),
        document_type: doc.document_type,
        document_number: doc.document_number,
        front_image_url: doc.front_image_url,
        back_image_url: doc.back_image_url,
        status: doc.status,
        rejection_reason: doc.rejection_reason,
        submitted_at: doc.submitted_at,
        verified_at: doc.verified_at,
        verified_by: doc.verified_by?.toString(),
      })),
    };
  }
}

