import { AppDataSource } from "../../ormconfig";
import { License } from "../entity/License";
import { ContactRequest } from "../entity/ContactRequest";
import * as crypto from "crypto";

export interface LicenseStatus {
  isValid: boolean;
  isExpired: boolean;
  isInGracePeriod: boolean;
  daysRemaining: number;
  graceDaysRemaining: number;
  licenseType: string;
  expiresAt: Date | null;
  schoolName: string;
  message: string;
  messageType: "success" | "warning" | "error" | "blocked";
}

export interface ContactInfo {
  whatsapp: string;
  telegram: string;
  phone: string;
  email: string;
}

export class LicenseService {
  private static instance: LicenseService;
  private cachedStatus: LicenseStatus | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 60 * 1000; // 1 minute cache

  // Developer contact information - UPDATE THESE WITH YOUR REAL CONTACT INFO
  public static readonly CONTACT_INFO: ContactInfo = {
    whatsapp: "+93XXXXXXXXX", // TODO: Add your WhatsApp number
    telegram: "@your_telegram", // TODO: Add your Telegram handle
    phone: "+93XXXXXXXXX", // TODO: Add your phone number
    email: "your@email.com", // TODO: Add your email
  };

  private constructor() {}

  public static getInstance(): LicenseService {
    if (!LicenseService.instance) {
      LicenseService.instance = new LicenseService();
    }
    return LicenseService.instance;
  }

  /**
   * Generate a unique license key
   */
  generateLicenseKey(): string {
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(
        crypto.randomBytes(2).toString("hex").toUpperCase()
      );
    }
    return `MKTB-${segments.join("-")}`; // e.g., MKTB-A1B2-C3D4-E5F6-G7H8
  }

  /**
   * Get machine fingerprint for offline validation
   */
  getMachineId(): string {
    // In Electron, you'd use system info. For now, use a simple hash
    const os = require("os");
    const data = `${os.hostname()}-${os.platform()}-${os.arch()}`;
    return crypto.createHash("sha256").update(data).digest("hex").substring(0, 32);
  }

  /**
   * Activate a new license
   */
  async activateLicense(
    licenseKey: string,
    schoolName: string,
    contactName: string,
    contactPhone: string,
    licenseType: "6-month" | "annual" | "trial"
  ): Promise<{ success: boolean; message: string; license?: License }> {
    try {
      const repo = AppDataSource.getRepository(License);

      // Check if license key already exists
      const existing = await repo.findOneBy({ licenseKey });
      if (existing) {
        return { success: false, message: "این کلید لایسنس قبلاً فعال شده است" };
      }

      // Calculate expiry date
      const now = new Date();
      let expiresAt = new Date();
      
      switch (licenseType) {
        case "trial":
          expiresAt.setDate(now.getDate() + 14); // 14 days trial
          break;
        case "6-month":
          expiresAt.setMonth(now.getMonth() + 6);
          break;
        case "annual":
          expiresAt.setFullYear(now.getFullYear() + 1);
          break;
      }

      const license = new License();
      license.licenseKey = licenseKey;
      license.schoolName = schoolName;
      license.contactName = contactName;
      license.contactPhone = contactPhone;
      license.licenseType = licenseType;
      license.activatedAt = now;
      license.expiresAt = expiresAt;
      license.gracePeriodDays = licenseType === "trial" ? 0 : 7;
      license.machineId = this.getMachineId();
      license.isActive = true;

      const saved = await repo.save(license);
      this.clearCache();

      return {
        success: true,
        message: "لایسنس با موفقیت فعال شد",
        license: saved,
      };
    } catch (error) {
      console.error("Error activating license:", error);
      return { success: false, message: "خطا در فعال‌سازی لایسنس" };
    }
  }

  /**
   * Check current license status
   */
  async checkLicenseStatus(): Promise<LicenseStatus> {
    // Return cached status if valid
    if (this.cachedStatus && Date.now() < this.cacheExpiry) {
      return this.cachedStatus;
    }

    try {
      const repo = AppDataSource.getRepository(License);
      const license = await repo.findOne({
        where: { isActive: true },
        order: { createdAt: "DESC" },
      });

      if (!license) {
        const status: LicenseStatus = {
          isValid: false,
          isExpired: true,
          isInGracePeriod: false,
          daysRemaining: 0,
          graceDaysRemaining: 0,
          licenseType: "",
          expiresAt: null,
          schoolName: "",
          message: "لایسنس فعالی یافت نشد. لطفاً لایسنس خود را فعال کنید.",
          messageType: "blocked",
        };
        this.setCachedStatus(status);
        return status;
      }

      const now = new Date();
      const expiresAt = new Date(license.expiresAt);
      const graceEndDate = new Date(expiresAt);
      graceEndDate.setDate(graceEndDate.getDate() + license.gracePeriodDays);

      const msPerDay = 24 * 60 * 60 * 1000;
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay);
      const graceDaysRemaining = Math.ceil((graceEndDate.getTime() - now.getTime()) / msPerDay);

      let status: LicenseStatus;

      if (now < expiresAt) {
        // License is valid
        let messageType: "success" | "warning" = "success";
        let message = `لایسنس فعال - ${daysRemaining} روز باقی‌مانده`;
        
        if (daysRemaining <= 30) {
          messageType = "warning";
          message = `لایسنس شما ${daysRemaining} روز دیگر منقضی می‌شود. لطفاً برای تمدید اقدام کنید.`;
        }

        status = {
          isValid: true,
          isExpired: false,
          isInGracePeriod: false,
          daysRemaining,
          graceDaysRemaining: license.gracePeriodDays,
          licenseType: license.licenseType,
          expiresAt: license.expiresAt,
          schoolName: license.schoolName,
          message,
          messageType,
        };
      } else if (now < graceEndDate) {
        // In grace period
        status = {
          isValid: true, // Still allow usage during grace period
          isExpired: true,
          isInGracePeriod: true,
          daysRemaining: 0,
          graceDaysRemaining,
          licenseType: license.licenseType,
          expiresAt: license.expiresAt,
          schoolName: license.schoolName,
          message: `لایسنس منقضی شده! ${graceDaysRemaining} روز مهلت تمدید باقی‌مانده. لطفاً فوراً برای تمدید اقدام کنید.`,
          messageType: "warning",
        };
      } else {
        // License fully expired
        status = {
          isValid: false,
          isExpired: true,
          isInGracePeriod: false,
          daysRemaining: 0,
          graceDaysRemaining: 0,
          licenseType: license.licenseType,
          expiresAt: license.expiresAt,
          schoolName: license.schoolName,
          message: "لایسنس شما منقضی شده است. برای ادامه استفاده، لطفاً لایسنس جدید تهیه کنید.",
          messageType: "blocked",
        };
      }

      this.setCachedStatus(status);
      return status;
    } catch (error) {
      console.error("Error checking license:", error);
      return {
        isValid: false,
        isExpired: true,
        isInGracePeriod: false,
        daysRemaining: 0,
        graceDaysRemaining: 0,
        licenseType: "",
        expiresAt: null,
        schoolName: "",
        message: "خطا در بررسی لایسنس",
        messageType: "error",
      };
    }
  }

  /**
   * Submit a contact request for renewal/support
   */
  async submitContactRequest(
    schoolName: string,
    contactName: string,
    contactPhone: string,
    preferredMethod: "whatsapp" | "telegram" | "call" | "sms",
    requestType: "renewal" | "new_license" | "support" | "upgrade",
    message?: string
  ): Promise<{ success: boolean; message: string; contactInfo: ContactInfo }> {
    try {
      const repo = AppDataSource.getRepository(ContactRequest);
      
      // Get current license key if exists
      const licenseRepo = AppDataSource.getRepository(License);
      const currentLicense = await licenseRepo.findOne({
        where: { isActive: true },
        order: { createdAt: "DESC" },
      });

      const request = new ContactRequest();
      request.schoolName = schoolName;
      request.contactName = contactName;
      request.contactPhone = contactPhone;
      request.preferredMethod = preferredMethod;
      request.requestType = requestType;
      request.message = message || "";
      request.currentLicenseKey = currentLicense?.licenseKey || "";

      await repo.save(request);

      // Return contact info based on preferred method
      let contactMessage = "";
      switch (preferredMethod) {
        case "whatsapp":
          contactMessage = `برای تماس از طریق واتساپ با شماره ${LicenseService.CONTACT_INFO.whatsapp} پیام دهید.`;
          break;
        case "telegram":
          contactMessage = `برای تماس از طریق تلگرام به ${LicenseService.CONTACT_INFO.telegram} پیام دهید.`;
          break;
        case "call":
          contactMessage = `برای تماس تلفنی با شماره ${LicenseService.CONTACT_INFO.phone} تماس بگیرید.`;
          break;
        case "sms":
          contactMessage = `برای ارسال پیامک به شماره ${LicenseService.CONTACT_INFO.phone} پیام دهید.`;
          break;
      }

      return {
        success: true,
        message: `درخواست شما ثبت شد. ${contactMessage}`,
        contactInfo: LicenseService.CONTACT_INFO,
      };
    } catch (error) {
      console.error("Error submitting contact request:", error);
      return {
        success: false,
        message: "خطا در ثبت درخواست",
        contactInfo: LicenseService.CONTACT_INFO,
      };
    }
  }

  /**
   * Get all contact requests (for admin)
   */
  async getContactRequests(): Promise<ContactRequest[]> {
    const repo = AppDataSource.getRepository(ContactRequest);
    return repo.find({ order: { createdAt: "DESC" } });
  }

  /**
   * Get current license info
   */
  async getCurrentLicense(): Promise<License | null> {
    const repo = AppDataSource.getRepository(License);
    return repo.findOne({
      where: { isActive: true },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Deactivate current license
   */
  async deactivateLicense(): Promise<boolean> {
    try {
      const repo = AppDataSource.getRepository(License);
      const license = await repo.findOne({
        where: { isActive: true },
        order: { createdAt: "DESC" },
      });

      if (license) {
        license.isActive = false;
        await repo.save(license);
        this.clearCache();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deactivating license:", error);
      return false;
    }
  }

  private setCachedStatus(status: LicenseStatus): void {
    this.cachedStatus = status;
    this.cacheExpiry = Date.now() + this.CACHE_TTL;
  }

  private clearCache(): void {
    this.cachedStatus = null;
    this.cacheExpiry = 0;
  }
}
