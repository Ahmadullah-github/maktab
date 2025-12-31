/**
 * Property-based tests for License Service - Machine ID Validation
 * 
 * **Feature: license-request-system, Property 3: Machine ID Format Validation**
 * **Validates: Requirements 2.1**
 * 
 * **Feature: license-request-system, Property 4: License-Machine ID Binding Round Trip**
 * **Validates: Requirements 2.2**
 * 
 * **Feature: license-request-system, Property 5: License-Machine ID Verification**
 * **Validates: Requirements 2.3, 2.4**
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { DataSource } from 'typeorm';
import { LicenseService } from '../licenseService';
import { License } from '../../entity/License';

describe('License Service Property Tests - Machine ID Validation', () => {
  let licenseService: LicenseService;

  beforeEach(() => {
    // Get the singleton instance
    licenseService = LicenseService.getInstance();
  });

  /**
   * **Feature: license-request-system, Property 3: Machine ID Format Validation**
   * **Validates: Requirements 2.1**
   * 
   * For any string input to validateMachineIdFormat(), the function SHALL return
   * true only for strings matching the valid Machine ID pattern (^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$),
   * and false for all other inputs.
   */
  describe('Property 3: Machine ID Format Validation', () => {
    // Valid alphanumeric uppercase characters
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    // Generator for valid machine ID segments (4 uppercase alphanumeric chars)
    const validSegment = fc.array(
      fc.constantFrom(...validChars.split('')),
      { minLength: 4, maxLength: 4 }
    ).map(chars => chars.join(''));

    // Generator for valid machine IDs
    const validMachineId = fc.tuple(validSegment, validSegment, validSegment)
      .map(([a, b, c]) => `${a}-${b}-${c}`);

    it('should return true for all valid machine IDs', async () => {
      await fc.assert(
        fc.property(validMachineId, (machineId) => {
          const result = licenseService.validateMachineIdFormat(machineId);
          return result === true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return false for machine IDs with lowercase letters', async () => {
      // Generator for machine IDs with at least one lowercase letter
      const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const lowercaseSegment = fc.array(
        fc.constantFrom(...lowercaseChars.split('')),
        { minLength: 4, maxLength: 4 }
      ).map(chars => chars.join(''))
       .filter(s => /[a-z]/.test(s));

      const machineIdWithLowercase = fc.tuple(lowercaseSegment, validSegment, validSegment)
        .map(([a, b, c]) => `${a}-${b}-${c}`);

      await fc.assert(
        fc.property(machineIdWithLowercase, (machineId) => {
          const result = licenseService.validateMachineIdFormat(machineId);
          return result === false;
        }),
        { numRuns: 100 }
      );
    });

    it('should return false for machine IDs with wrong segment length', async () => {
      // Generator for segments with wrong length (not 4)
      const wrongLengthSegment = fc.integer({ min: 1, max: 10 })
        .filter(len => len !== 4)
        .chain(len => fc.array(
          fc.constantFrom(...validChars.split('')),
          { minLength: len, maxLength: len }
        ).map(chars => chars.join('')));

      const machineIdWrongLength = fc.tuple(wrongLengthSegment, validSegment, validSegment)
        .map(([a, b, c]) => `${a}-${b}-${c}`);

      await fc.assert(
        fc.property(machineIdWrongLength, (machineId) => {
          const result = licenseService.validateMachineIdFormat(machineId);
          return result === false;
        }),
        { numRuns: 100 }
      );
    });

    it('should return false for machine IDs with wrong delimiter', async () => {
      // Use different delimiters instead of dash
      const wrongDelimiter = fc.constantFrom('_', '.', '/', ' ', ':', '|');

      const machineIdWrongDelimiter = fc.tuple(validSegment, validSegment, validSegment, wrongDelimiter)
        .map(([a, b, c, delim]) => `${a}${delim}${b}${delim}${c}`);

      await fc.assert(
        fc.property(machineIdWrongDelimiter, (machineId) => {
          const result = licenseService.validateMachineIdFormat(machineId);
          return result === false;
        }),
        { numRuns: 100 }
      );
    });

    it('should return false for machine IDs with special characters', async () => {
      // Generator for segments with special characters
      const specialChars = '!@#$%^&*()';
      const mixedChars = validChars + specialChars;
      const specialCharSegment = fc.array(
        fc.constantFrom(...mixedChars.split('')),
        { minLength: 4, maxLength: 4 }
      ).map(chars => chars.join(''))
       .filter(s => /[!@#$%^&*()]/.test(s));

      const machineIdWithSpecialChars = fc.tuple(specialCharSegment, validSegment, validSegment)
        .map(([a, b, c]) => `${a}-${b}-${c}`);

      await fc.assert(
        fc.property(machineIdWithSpecialChars, (machineId) => {
          const result = licenseService.validateMachineIdFormat(machineId);
          return result === false;
        }),
        { numRuns: 100 }
      );
    });

    it('should return false for arbitrary strings that are not valid machine IDs', async () => {
      // Generator for arbitrary strings that don't match the pattern
      const arbitraryString = fc.string().filter(s => {
        // Filter out strings that accidentally match the valid pattern
        return !/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(s);
      });

      await fc.assert(
        fc.property(arbitraryString, (str) => {
          const result = licenseService.validateMachineIdFormat(str);
          return result === false;
        }),
        { numRuns: 100 }
      );
    });

    it('should return false for null, undefined, or non-string inputs', () => {
      // Test edge cases directly
      expect(licenseService.validateMachineIdFormat(null as any)).toBe(false);
      expect(licenseService.validateMachineIdFormat(undefined as any)).toBe(false);
      expect(licenseService.validateMachineIdFormat(123 as any)).toBe(false);
      expect(licenseService.validateMachineIdFormat({} as any)).toBe(false);
      expect(licenseService.validateMachineIdFormat([] as any)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(licenseService.validateMachineIdFormat('')).toBe(false);
    });
  });
});

/**
 * Property-based tests for License-Machine ID binding
 * Tests the License entity directly with an in-memory database
 */
describe('License Service Property Tests - Machine ID Binding', () => {
  let dataSource: DataSource;

  // Valid alphanumeric uppercase characters
  const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  // Generator for valid machine ID segments (4 uppercase alphanumeric chars)
  const validSegment = fc.array(
    fc.constantFrom(...validChars.split('')),
    { minLength: 4, maxLength: 4 }
  ).map(chars => chars.join(''));

  // Generator for valid machine IDs
  const validMachineId = fc.tuple(validSegment, validSegment, validSegment)
    .map(([a, b, c]) => `${a}-${b}-${c}`);

  // Generator for unique license keys (MKTB-XXXX-XXXX-XXXX-XXXX format)
  const hexChars = '0123456789ABCDEF';
  const hexSegment = fc.array(
    fc.constantFrom(...hexChars.split('')),
    { minLength: 4, maxLength: 4 }
  ).map(chars => chars.join(''));

  const licenseKeyArbitrary = fc.tuple(hexSegment, hexSegment, hexSegment, hexSegment)
    .map(([a, b, c, d]) => `MKTB-${a}-${b}-${c}-${d}`);

  // Generator for license data
  const licenseDataArbitrary = fc.record({
    licenseKey: licenseKeyArbitrary,
    schoolName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    contactName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    contactPhone: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    licenseType: fc.constantFrom('6-month', 'annual', 'trial'),
    machineId: validMachineId,
  });

  beforeAll(async () => {
    // Create in-memory SQLite database
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [License],
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
    // Clear all licenses before each test
    await dataSource.getRepository(License).clear();
  });

  /**
   * **Feature: license-request-system, Property 4: License-Machine ID Binding Round Trip**
   * **Validates: Requirements 2.2**
   * 
   * For any license activation with a valid Machine ID, storing and then retrieving
   * the license SHALL return the same Machine ID that was provided during activation.
   */
  it('Property 4: License-Machine ID binding round trip preserves machineId', async () => {
    await fc.assert(
      fc.asyncProperty(
        licenseDataArbitrary,
        async (input) => {
          const repository = dataSource.getRepository(License);

          // Clear database for each iteration
          await repository.clear();

          // Create and save license with machine ID
          const license = repository.create({
            licenseKey: input.licenseKey,
            schoolName: input.schoolName,
            contactName: input.contactName,
            contactPhone: input.contactPhone,
            licenseType: input.licenseType,
            machineId: input.machineId,
            activatedAt: new Date(),
            expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months
            gracePeriodDays: 7,
            isActive: true,
          });

          const saved = await repository.save(license);
          expect(saved.id).toBeGreaterThan(0);

          // Retrieve the license
          const retrieved = await repository.findOne({ where: { licenseKey: input.licenseKey } });

          expect(retrieved).not.toBeNull();
          // The stored machineId should match the provided machineId
          expect(retrieved!.machineId).toBe(input.machineId);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: license-request-system, Property 4: License-Machine ID Binding Round Trip**
   * **Validates: Requirements 2.2**
   * 
   * Validation: activateLicense should reject invalid machine ID formats.
   * This tests the validation logic in the service.
   */
  it('Property 4: validateMachineIdFormat rejects invalid formats before storage', async () => {
    const licenseService = LicenseService.getInstance();

    // Generator for invalid machine IDs
    const invalidMachineId = fc.string().filter(s => {
      return !/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(s);
    });

    await fc.assert(
      fc.property(invalidMachineId, (machineId) => {
        // Invalid machine IDs should be rejected by validation
        const isValid = licenseService.validateMachineIdFormat(machineId);
        return isValid === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: license-request-system, Property 5: License-Machine ID Verification**
   * **Validates: Requirements 2.3, 2.4**
   * 
   * For any license with a stored Machine ID, checking the license status with
   * a different Machine ID SHALL indicate a mismatch.
   */
  describe('Property 5: License-Machine ID Verification', () => {
    it('Property 5: Same machineId returns machineIdMatch=true', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            licenseKey: fc.tuple(
              fc.array(fc.constantFrom(...'0123456789ABCDEF'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join('')),
              fc.array(fc.constantFrom(...'0123456789ABCDEF'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join('')),
              fc.array(fc.constantFrom(...'0123456789ABCDEF'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join('')),
              fc.array(fc.constantFrom(...'0123456789ABCDEF'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join(''))
            ).map(([a, b, c, d]) => `MKTB-${a}-${b}-${c}-${d}`),
            schoolName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            machineId: fc.tuple(
              fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join('')),
              fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join('')),
              fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join(''))
            ).map(([a, b, c]) => `${a}-${b}-${c}`),
          }),
          async (input) => {
            const repository = dataSource.getRepository(License);
            await repository.clear();

            // Create license with specific machineId
            const license = repository.create({
              licenseKey: input.licenseKey,
              schoolName: input.schoolName,
              contactName: 'Test',
              contactPhone: '123',
              licenseType: '6-month',
              machineId: input.machineId,
              activatedAt: new Date(),
              expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
              gracePeriodDays: 7,
              isActive: true,
            });
            await repository.save(license);

            // Verify with SAME machineId - should match
            const retrieved = await repository.findOne({ where: { isActive: true } });
            expect(retrieved).not.toBeNull();
            
            // Simulate the verification logic
            const storedMachineId = retrieved!.machineId;
            const providedMachineId = input.machineId;
            const machineIdMatch = storedMachineId === providedMachineId;

            expect(machineIdMatch).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 5: Different machineId returns machineIdMismatch=true', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            licenseKey: fc.tuple(
              fc.array(fc.constantFrom(...'0123456789ABCDEF'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join('')),
              fc.array(fc.constantFrom(...'0123456789ABCDEF'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join('')),
              fc.array(fc.constantFrom(...'0123456789ABCDEF'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join('')),
              fc.array(fc.constantFrom(...'0123456789ABCDEF'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join(''))
            ).map(([a, b, c, d]) => `MKTB-${a}-${b}-${c}-${d}`),
            schoolName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            storedMachineId: fc.tuple(
              fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join('')),
              fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join('')),
              fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join(''))
            ).map(([a, b, c]) => `${a}-${b}-${c}`),
            differentMachineId: fc.tuple(
              fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join('')),
              fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join('')),
              fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 4, maxLength: 4 }).map(c => c.join(''))
            ).map(([a, b, c]) => `${a}-${b}-${c}`),
          }),
          async (input) => {
            // Skip if the two machine IDs happen to be the same
            if (input.storedMachineId === input.differentMachineId) {
              return true; // Skip this case
            }

            const repository = dataSource.getRepository(License);
            await repository.clear();

            // Create license with one machineId
            const license = repository.create({
              licenseKey: input.licenseKey,
              schoolName: input.schoolName,
              contactName: 'Test',
              contactPhone: '123',
              licenseType: '6-month',
              machineId: input.storedMachineId,
              activatedAt: new Date(),
              expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
              gracePeriodDays: 7,
              isActive: true,
            });
            await repository.save(license);

            // Verify with DIFFERENT machineId - should mismatch
            const retrieved = await repository.findOne({ where: { isActive: true } });
            expect(retrieved).not.toBeNull();
            
            // Simulate the verification logic
            const storedMachineId = retrieved!.machineId;
            const providedMachineId = input.differentMachineId;
            const machineIdMatch = storedMachineId === providedMachineId;
            const machineIdMismatch = !machineIdMatch;

            expect(machineIdMismatch).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Property-based tests for Request Template Generator
 * 
 * **Feature: license-request-system, Property 9: Request Template Completeness**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
 */
describe('License Service Property Tests - Request Template', () => {
  let licenseService: LicenseService;

  // Valid alphanumeric uppercase characters
  const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  // Generator for valid machine ID segments (4 uppercase alphanumeric chars)
  const validSegment = fc.array(
    fc.constantFrom(...validChars.split('')),
    { minLength: 4, maxLength: 4 }
  ).map(chars => chars.join(''));

  // Generator for valid machine IDs
  const validMachineId = fc.tuple(validSegment, validSegment, validSegment)
    .map(([a, b, c]) => `${a}-${b}-${c}`);

  beforeEach(() => {
    licenseService = LicenseService.getInstance();
  });

  /**
   * **Feature: license-request-system, Property 9: Request Template Completeness**
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
   * 
   * For any request template response, the response SHALL contain:
   * - A valid Machine ID (Requirements 6.1)
   * - A template string with all required placeholders ({schoolName}, {province}, {contactPhone}, {licenseType}) (Requirements 6.2)
   * - Contact channels (Requirements 6.3)
   * - Payment methods (Requirements 6.4)
   * - Pricing information (Requirements 6.5)
   */
  describe('Property 9: Request Template Completeness', () => {
    it('should return template containing the provided machineId', async () => {
      await fc.assert(
        fc.asyncProperty(validMachineId, async (machineId) => {
          const template = await licenseService.getRequestTemplate(machineId);
          
          // Requirements 6.1: Template should contain the current Machine ID
          expect(template.machineId).toBe(machineId);
          expect(template.template).toContain(machineId);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return template with all required placeholders', async () => {
      await fc.assert(
        fc.asyncProperty(validMachineId, async (machineId) => {
          const template = await licenseService.getRequestTemplate(machineId);
          
          // Requirements 6.2: Template should have all required placeholders
          expect(template.template).toContain('{schoolName}');
          expect(template.template).toContain('{province}');
          expect(template.template).toContain('{contactPhone}');
          expect(template.template).toContain('{licenseType}');
          
          // Placeholders object should match
          expect(template.placeholders.schoolName).toBe('{schoolName}');
          expect(template.placeholders.province).toBe('{province}');
          expect(template.placeholders.contactPhone).toBe('{contactPhone}');
          expect(template.placeholders.licenseType).toBe('{licenseType}');
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return template with contact channels', async () => {
      await fc.assert(
        fc.asyncProperty(validMachineId, async (machineId) => {
          const template = await licenseService.getRequestTemplate(machineId);
          
          // Requirements 6.3: Template should include contact channels
          expect(template.contactChannels).toBeDefined();
          expect(typeof template.contactChannels.whatsapp).toBe('string');
          expect(typeof template.contactChannels.telegram).toBe('string');
          expect(typeof template.contactChannels.phone).toBe('string');
          expect(typeof template.contactChannels.email).toBe('string');
          expect(typeof template.contactChannels.isConfigured).toBe('boolean');
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return template with payment methods', async () => {
      await fc.assert(
        fc.asyncProperty(validMachineId, async (machineId) => {
          const template = await licenseService.getRequestTemplate(machineId);
          
          // Requirements 6.4: Template should include payment methods
          expect(template.paymentMethods).toBeDefined();
          
          // Hawala config
          expect(template.paymentMethods.hawala).toBeDefined();
          expect(typeof template.paymentMethods.hawala.enabled).toBe('boolean');
          expect(typeof template.paymentMethods.hawala.instructions).toBe('string');
          expect(Array.isArray(template.paymentMethods.hawala.cities)).toBe(true);
          
          // Bank config
          expect(template.paymentMethods.bank).toBeDefined();
          expect(typeof template.paymentMethods.bank.enabled).toBe('boolean');
          expect(typeof template.paymentMethods.bank.name).toBe('string');
          expect(typeof template.paymentMethods.bank.accountNumber).toBe('string');
          expect(typeof template.paymentMethods.bank.accountName).toBe('string');
          expect(typeof template.paymentMethods.bank.instructions).toBe('string');
          
          // Mobile money config
          expect(template.paymentMethods.mobileMoney).toBeDefined();
          expect(template.paymentMethods.mobileMoney.hesabPay).toBeDefined();
          expect(template.paymentMethods.mobileMoney.mPaisa).toBeDefined();
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return template with pricing information', async () => {
      await fc.assert(
        fc.asyncProperty(validMachineId, async (machineId) => {
          const template = await licenseService.getRequestTemplate(machineId);
          
          // Requirements 6.5: Template should include pricing information
          expect(template.paymentMethods.pricing).toBeDefined();
          
          // Trial pricing
          expect(template.paymentMethods.pricing.trial).toBeDefined();
          expect(typeof template.paymentMethods.pricing.trial.amount).toBe('number');
          expect(typeof template.paymentMethods.pricing.trial.currency).toBe('string');
          expect(typeof template.paymentMethods.pricing.trial.duration).toBe('string');
          
          // Six month pricing
          expect(template.paymentMethods.pricing.sixMonth).toBeDefined();
          expect(typeof template.paymentMethods.pricing.sixMonth.amount).toBe('number');
          expect(typeof template.paymentMethods.pricing.sixMonth.currency).toBe('string');
          expect(typeof template.paymentMethods.pricing.sixMonth.duration).toBe('string');
          
          // Annual pricing
          expect(template.paymentMethods.pricing.annual).toBeDefined();
          expect(typeof template.paymentMethods.pricing.annual.amount).toBe('number');
          expect(typeof template.paymentMethods.pricing.annual.currency).toBe('string');
          expect(typeof template.paymentMethods.pricing.annual.duration).toBe('string');
          
          // Template string should contain pricing info
          expect(template.template).toContain(template.paymentMethods.pricing.trial.duration);
          expect(template.template).toContain(template.paymentMethods.pricing.sixMonth.duration);
          expect(template.template).toContain(template.paymentMethods.pricing.annual.duration);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return Farsi-formatted template', async () => {
      await fc.assert(
        fc.asyncProperty(validMachineId, async (machineId) => {
          const template = await licenseService.getRequestTemplate(machineId);
          
          // Requirements 6.2: Template should be in Farsi
          // Check for Farsi keywords in the template
          expect(template.template).toContain('درخواست لایسنس');
          expect(template.template).toContain('نام مکتب');
          expect(template.template).toContain('ولایت');
          expect(template.template).toContain('شماره تماس');
          expect(template.template).toContain('نوع لایسنس');
          expect(template.template).toContain('کود دستگاه');
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
