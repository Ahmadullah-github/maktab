/**
 * License management routes
 * @module routes/license
 *
 * Requirements: 2.7
 * - All license-related endpoints
 * - These routes MUST be registered BEFORE the license middleware
 */

import { Request, Response, Router } from 'express';
import { ConfigurationService } from '../services/configurationService';
import { LicenseService } from '../services/licenseService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /license/status
 * Get current license status with optional machine ID verification
 * @query machineId - Optional machine ID to verify against stored machine ID
 * @returns Combined license status including trial info
 * Requirements: 2.3
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const machineId = req.query.machineId as string | undefined;
    const licenseService = LicenseService.getInstance();

    // Import DeviceTrialService dynamically to avoid circular deps
    const { DeviceTrialService } = await import('../services/deviceTrialService');
    const deviceTrialService = DeviceTrialService.getInstance();

    // Get license status (without machine ID check - we'll handle it in combined status)
    const licenseStatus = await licenseService.checkLicenseStatus();

    // Get or create trial status if machine ID provided
    let trialStatus = null;
    if (machineId) {
      trialStatus = await deviceTrialService.getOrCreateTrial(machineId);
    }

    // Determine combined status
    const combinedStatus = determineCombinedStatus(trialStatus, licenseStatus);

    // Always return 200 - soft blocking approach
    // The frontend will handle the status appropriately
    res.json(combinedStatus);
  } catch (error) {
    logger.error(
      'Error checking license status',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json({ error: 'Failed to check license status' });
  }
});

/**
 * Helper function to determine combined license status
 */
function determineCombinedStatus(trialStatus: any, licenseStatus: any) {
  // Case 1: Valid license (not expired)
  if (licenseStatus.isValid && !licenseStatus.isExpired) {
    const showWarning = licenseStatus.daysRemaining <= 30;
    return {
      mode: 'licensed' as const,
      isReadOnly: false,
      canGenerate: true,
      trial: trialStatus,
      license: licenseStatus,
      message: licenseStatus.message,
      messageType: showWarning ? 'warning' : 'success',
      showBanner: showWarning,
      bannerType: showWarning ? 'warning' : null,
    };
  }

  // Case 2: License in grace period
  if (licenseStatus.isValid && licenseStatus.isInGracePeriod) {
    return {
      mode: 'grace_period' as const,
      isReadOnly: false,
      canGenerate: true,
      trial: trialStatus,
      license: licenseStatus,
      message: licenseStatus.message,
      messageType: 'warning',
      showBanner: true,
      bannerType: 'warning',
    };
  }

  // Case 3: License expired (read-only mode)
  if (licenseStatus.isExpired && licenseStatus.licenseType) {
    return {
      mode: 'license_expired' as const,
      isReadOnly: true,
      canGenerate: false,
      trial: trialStatus,
      license: licenseStatus,
      message: 'لایسنس شما منقضی شده است. برنامه در حالت فقط خواندنی است.',
      messageType: 'error',
      showBanner: true,
      bannerType: 'readonly',
    };
  }

  // Case 4: Active trial (no license)
  if (trialStatus?.isTrialActive) {
    return {
      mode: 'trial' as const,
      isReadOnly: false,
      canGenerate: true,
      trial: trialStatus,
      license: licenseStatus,
      message: trialStatus.message,
      messageType: trialStatus.messageType === 'warning' ? 'warning' : 'info',
      showBanner: true,
      bannerType: 'info',
    };
  }

  // Case 5: Trial expired, no license (blocking banner, generate disabled)
  if (trialStatus?.isTrialExpired) {
    return {
      mode: 'trial_expired' as const,
      isReadOnly: false,
      canGenerate: false,
      trial: trialStatus,
      license: licenseStatus,
      message: 'دوره آزمایشی به پایان رسیده است. برای تولید جدول زمانی، لایسنس فعال کنید.',
      messageType: 'error',
      showBanner: true,
      bannerType: 'blocking',
    };
  }

  // Case 6: No trial, no license (first time - will create trial)
  return {
    mode: 'trial' as const,
    isReadOnly: false,
    canGenerate: true,
    trial: null,
    license: licenseStatus,
    message: 'دوره آزمایشی ۷ روزه شروع شد',
    messageType: 'info',
    showBanner: true,
    bannerType: 'info',
  };
}

/**
 * GET /license/contact-info
 * Get contact information for license support
 * Uses ConfigurationService for dynamic configuration
 * Requirements: 5.1
 */
router.get('/contact-info', async (_req: Request, res: Response) => {
  try {
    const configService = ConfigurationService.getInstance();
    const contactInfo = await configService.getContactInfo();
    res.json(contactInfo);
  } catch (error) {
    logger.error(
      'Error getting contact info',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json({ error: 'Failed to get contact info' });
  }
});

/**
 * GET /license/payment-info
 * Get payment configuration including hawala, bank, mobile money, and pricing
 * Returns PaymentConfig from ConfigurationService
 * Requirements: 4.1, 4.2, 4.3
 */
router.get('/payment-info', async (_req: Request, res: Response) => {
  try {
    const configService = ConfigurationService.getInstance();
    const paymentConfig = await configService.getPaymentConfig();
    res.json(paymentConfig);
  } catch (error) {
    logger.error(
      'Error getting payment info',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json({ error: 'Failed to get payment info' });
  }
});

/**
 * POST /license/activate
 * Activate a new license
 * @body licenseKey - The license key to activate
 * @body schoolName - Name of the school
 * @body contactName - Contact person name
 * @body contactPhone - Contact phone number
 * @body licenseType - Type of license (6-month, annual, trial)
 * @body machineId - Machine ID to bind the license to (format: XXXX-XXXX-XXXX)
 * Requirements: 2.1, 2.2
 */
router.post('/activate', async (req: Request, res: Response) => {
  try {
    const { licenseKey, schoolName, contactName, contactPhone, licenseType, machineId } = req.body;

    // Check for missing required fields
    if (!licenseKey || !schoolName || !contactName || !contactPhone || !licenseType || !machineId) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        success: false,
        message: 'تمام فیلدها الزامی هستند',
      });
    }

    const licenseService = LicenseService.getInstance();

    // Validate machine ID format before activation (Requirements: 2.1)
    if (!licenseService.validateMachineIdFormat(machineId)) {
      return res.status(400).json({
        error: 'INVALID_MACHINE_ID',
        success: false,
        message: 'فرمت کود دستگاه نامعتبر است',
      });
    }

    // Activate license with machine ID binding (Requirements: 2.2)
    const result = await licenseService.activateLicense(
      licenseKey,
      schoolName,
      contactName,
      contactPhone,
      licenseType,
      machineId
    );

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error(
      'Error activating license',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json({ success: false, message: 'خطا در فعال‌سازی لایسنس' });
  }
});

/**
 * POST /license/contact
 * Submit contact request for renewal/support with enhanced fields
 * @body schoolName - Name of the school (required)
 * @body contactName - Contact person name (required)
 * @body contactPhone - Contact phone number (required)
 * @body preferredMethod - Preferred contact method (required)
 * @body requestType - Type of request (required)
 * @body message - Optional message
 * @body province - Province/city of the school (optional)
 * @body machineId - Device identifier (optional)
 * @body paymentMethod - Payment method: hawala, ghazanfar_bank, hesab_pay, m_paisa (optional)
 * @body paymentReference - Hawala code or transaction ID (optional)
 * @body paymentAmount - Amount paid in AFN (optional)
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
router.post('/contact', async (req: Request, res: Response) => {
  try {
    const {
      schoolName,
      contactName,
      contactPhone,
      preferredMethod,
      requestType,
      message,
      province,
      machineId,
      paymentMethod,
      paymentReference,
      paymentAmount,
    } = req.body;

    // Validate required fields
    if (!schoolName || !contactName || !contactPhone || !preferredMethod || !requestType) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        success: false,
        message: 'تمام فیلدها الزامی هستند',
      });
    }

    // Validate preferredMethod is one of allowed values
    const validPreferredMethods = ['whatsapp', 'telegram', 'call', 'sms'];
    if (!validPreferredMethods.includes(preferredMethod)) {
      return res.status(400).json({
        error: 'INVALID_PREFERRED_METHOD',
        success: false,
        message: 'روش تماس نامعتبر است',
      });
    }

    // Validate requestType is one of allowed values
    const validRequestTypes = ['renewal', 'new_license', 'support', 'upgrade'];
    if (!validRequestTypes.includes(requestType)) {
      return res.status(400).json({
        error: 'INVALID_REQUEST_TYPE',
        success: false,
        message: 'نوع درخواست نامعتبر است',
      });
    }

    // Validate paymentMethod if provided (Requirements: 3.3)
    const validPaymentMethods = ['hawala', 'ghazanfar_bank', 'hesab_pay', 'm_paisa'];
    if (paymentMethod && !validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        error: 'INVALID_PAYMENT_METHOD',
        success: false,
        message: 'روش پرداخت نامعتبر است. روش‌های مجاز: hawala, ghazanfar_bank, hesab_pay, m_paisa',
      });
    }

    // Validate machineId format if provided (Requirements: 3.2)
    const licenseService = LicenseService.getInstance();
    if (machineId && !licenseService.validateMachineIdFormat(machineId)) {
      return res.status(400).json({
        error: 'INVALID_MACHINE_ID',
        success: false,
        message: 'فرمت کود دستگاه نامعتبر است',
      });
    }

    // Validate paymentAmount if provided
    if (paymentAmount !== undefined && (typeof paymentAmount !== 'number' || paymentAmount < 0)) {
      return res.status(400).json({
        error: 'INVALID_PAYMENT_AMOUNT',
        success: false,
        message: 'مبلغ پرداخت نامعتبر است',
      });
    }

    const result = await licenseService.submitContactRequest(
      schoolName,
      contactName,
      contactPhone,
      preferredMethod,
      requestType,
      message,
      province,
      machineId,
      paymentMethod,
      paymentReference,
      paymentAmount
    );

    res.json(result);
  } catch (error) {
    logger.error(
      'Error submitting contact request',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json({ success: false, message: 'خطا در ثبت درخواست' });
  }
});

/**
 * GET /license/current
 * Get current active license info
 */
router.get('/current', async (_req: Request, res: Response) => {
  try {
    const licenseService = LicenseService.getInstance();
    const license = await licenseService.getCurrentLicense();

    if (license) {
      // Don't expose full license key
      const safeInfo = {
        id: license.id,
        licenseKeyPreview: license.licenseKey.substring(0, 9) + '****',
        schoolName: license.schoolName,
        contactName: license.contactName,
        licenseType: license.licenseType,
        activatedAt: license.activatedAt,
        expiresAt: license.expiresAt,
        gracePeriodDays: license.gracePeriodDays,
      };
      res.json(safeInfo);
    } else {
      res.status(404).json({ message: 'لایسنس فعالی یافت نشد' });
    }
  } catch (error) {
    logger.error(
      'Error getting current license',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json({ error: 'Failed to get license info' });
  }
});

/**
 * GET /license/machine-id
 * Get server-generated machine ID for non-Electron environments
 * This is a fallback when the Electron machine ID is not available
 * Returns machine ID in short format: XXXX-XXXX-XXXX
 * Requirements: 1.4
 */
router.get('/machine-id', (_req: Request, res: Response) => {
  try {
    const licenseService = LicenseService.getInstance();
    const machineId = licenseService.getServerMachineId();

    res.json({
      machineId,
      source: 'server',
      format: 'XXXX-XXXX-XXXX',
      message: 'این کود دستگاه از سرور تولید شده است. برای دقت بیشتر از نسخه دسکتاپ استفاده کنید.',
    });
  } catch (error) {
    logger.error(
      'Error generating server machine ID',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json({ error: 'Failed to generate machine ID' });
  }
});

/**
 * GET /license/request-template
 * Get license request template with Farsi message and all configuration
 * @query machineId - Machine ID to include in the template (required)
 * @returns RequestTemplate with template string, contact channels, and payment methods
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
router.get('/request-template', async (req: Request, res: Response) => {
  try {
    const machineId = req.query.machineId as string;

    // Validate machineId is provided
    if (!machineId) {
      return res.status(400).json({
        error: 'MISSING_MACHINE_ID',
        message: 'کود دستگاه الزامی است', // Machine ID is required
      });
    }

    const licenseService = LicenseService.getInstance();

    // Validate machineId format
    if (!licenseService.validateMachineIdFormat(machineId)) {
      return res.status(400).json({
        error: 'INVALID_MACHINE_ID',
        message: 'فرمت کود دستگاه نامعتبر است', // Invalid machine ID format
      });
    }

    const template = await licenseService.getRequestTemplate(machineId);
    res.json(template);
  } catch (error) {
    logger.error(
      'Error getting request template',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json({ error: 'Failed to get request template' });
  }
});

export default router;
