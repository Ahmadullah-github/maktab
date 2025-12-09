import { Request, Response, NextFunction } from "express";
import { LicenseService } from "../services/licenseService";

// Routes that should be accessible even without valid license
const EXEMPT_ROUTES = [
  "/api/health",
  "/api/license/status",
  "/api/license/activate",
  "/api/license/contact",
  "/api/license/contact-info",
];

/**
 * Middleware to check license validity before allowing access
 */
export async function licenseMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Allow exempt routes
  const path = req.path.toLowerCase();
  if (EXEMPT_ROUTES.some((route) => path.startsWith(route))) {
    next();
    return;
  }

  try {
    const licenseService = LicenseService.getInstance();
    const status = await licenseService.checkLicenseStatus();

    // Add license status to request for use in routes
    (req as any).licenseStatus = status;

    if (status.isValid) {
      // License is valid (including grace period)
      // Add warning header if in grace period or expiring soon
      if (status.isInGracePeriod) {
        res.setHeader("X-License-Warning", "grace-period");
        res.setHeader("X-License-Grace-Days", status.graceDaysRemaining.toString());
      } else if (status.daysRemaining <= 30) {
        res.setHeader("X-License-Warning", "expiring-soon");
        res.setHeader("X-License-Days-Remaining", status.daysRemaining.toString());
      }
      next();
    } else {
      // License is invalid or expired
      res.status(403).json({
        success: false,
        error: "LICENSE_EXPIRED",
        message: status.message,
        licenseStatus: {
          isExpired: status.isExpired,
          expiresAt: status.expiresAt,
          schoolName: status.schoolName,
        },
        contactInfo: LicenseService.CONTACT_INFO,
        actions: [
          {
            type: "renew",
            label: "تمدید لایسنس",
            description: "برای تمدید لایسنس با ما تماس بگیرید",
          },
          {
            type: "contact",
            label: "تماس با پشتیبانی",
            methods: [
              { type: "whatsapp", value: LicenseService.CONTACT_INFO.whatsapp },
              { type: "telegram", value: LicenseService.CONTACT_INFO.telegram },
              { type: "call", value: LicenseService.CONTACT_INFO.phone },
            ],
          },
        ],
      });
    }
  } catch (error) {
    console.error("License middleware error:", error);
    // In case of error, allow access but log the issue
    // You might want to change this to block access in production
    next();
  }
}

/**
 * Middleware to add license status to all responses
 */
export async function licenseStatusMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const licenseService = LicenseService.getInstance();
    const status = await licenseService.checkLicenseStatus();

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to include license status
    res.json = (body: any) => {
      // Add license info to successful responses
      if (body && typeof body === "object" && !body.licenseStatus) {
        body._license = {
          daysRemaining: status.daysRemaining,
          isExpiringSoon: status.daysRemaining <= 30,
          isInGracePeriod: status.isInGracePeriod,
        };
      }
      return originalJson(body);
    };

    next();
  } catch (error) {
    next();
  }
}
