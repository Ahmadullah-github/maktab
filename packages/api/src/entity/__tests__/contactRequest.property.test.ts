/**
 * Property-based tests for ContactRequest entity
 * 
 * **Feature: license-request-system, Property 6: Contact Request Round Trip**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DataSource } from 'typeorm';
import { ContactRequest } from '../ContactRequest';

// In-memory SQLite database for testing
let dataSource: DataSource;

/**
 * Generate valid payment method values
 */
const paymentMethodArbitrary = fc.constantFrom('hawala', 'ghazanfar_bank', 'hesab_pay', 'm_paisa', '');

/**
 * Generate valid machine ID format (XXXX-XXXX-XXXX)
 */
const alphanumericChar = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''));
const machineIdSegment = fc.array(alphanumericChar, { minLength: 4, maxLength: 4 }).map(chars => chars.join(''));
const machineIdArbitrary = fc.tuple(machineIdSegment, machineIdSegment, machineIdSegment)
  .map(([a, b, c]) => `${a}-${b}-${c}`);

/**
 * Generate valid ContactRequest input data with all new fields
 */
const contactRequestArbitrary = fc.record({
  schoolName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  contactName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  contactPhone: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  preferredMethod: fc.constantFrom('whatsapp', 'telegram', 'call', 'sms'),
  requestType: fc.constantFrom('renewal', 'new_license', 'support', 'upgrade'),
  message: fc.string({ maxLength: 500 }),
  currentLicenseKey: fc.string({ maxLength: 50 }),
  // New fields for enhanced license request system
  province: fc.string({ maxLength: 100 }),
  machineId: fc.oneof(machineIdArbitrary, fc.constant('')),
  paymentMethod: paymentMethodArbitrary,
  paymentReference: fc.string({ maxLength: 100 }),
  paymentAmount: fc.integer({ min: 0, max: 1000000 }),
  adminNotes: fc.string({ maxLength: 500 }),
});

describe('ContactRequest Entity Property Tests', () => {
  beforeAll(async () => {
    // Create in-memory SQLite database
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [ContactRequest],
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
    // Clear all contact requests before each test
    await dataSource.getRepository(ContactRequest).clear();
  });

  /**
   * **Feature: license-request-system, Property 6: Contact Request Round Trip**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
   * 
   * For any contact request submission with province, machineId, paymentMethod,
   * paymentReference, and paymentAmount, retrieving the contact request SHALL
   * return all fields with their original values.
   */
  it('Property 6: Contact request round trip preserves all fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        contactRequestArbitrary,
        async (input) => {
          const repository = dataSource.getRepository(ContactRequest);

          // Create and save contact request
          const contactRequest = repository.create({
            schoolName: input.schoolName,
            contactName: input.contactName,
            contactPhone: input.contactPhone,
            preferredMethod: input.preferredMethod,
            requestType: input.requestType,
            message: input.message,
            currentLicenseKey: input.currentLicenseKey,
            province: input.province,
            machineId: input.machineId,
            paymentMethod: input.paymentMethod,
            paymentReference: input.paymentReference,
            paymentAmount: input.paymentAmount,
            adminNotes: input.adminNotes,
          });

          const saved = await repository.save(contactRequest);
          expect(saved.id).toBeGreaterThan(0);

          // Retrieve the contact request
          const retrieved = await repository.findOne({ where: { id: saved.id } });
          expect(retrieved).not.toBeNull();

          // Verify all original fields are preserved
          expect(retrieved!.schoolName).toBe(input.schoolName);
          expect(retrieved!.contactName).toBe(input.contactName);
          expect(retrieved!.contactPhone).toBe(input.contactPhone);
          expect(retrieved!.preferredMethod).toBe(input.preferredMethod);
          expect(retrieved!.requestType).toBe(input.requestType);
          expect(retrieved!.message).toBe(input.message);
          expect(retrieved!.currentLicenseKey).toBe(input.currentLicenseKey);

          // Verify all NEW fields are preserved (Requirements 3.1-3.6)
          expect(retrieved!.province).toBe(input.province);           // Req 3.1
          expect(retrieved!.machineId).toBe(input.machineId);         // Req 3.2
          expect(retrieved!.paymentMethod).toBe(input.paymentMethod); // Req 3.3
          expect(retrieved!.paymentReference).toBe(input.paymentReference); // Req 3.4
          expect(retrieved!.paymentAmount).toBe(input.paymentAmount); // Req 3.5
          expect(retrieved!.adminNotes).toBe(input.adminNotes);       // Req 3.6 (admin notes for retrieval)

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: license-request-system, Property 6: Contact Request Round Trip**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
   * 
   * Multiple contact requests should be independently stored and retrieved
   * with all fields preserved.
   */
  it('Property 6: Multiple contact requests maintain independent data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(contactRequestArbitrary, { minLength: 2, maxLength: 10 }),
        async (inputs) => {
          const repository = dataSource.getRepository(ContactRequest);

          // Clear database at start of each property test iteration
          await repository.clear();

          // Save all contact requests
          const savedRequests: ContactRequest[] = [];
          for (const input of inputs) {
            const contactRequest = repository.create({
              schoolName: input.schoolName,
              contactName: input.contactName,
              contactPhone: input.contactPhone,
              preferredMethod: input.preferredMethod,
              requestType: input.requestType,
              message: input.message,
              currentLicenseKey: input.currentLicenseKey,
              province: input.province,
              machineId: input.machineId,
              paymentMethod: input.paymentMethod,
              paymentReference: input.paymentReference,
              paymentAmount: input.paymentAmount,
              adminNotes: input.adminNotes,
            });
            const saved = await repository.save(contactRequest);
            savedRequests.push(saved);
          }

          // Verify each request can be retrieved with correct data
          for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            const saved = savedRequests[i];
            const retrieved = await repository.findOne({ where: { id: saved.id } });

            expect(retrieved).not.toBeNull();
            expect(retrieved!.province).toBe(input.province);
            expect(retrieved!.machineId).toBe(input.machineId);
            expect(retrieved!.paymentMethod).toBe(input.paymentMethod);
            expect(retrieved!.paymentReference).toBe(input.paymentReference);
            expect(retrieved!.paymentAmount).toBe(input.paymentAmount);
            expect(retrieved!.adminNotes).toBe(input.adminNotes);
          }

          // Verify total count
          const count = await repository.count();
          expect(count).toBe(inputs.length);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
