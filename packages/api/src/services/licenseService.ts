import { AppDataSource } from "../../ormconfig";
import { License } from "../entity/License";
import { ContactRequest } from "../entity/ContactRequest";
import * as crypto from "crypto";
import { logger } from "../utils/logger";
import { ConfigurationService, ContactInfo, PaymentConfig } from "./configurationService";

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
  // Machine ID verification fields
  machineIdMatch?: boolean;      // true if provided machineId matches stored machineId
  machineIdMismatch?: boolean;   // true if provided machineId does NOT match stored machineId
  storedMachineId?: string;      // The machine ID stored with the license (for debugging)
}

/**
 * Request template for license requests
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export interface RequestTemplate {
  machineId: string;
  template: string; // Farsi template with placeholders
  contactChannels: ContactInfo;
  paymentMethods: PaymentConfig;
  placeholders: {
    schoolName: string;
    province: string;
    contactPhone: string;
    licenseType: string;
  };
}

export class LicenseService {
  private static instance: LicenseService;
  private cachedStatus: LicenseStatus | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 60 * 1000; // 1 minute cache

  // Machine ID format: XXXX-XXXX-XXXX (12 alphanumeric chars with 2 dashes)
  private static readonly MACHINE_ID_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

  /**
   * Get contact information from ConfigurationService
   * Falls back to environment variables if not configured in database
   * Requirements: 5.1, 5.3
   * @deprecated Use ConfigurationService.getInstance().getContactInfo() directly
   */
  public static readonly CONTACT_INFO: ContactInfo = {
    whatsapp: process.env.CONTACT_WHATSAPP || "+93XXXXXXXXX",
    telegram: process.env.CONTACT_TELEGRAM || "@your_telegram",
    phone: process.env.CONTACT_PHONE || "+93XXXXXXXXX",
    email: process.env.CONTACT_EMAIL || "your@email.com",
    isConfigured: false, // Static fallback, not configured from database
  };

  /**
   * Get contact information dynamically from ConfigurationService
   * This method should be used instead of the static CONTACT_INFO
   * Requirements: 5.1, 5.3
   */
  async getContactInfo(): Promise<ContactInfo> {
    const configService = ConfigurationService.getInstance();
    return configService.getContactInfo();
  }

  private constructor() {}

  /**
   * Validate Machine ID format
   * Format: XXXX-XXXX-XXXX (12 alphanumeric uppercase characters with 2 dashes)
   * @param machineId - The machine ID to validate
   * @returns true if valid, false otherwise
   */
  validateMachineIdFormat(machineId: string): boolean {
    if (!machineId || typeof machineId !== 'string') {
      return false;
    }
    return LicenseService.MACHINE_ID_PATTERN.test(machineId);
  }

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
   * Get machine fingerprint for offline validation (full hash)
   */
  getMachineId(): string {
    // In Electron, you'd use system info. For now, use a simple hash
    const os = require("os");
    const data = `${os.hostname()}-${os.platform()}-${os.arch()}`;
    return crypto.createHash("sha256").update(data).digest("hex").substring(0, 32);
  }

  /**
   * Get server-generated machine ID in short format (XXXX-XXXX-XXXX)
   * Used as fallback for non-Electron environments
   * Requirements: 1.4
   */
  getServerMachineId(): string {
    const os = require("os");
    // Generate a consistent hash from system info
    const data = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model || 'unknown'}`;
    const hash = crypto.createHash("sha256").update(data).digest("hex").toUpperCase();
    // Format as XXXX-XXXX-XXXX (12 chars with 2 dashes)
    return `${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
  }

  /**
   * Activate a new license
   * @param licenseKey - The license key to activate
   * @param schoolName - Name of the school
   * @param contactName - Contact person name
   * @param contactPhone - Contact phone number
   * @param licenseType - Type of license (6-month, annual, trial)
   * @param machineId - Machine ID to bind the license to (format: XXXX-XXXX-XXXX)
   */
  async activateLicense(
    licenseKey: string,
    schoolName: string,
    contactName: string,
    contactPhone: string,
    licenseType: "6-month" | "annual" | "trial",
    machineId: string
  ): Promise<{ success: boolean; message: string; license?: License }> {
    try {
      // Validate machine ID format before activation
      if (!this.validateMachineIdFormat(machineId)) {
        return { 
          success: false, 
          message: "فرمت کود دستگاه نامعتبر است" // Invalid machine ID format
        };
      }

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
      license.machineId = machineId; // Store the provided machine ID
      license.isActive = true;

      const saved = await repo.save(license);
      this.clearCache();

      return {
        success: true,
        message: "لایسنس با موفقیت فعال شد",
        license: saved,
      };
    } catch (error) {
      logger.error("Error activating license", error instanceof Error ? error : new Error(String(error)));
      return { success: false, message: "خطا در فعال‌سازی لایسنس" };
    }
  }

  /**
   * Check current license status
   * @param machineId - Optional machine ID to verify against stored machine ID
   */
  async checkLicenseStatus(machineId?: string): Promise<LicenseStatus> {
    // Return cached status if valid and no machineId verification needed
    if (this.cachedStatus && Date.now() < this.cacheExpiry && !machineId) {
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

      // Machine ID verification
      let machineIdMatch: boolean | undefined;
      let machineIdMismatch: boolean | undefined;
      
      if (machineId) {
        // Compare provided machineId with stored machineId
        const storedMachineId = license.machineId || '';
        machineIdMatch = storedMachineId === machineId;
        machineIdMismatch = !machineIdMatch;
      }

      let status: LicenseStatus;

      // Check for machine ID mismatch first - this invalidates the license
      if (machineIdMismatch) {
        status = {
          isValid: false,
          isExpired: false,
          isInGracePeriod: false,
          daysRemaining,
          graceDaysRemaining: license.gracePeriodDays,
          licenseType: license.licenseType,
          expiresAt: license.expiresAt,
          schoolName: license.schoolName,
          message: "این لایسنس برای دستگاه دیگری ثبت شده است", // License registered for another device
          messageType: "blocked",
          machineIdMatch: false,
          machineIdMismatch: true,
          storedMachineId: license.machineId,
        };
        // Don't cache machine ID mismatch status
        return status;
      }

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
          machineIdMatch,
          machineIdMismatch,
          storedMachineId: machineId ? license.machineId : undefined,
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
          machineIdMatch,
          machineIdMismatch,
          storedMachineId: machineId ? license.machineId : undefined,
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
          machineIdMatch,
          machineIdMismatch,
          storedMachineId: machineId ? license.machineId : undefined,
        };
      }

      // Only cache if no machineId was provided (base status)
      if (!machineId) {
        this.setCachedStatus(status);
      }
      return status;
    } catch (error) {
      logger.error("Error checking license", error instanceof Error ? error : new Error(String(error)));
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
   * Enhanced with province, machineId, and payment information
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   * 
   * @param schoolName - Name of the school
   * @param contactName - Contact person name
   * @param contactPhone - Contact phone number
   * @param preferredMethod - Preferred contact method
   * @param requestType - Type of request
   * @param message - Optional message
   * @param province - Province/city of the school (ولایت)
   * @param machineId - Device identifier for license binding
   * @param paymentMethod - Payment method used
   * @param paymentReference - Hawala code or transaction ID
   * @param paymentAmount - Amount paid in AFN
   */
  async submitContactRequest(
    schoolName: string,
    contactName: string,
    contactPhone: string,
    preferredMethod: "whatsapp" | "telegram" | "call" | "sms",
    requestType: "renewal" | "new_license" | "support" | "upgrade",
    message?: string,
    province?: string,
    machineId?: string,
    paymentMethod?: "hawala" | "ghazanfar_bank" | "hesab_pay" | "m_paisa",
    paymentReference?: string,
    paymentAmount?: number
  ): Promise<{ success: boolean; message: string; contactInfo: ContactInfo }> {
    // Get contact info from ConfigurationService (Requirements: 5.1, 5.3)
    const configService = ConfigurationService.getInstance();
    let contactInfo: ContactInfo;
    
    try {
      contactInfo = await configService.getContactInfo();
    } catch {
      // Fallback to static contact info if ConfigurationService fails
      contactInfo = LicenseService.CONTACT_INFO;
    }

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
      
      // Store new fields (Requirements: 3.1, 3.2, 3.3, 3.4, 3.5)
      request.province = province || "";
      request.machineId = machineId || "";
      request.paymentMethod = paymentMethod || "";
      request.paymentReference = paymentReference || "";
      request.paymentAmount = paymentAmount || 0;

      await repo.save(request);

      // Return contact info based on preferred method (using dynamic config)
      let contactMessage = "";
      switch (preferredMethod) {
        case "whatsapp":
          contactMessage = `برای تماس از طریق واتساپ با شماره ${contactInfo.whatsapp} پیام دهید.`;
          break;
        case "telegram":
          contactMessage = `برای تماس از طریق تلگرام به ${contactInfo.telegram} پیام دهید.`;
          break;
        case "call":
          contactMessage = `برای تماس تلفنی با شماره ${contactInfo.phone} تماس بگیرید.`;
          break;
        case "sms":
          contactMessage = `برای ارسال پیامک به شماره ${contactInfo.phone} پیام دهید.`;
          break;
      }

      return {
        success: true,
        message: `درخواست شما ثبت شد. ${contactMessage}`,
        contactInfo,
      };
    } catch (error) {
      logger.error("Error submitting contact request", error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        message: "خطا در ثبت درخواست",
        contactInfo,
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
      logger.error("Error deactivating license", error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get license request template with Farsi message and all configuration
   * @param machineId - The machine ID to include in the template
   * @returns RequestTemplate with template string, contact channels, and payment methods
   * 
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
   */
  async getRequestTemplate(machineId: string): Promise<RequestTemplate> {
    const configService = ConfigurationService.getInstance();
    
    // Get contact and payment configuration
    const contactChannels = await configService.getContactInfo();
    const paymentMethods = await configService.getPaymentConfig();

    // Build pricing info string for template
    const pricingInfo = `
- آزمایشی: ${paymentMethods.pricing.trial.duration} - رایگان
- شش ماهه: ${paymentMethods.pricing.sixMonth.duration} - ${paymentMethods.pricing.sixMonth.amount} ${paymentMethods.pricing.sixMonth.currency}
- سالانه: ${paymentMethods.pricing.annual.duration} - ${paymentMethods.pricing.annual.amount} ${paymentMethods.pricing.annual.currency}`;

    // Build payment methods info for template
    const paymentMethodsInfo: string[] = [];
    if (paymentMethods.hawala.enabled) {
      paymentMethodsInfo.push(`حواله: ${paymentMethods.hawala.cities.join('، ')}`);
    }
    if (paymentMethods.bank.enabled) {
      paymentMethodsInfo.push(`بانک: ${paymentMethods.bank.name}`);
    }
    if (paymentMethods.mobileMoney.hesabPay.enabled) {
      paymentMethodsInfo.push('حساب پی');
    }
    if (paymentMethods.mobileMoney.mPaisa.enabled) {
      paymentMethodsInfo.push('ام‌پیسه');
    }

    // Build contact channels info for template
    const contactInfo: string[] = [];
    if (contactChannels.whatsapp && !contactChannels.whatsapp.includes('XXXX')) {
      contactInfo.push(`واتساپ: ${contactChannels.whatsapp}`);
    }
    if (contactChannels.telegram && !contactChannels.telegram.includes('your_')) {
      contactInfo.push(`تلگرام: ${contactChannels.telegram}`);
    }
    if (contactChannels.phone && !contactChannels.phone.includes('XXXX')) {
      contactInfo.push(`تلفن: ${contactChannels.phone}`);
    }

    // Farsi template with placeholders
    // Requirements: 6.2 - Farsi-formatted template string with placeholders
    const template = `درخواست لایسنس نرم‌افزار مکتب

کود دستگاه: ${machineId}

نام مکتب: {schoolName}
ولایت: {province}
شماره تماس: {contactPhone}
نوع لایسنس: {licenseType}

قیمت‌ها:${pricingInfo}

روش‌های پرداخت: ${paymentMethodsInfo.join(' | ')}

راه‌های ارتباطی:
${contactInfo.join('\n')}`;

    return {
      machineId,
      template,
      contactChannels,
      paymentMethods,
      placeholders: {
        schoolName: '{schoolName}',
        province: '{province}',
        contactPhone: '{contactPhone}',
        licenseType: '{licenseType}',
      },
    };
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
