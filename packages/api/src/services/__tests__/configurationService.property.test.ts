/**
 * Property-based tests for Configuration Service
 * 
 * **Feature: license-request-system, Property 8: Contact Info Configuration Round Trip**
 * **Validates: Requirements 5.1, 5.2**
 * 
 * **Feature: license-request-system, Property 7: Payment Configuration Round Trip**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DataSource } from 'typeorm';
import { Configuration } from '../../entity/Configuration';

// In-memory SQLite database for testing
let dataSource: DataSource;

/**
 * ContactInfo interface (matches configurationService.ts)
 */
interface ContactInfo {
  whatsapp: string;
  telegram: string;
  phone: string;
  email: string;
  isConfigured?: boolean;
}

/**
 * PaymentConfig interface (matches configurationService.ts)
 */
interface PaymentConfig {
  hawala: {
    enabled: boolean;
    instructions: string;
    cities: string[];
  };
  bank: {
    enabled: boolean;
    name: string;
    accountNumber: string;
    accountName: string;
    instructions: string;
  };
  mobileMoney: {
    hesabPay: { enabled: boolean; instructions: string };
    mPaisa: { enabled: boolean; instructions: string };
  };
  pricing: {
    trial: { amount: number; currency: string; duration: string };
    sixMonth: { amount: number; currency: string; duration: string };
    annual: { amount: number; currency: string; duration: string };
  };
}


describe('Configuration Service Property Tests', () => {
  beforeAll(async () => {
    // Create in-memory SQLite database for testing
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [Configuration],
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clear all configurations before each test
    await dataSource.getRepository(Configuration).clear();
  });

  /**
   * Helper function to save configuration (mimics ConfigurationService.set)
   */
  async function saveConfig<T>(key: string, value: T): Promise<void> {
    const repo = dataSource.getRepository(Configuration);
    const now = new Date();

    let config = await repo.findOne({ where: { key } });

    if (!config) {
      config = new Configuration();
      config.key = key;
      config.createdAt = now;
    }

    config.value = JSON.stringify(value);
    config.updatedAt = now;

    await repo.save(config);
  }

  /**
   * Helper function to get configuration (mimics ConfigurationService.get)
   */
  async function getConfig<T>(key: string, defaultValue: T): Promise<T> {
    const repo = dataSource.getRepository(Configuration);
    const config = await repo.findOne({ where: { key } });

    if (!config) {
      return defaultValue;
    }

    try {
      return JSON.parse(config.value) as T;
    } catch {
      return defaultValue;
    }
  }


  /**
   * **Feature: license-request-system, Property 8: Contact Info Configuration Round Trip**
   * **Validates: Requirements 5.1, 5.2**
   * 
   * For any contact information (WhatsApp, Telegram, phone, email), storing and then
   * retrieving the configuration SHALL return equivalent values.
   */
  describe('Property 8: Contact Info Configuration Round Trip', () => {
    const CONFIG_KEY = 'license.contactInfo';

    // Generator for valid phone numbers (international format)
    const phoneArbitrary = fc.array(
      fc.constantFrom(...'0123456789'.split('')),
      { minLength: 9, maxLength: 15 }
    ).map((digits: string[]) => `+${digits.join('')}`);

    // Generator for valid telegram handles
    const telegramArbitrary = fc.array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_'.split('')),
      { minLength: 3, maxLength: 32 }
    ).map((chars: string[]) => `@${chars.join('')}`);

    // Generator for valid email addresses
    const emailArbitrary = fc.tuple(
      fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 20 }).map((c: string[]) => c.join('')),
      fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 2, maxLength: 10 }).map((c: string[]) => c.join('')),
      fc.constantFrom('com', 'org', 'net', 'af', 'io')
    ).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

    // Generator for contact info (without isConfigured - that's computed)
    const contactInfoArbitrary = fc.record({
      whatsapp: phoneArbitrary,
      telegram: telegramArbitrary,
      phone: phoneArbitrary,
      email: emailArbitrary,
    });

    it('should preserve contact info through set/get round trip', async () => {
      await fc.assert(
        fc.asyncProperty(contactInfoArbitrary, async (input) => {
          // Clear database for each iteration
          await dataSource.getRepository(Configuration).clear();

          // Set contact info
          await saveConfig(CONFIG_KEY, input);

          // Get contact info
          const retrieved = await getConfig<Omit<ContactInfo, 'isConfigured'>>(CONFIG_KEY, {
            whatsapp: '',
            telegram: '',
            phone: '',
            email: '',
          });

          // Verify round trip preserves values
          expect(retrieved.whatsapp).toBe(input.whatsapp);
          expect(retrieved.telegram).toBe(input.telegram);
          expect(retrieved.phone).toBe(input.phone);
          expect(retrieved.email).toBe(input.email);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return defaults when no contact info is stored', async () => {
      // Clear database - no config stored
      await dataSource.getRepository(Configuration).clear();

      const defaultValue = {
        whatsapp: '+93000000000',
        telegram: '@default',
        phone: '+93000000000',
        email: 'default@example.com',
      };

      const retrieved = await getConfig<Omit<ContactInfo, 'isConfigured'>>(CONFIG_KEY, defaultValue);

      // Should return defaults
      expect(retrieved.whatsapp).toBe(defaultValue.whatsapp);
      expect(retrieved.telegram).toBe(defaultValue.telegram);
      expect(retrieved.phone).toBe(defaultValue.phone);
      expect(retrieved.email).toBe(defaultValue.email);
    });

    it('should handle multiple set operations correctly (last write wins)', async () => {
      await fc.assert(
        fc.asyncProperty(
          contactInfoArbitrary,
          contactInfoArbitrary,
          async (first, second) => {
            // Clear database
            await dataSource.getRepository(Configuration).clear();

            // Set first contact info
            await saveConfig(CONFIG_KEY, first);
            
            // Set second contact info (should overwrite)
            await saveConfig(CONFIG_KEY, second);

            // Get should return the second (latest) values
            const retrieved = await getConfig<Omit<ContactInfo, 'isConfigured'>>(CONFIG_KEY, {
              whatsapp: '',
              telegram: '',
              phone: '',
              email: '',
            });

            expect(retrieved.whatsapp).toBe(second.whatsapp);
            expect(retrieved.telegram).toBe(second.telegram);
            expect(retrieved.phone).toBe(second.phone);
            expect(retrieved.email).toBe(second.email);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });


  /**
   * **Feature: license-request-system, Property 7: Payment Configuration Round Trip**
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   * 
   * For any payment configuration (hawala instructions, bank details, pricing),
   * storing and then retrieving the configuration SHALL return equivalent values.
   */
  describe('Property 7: Payment Configuration Round Trip', () => {
    const CONFIG_KEY = 'license.paymentConfig';

    // Generator for text
    const textArbitrary = fc.string({ minLength: 10, maxLength: 200 });

    // Generator for city names
    const cityArbitrary = fc.string({ minLength: 2, maxLength: 30 });

    // Generator for account numbers
    const accountNumberArbitrary = fc.array(
      fc.constantFrom(...'0123456789-'.split('')),
      { minLength: 10, maxLength: 25 }
    ).map((chars: string[]) => chars.join(''));

    // Generator for hawala config
    const hawalaConfigArbitrary = fc.record({
      enabled: fc.boolean(),
      instructions: textArbitrary,
      cities: fc.array(cityArbitrary, { minLength: 1, maxLength: 10 }),
    });

    // Generator for bank config
    const bankConfigArbitrary = fc.record({
      enabled: fc.boolean(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      accountNumber: accountNumberArbitrary,
      accountName: fc.string({ minLength: 1, maxLength: 100 }),
      instructions: textArbitrary,
    });

    // Generator for mobile money config
    const mobileMoneyConfigArbitrary = fc.record({
      hesabPay: fc.record({
        enabled: fc.boolean(),
        instructions: textArbitrary,
      }),
      mPaisa: fc.record({
        enabled: fc.boolean(),
        instructions: textArbitrary,
      }),
    });

    // Generator for pricing config
    const pricingConfigArbitrary = fc.record({
      trial: fc.record({
        amount: fc.integer({ min: 0, max: 0 }), // Trial is always free
        currency: fc.constant('AFN'),
        duration: fc.string({ minLength: 1, maxLength: 20 }),
      }),
      sixMonth: fc.record({
        amount: fc.integer({ min: 1000, max: 50000 }),
        currency: fc.constant('AFN'),
        duration: fc.string({ minLength: 1, maxLength: 20 }),
      }),
      annual: fc.record({
        amount: fc.integer({ min: 1000, max: 100000 }),
        currency: fc.constant('AFN'),
        duration: fc.string({ minLength: 1, maxLength: 20 }),
      }),
    });

    // Generator for complete payment config
    const paymentConfigArbitrary = fc.record({
      hawala: hawalaConfigArbitrary,
      bank: bankConfigArbitrary,
      mobileMoney: mobileMoneyConfigArbitrary,
      pricing: pricingConfigArbitrary,
    });

    it('should preserve payment config through set/get round trip', async () => {
      await fc.assert(
        fc.asyncProperty(paymentConfigArbitrary, async (input) => {
          // Clear database for each iteration
          await dataSource.getRepository(Configuration).clear();

          // Set payment config
          await saveConfig(CONFIG_KEY, input);

          // Get payment config
          const retrieved = await getConfig<PaymentConfig>(CONFIG_KEY, {} as PaymentConfig);

          // Verify hawala config
          expect(retrieved.hawala.enabled).toBe(input.hawala.enabled);
          expect(retrieved.hawala.instructions).toBe(input.hawala.instructions);
          expect(retrieved.hawala.cities).toEqual(input.hawala.cities);

          // Verify bank config
          expect(retrieved.bank.enabled).toBe(input.bank.enabled);
          expect(retrieved.bank.name).toBe(input.bank.name);
          expect(retrieved.bank.accountNumber).toBe(input.bank.accountNumber);
          expect(retrieved.bank.accountName).toBe(input.bank.accountName);
          expect(retrieved.bank.instructions).toBe(input.bank.instructions);

          // Verify mobile money config
          expect(retrieved.mobileMoney.hesabPay.enabled).toBe(input.mobileMoney.hesabPay.enabled);
          expect(retrieved.mobileMoney.hesabPay.instructions).toBe(input.mobileMoney.hesabPay.instructions);
          expect(retrieved.mobileMoney.mPaisa.enabled).toBe(input.mobileMoney.mPaisa.enabled);
          expect(retrieved.mobileMoney.mPaisa.instructions).toBe(input.mobileMoney.mPaisa.instructions);

          // Verify pricing config
          expect(retrieved.pricing.trial.amount).toBe(input.pricing.trial.amount);
          expect(retrieved.pricing.trial.currency).toBe(input.pricing.trial.currency);
          expect(retrieved.pricing.trial.duration).toBe(input.pricing.trial.duration);
          expect(retrieved.pricing.sixMonth.amount).toBe(input.pricing.sixMonth.amount);
          expect(retrieved.pricing.sixMonth.currency).toBe(input.pricing.sixMonth.currency);
          expect(retrieved.pricing.sixMonth.duration).toBe(input.pricing.sixMonth.duration);
          expect(retrieved.pricing.annual.amount).toBe(input.pricing.annual.amount);
          expect(retrieved.pricing.annual.currency).toBe(input.pricing.annual.currency);
          expect(retrieved.pricing.annual.duration).toBe(input.pricing.annual.duration);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return defaults when no payment config is stored', async () => {
      // Clear database - no config stored
      await dataSource.getRepository(Configuration).clear();

      const defaultConfig: PaymentConfig = {
        hawala: { enabled: true, instructions: 'default', cities: ['کابل'] },
        bank: { enabled: true, name: 'Default Bank', accountNumber: '0000', accountName: 'Default', instructions: 'default' },
        mobileMoney: {
          hesabPay: { enabled: false, instructions: 'default' },
          mPaisa: { enabled: false, instructions: 'default' },
        },
        pricing: {
          trial: { amount: 0, currency: 'AFN', duration: '14 days' },
          sixMonth: { amount: 5000, currency: 'AFN', duration: '6 months' },
          annual: { amount: 8000, currency: 'AFN', duration: '1 year' },
        },
      };

      const retrieved = await getConfig<PaymentConfig>(CONFIG_KEY, defaultConfig);

      // Should return defaults
      expect(retrieved.hawala.enabled).toBe(defaultConfig.hawala.enabled);
      expect(retrieved.bank.enabled).toBe(defaultConfig.bank.enabled);
      expect(retrieved.pricing.trial.amount).toBe(defaultConfig.pricing.trial.amount);
    });

    it('should handle multiple set operations correctly (last write wins)', async () => {
      await fc.assert(
        fc.asyncProperty(
          paymentConfigArbitrary,
          paymentConfigArbitrary,
          async (first, second) => {
            // Clear database
            await dataSource.getRepository(Configuration).clear();

            // Set first payment config
            await saveConfig(CONFIG_KEY, first);
            
            // Set second payment config (should overwrite)
            await saveConfig(CONFIG_KEY, second);

            // Get should return the second (latest) values
            const retrieved = await getConfig<PaymentConfig>(CONFIG_KEY, {} as PaymentConfig);

            // Verify it's the second config
            expect(retrieved.hawala.enabled).toBe(second.hawala.enabled);
            expect(retrieved.bank.name).toBe(second.bank.name);
            expect(retrieved.pricing.annual.amount).toBe(second.pricing.annual.amount);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
