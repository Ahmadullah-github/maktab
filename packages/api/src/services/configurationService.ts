/**
 * Configuration Service for managing payment and contact information
 * 
 * Provides typed access to configuration stored in the Configuration entity.
 * Supports environment variable fallbacks for initial setup.
 * 
 * Requirements: 4.4, 4.5, 5.2, 5.3
 */

import { AppDataSource } from "../../ormconfig";
import { Configuration } from "../entity/Configuration";
import { logger } from "../utils/logger";

/**
 * Contact information for license requests
 * Requirements: 5.1, 5.2
 */
export interface ContactInfo {
  whatsapp: string;
  telegram: string;
  phone: string;
  email: string;
  isConfigured: boolean; // false if using placeholders/defaults
}

/**
 * Hawala payment configuration
 * Requirements: 4.1
 */
export interface HawalaConfig {
  enabled: boolean;
  instructions: string; // Farsi instructions
  cities: string[]; // Available cities for hawala
}

/**
 * Bank payment configuration
 * Requirements: 4.2
 */
export interface BankConfig {
  enabled: boolean;
  name: string; // Bank name (e.g., "Ghazanfar Bank")
  accountNumber: string;
  accountName: string;
  instructions: string; // Farsi instructions
}

/**
 * Mobile money payment configuration
 */
export interface MobileMoneyConfig {
  hesabPay: { enabled: boolean; instructions: string };
  mPaisa: { enabled: boolean; instructions: string };
}

/**
 * License pricing configuration
 * Requirements: 4.3
 */
export interface PricingConfig {
  trial: { amount: number; currency: string; duration: string };
  sixMonth: { amount: number; currency: string; duration: string };
  annual: { amount: number; currency: string; duration: string };
}


/**
 * Complete payment configuration
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export interface PaymentConfig {
  hawala: HawalaConfig;
  bank: BankConfig;
  mobileMoney: MobileMoneyConfig;
  pricing: PricingConfig;
}

// Configuration keys
const CONFIG_KEYS = {
  CONTACT_INFO: 'license.contactInfo',
  PAYMENT_CONFIG: 'license.paymentConfig',
} as const;

// Default contact info (placeholders)
const DEFAULT_CONTACT_INFO: ContactInfo = {
  whatsapp: process.env.CONTACT_WHATSAPP || '+93XXXXXXXXX',
  telegram: process.env.CONTACT_TELEGRAM || '@your_telegram',
  phone: process.env.CONTACT_PHONE || '+93XXXXXXXXX',
  email: process.env.CONTACT_EMAIL || 'your@email.com',
  isConfigured: false,
};

// Default payment configuration with Farsi instructions
// Requirements: 4.1, 4.2, 4.3
const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  hawala: {
    enabled: true,
    instructions: `برای پرداخت از طریق حواله (صرافی):

۱. به نزدیک‌ترین صرافی در شهر خود مراجعه کنید
۲. مبلغ مورد نظر را به نام "مکتب سافت" حواله کنید
۳. کود حواله (رسید) را از صرافی دریافت کنید
۴. کود حواله را همراه با درخواست لایسنس ارسال کنید

شهرهای موجود برای دریافت حواله: کابل، هرات، مزار شریف، قندهار، جلال آباد

توجه: لطفاً کود حواله را تا تأیید لایسنس نگهداری کنید.`,
    cities: ['کابل', 'هرات', 'مزار شریف', 'قندهار', 'جلال آباد'],
  },
  bank: {
    enabled: true,
    name: 'غضنفر بانک',
    accountNumber: 'XXXX-XXXX-XXXX-XXXX', // Placeholder - update with real account
    accountName: 'مکتب سافت', // Placeholder - update with real account name
    instructions: `برای پرداخت از طریق غضنفر بانک:

۱. به نزدیک‌ترین شعبه غضنفر بانک مراجعه کنید
۲. مبلغ را به حساب ذیل انتقال دهید:
   - نام حساب: مکتب سافت
   - شماره حساب: XXXX-XXXX-XXXX-XXXX
۳. رسید بانکی را دریافت و عکس بگیرید
۴. شماره رسید را همراه با درخواست لایسنس ارسال کنید

توجه: انتقال بانکی ممکن است ۱-۲ روز کاری زمان ببرد.`,
  },
  mobileMoney: {
    hesabPay: {
      enabled: false,
      instructions: `برای پرداخت از طریق حساب پی:

۱. اپلیکیشن حساب پی را باز کنید
۲. گزینه "انتقال وجه" را انتخاب کنید
۳. مبلغ را به شماره ذیل انتقال دهید
۴. شماره تراکنش را ذخیره کنید

توجه: این روش پرداخت فعلاً غیرفعال است.`,
    },
    mPaisa: {
      enabled: false,
      instructions: `برای پرداخت از طریق ام‌پیسه:

۱. کود *789# را شماره‌گیری کنید
۲. گزینه "انتقال پول" را انتخاب کنید
۳. مبلغ را به شماره ذیل انتقال دهید
۴. کود تأیید را ذخیره کنید

توجه: این روش پرداخت فعلاً غیرفعال است.`,
    },
  },
  pricing: {
    trial: { 
      amount: 0, 
      currency: 'AFN', 
      duration: '۱۴ روز',
    },
    sixMonth: { 
      amount: 5000, 
      currency: 'AFN', 
      duration: '۶ ماه',
    },
    annual: { 
      amount: 8000, 
      currency: 'AFN', 
      duration: '۱ سال',
    },
  },
};

/**
 * Configuration Service
 * 
 * Manages payment and contact configuration with database persistence
 * and environment variable fallbacks.
 * 
 * Requirements: 4.4, 4.5, 5.2, 5.3
 */
export class ConfigurationService {
  private static instance: ConfigurationService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  /**
   * Get a configuration value by key with type safety
   * @param key - Configuration key
   * @param defaultValue - Default value if not found
   * @returns The configuration value or default
   * 
   * Requirements: 4.4, 4.5, 5.2, 5.3
   */
  async get<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const repo = AppDataSource.getRepository(Configuration);
      const config = await repo.findOne({ where: { key } });

      if (!config) {
        logger.debug('Configuration not found, using default', { key });
        return defaultValue;
      }

      try {
        const parsed = JSON.parse(config.value) as T;
        logger.debug('Retrieved configuration', { key });
        return parsed;
      } catch {
        // If JSON parsing fails, return the raw value if it matches type
        logger.warn('Failed to parse configuration as JSON', { key });
        return defaultValue;
      }
    } catch (error) {
      logger.error('Error getting configuration', error instanceof Error ? error : new Error(String(error)));
      return defaultValue;
    }
  }

  /**
   * Set a configuration value by key
   * @param key - Configuration key
   * @param value - Value to store (will be JSON serialized)
   * 
   * Requirements: 4.4, 5.2
   */
  async set<T>(key: string, value: T): Promise<void> {
    try {
      const repo = AppDataSource.getRepository(Configuration);
      const now = new Date();

      let config = await repo.findOne({ where: { key } });

      if (!config) {
        config = new Configuration();
        config.key = key;
        config.createdAt = now;
        logger.debug('Creating new configuration', { key });
      } else {
        logger.debug('Updating existing configuration', { key });
      }

      config.value = JSON.stringify(value);
      config.updatedAt = now;

      await repo.save(config);
      logger.info('Saved configuration', { key });
    } catch (error) {
      logger.error('Error saving configuration', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }


  /**
   * Get contact information
   * Returns configured values from database, or falls back to env vars/defaults
   * 
   * Requirements: 5.1, 5.2, 5.4
   */
  async getContactInfo(): Promise<ContactInfo> {
    const stored = await this.get<Omit<ContactInfo, 'isConfigured'>>(
      CONFIG_KEYS.CONTACT_INFO,
      {
        whatsapp: DEFAULT_CONTACT_INFO.whatsapp,
        telegram: DEFAULT_CONTACT_INFO.telegram,
        phone: DEFAULT_CONTACT_INFO.phone,
        email: DEFAULT_CONTACT_INFO.email,
      }
    );

    // Check if we're using defaults (not configured)
    const isConfigured = await this.isContactInfoConfigured();

    return {
      ...stored,
      isConfigured,
    };
  }

  /**
   * Set contact information
   * 
   * Requirements: 5.2
   */
  async setContactInfo(info: Omit<ContactInfo, 'isConfigured'>): Promise<void> {
    await this.set(CONFIG_KEYS.CONTACT_INFO, {
      whatsapp: info.whatsapp,
      telegram: info.telegram,
      phone: info.phone,
      email: info.email,
    });
  }

  /**
   * Check if contact info has been explicitly configured
   * @returns true if configured in database, false if using defaults
   * 
   * Requirements: 5.4
   */
  private async isContactInfoConfigured(): Promise<boolean> {
    try {
      const repo = AppDataSource.getRepository(Configuration);
      const config = await repo.findOne({ where: { key: CONFIG_KEYS.CONTACT_INFO } });
      return config !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get payment configuration
   * Returns configured values from database, or falls back to defaults
   * 
   * Requirements: 4.1, 4.2, 4.3, 4.4
   */
  async getPaymentConfig(): Promise<PaymentConfig> {
    return this.get<PaymentConfig>(CONFIG_KEYS.PAYMENT_CONFIG, DEFAULT_PAYMENT_CONFIG);
  }

  /**
   * Set payment configuration
   * 
   * Requirements: 4.4
   */
  async setPaymentConfig(config: PaymentConfig): Promise<void> {
    await this.set(CONFIG_KEYS.PAYMENT_CONFIG, config);
  }

  /**
   * Get default contact info (for reference)
   */
  getDefaultContactInfo(): ContactInfo {
    return { ...DEFAULT_CONTACT_INFO };
  }

  /**
   * Get default payment config (for reference)
   */
  getDefaultPaymentConfig(): PaymentConfig {
    return JSON.parse(JSON.stringify(DEFAULT_PAYMENT_CONFIG));
  }
}
