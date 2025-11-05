/**
 * Font Loader Utility for jsPDF
 * 
 * Loads Persian fonts (Vazir) and registers them with jsPDF
 * for proper Persian/Arabic text rendering in PDFs.
 */

import jsPDF from "jspdf";

// Cache font base64 data to avoid re-downloading
let fontCache: {
  regular?: string;
  bold?: string;
} = {};

/**
 * Load Persian fonts into jsPDF instance
 * Vazir font files are loaded from assets/fonts directory
 * Fonts are registered per PDF instance (not global)
 */
export async function loadPersianFonts(pdf: jsPDF): Promise<void> {
  // Check if fonts are already registered in this PDF instance
  try {
    // Try to get font list - if Vazir is already registered, it will be in the list
    const fontList = pdf.getFontList();
    if (fontList && fontList["Vazir"]) {
      console.log("[FontLoader] Persian fonts already registered in this PDF instance");
      return;
    }
  } catch (e) {
    // Font list not available or error, continue with loading
  }

  try {
    // Load Vazir Regular (normal weight) - use cache if available
    let vazirRegularBase64: string;
    if (fontCache.regular) {
      vazirRegularBase64 = fontCache.regular;
      console.log("[FontLoader] Using cached Vazir Regular font");
    } else {
      // Try multiple paths for Vite development and production
      let vazirRegularResponse: Response | null = null;
      const fontPaths = [
        "/assets/fonts/Vazir.ttf",
        "/fonts/Vazir.ttf",
        "./assets/fonts/Vazir.ttf",
      ];
      
      for (const path of fontPaths) {
        try {
          vazirRegularResponse = await fetch(path);
          if (vazirRegularResponse.ok) break;
        } catch (e) {
          continue;
        }
      }
      
      if (!vazirRegularResponse || !vazirRegularResponse.ok) {
        throw new Error("Failed to load Vazir Regular font");
      }
      
      const vazirRegularBlob = await vazirRegularResponse.blob();
      vazirRegularBase64 = await blobToBase64(vazirRegularBlob);
      fontCache.regular = vazirRegularBase64; // Cache for future use
    }

    // Load Vazir Bold - use cache if available
    let vazirBoldBase64: string;
    if (fontCache.bold) {
      vazirBoldBase64 = fontCache.bold;
      console.log("[FontLoader] Using cached Vazir Bold font");
    } else {
      let vazirBoldResponse: Response | null = null;
      const boldFontPaths = [
        "/assets/fonts/Vazir-Bold.ttf",
        "/fonts/Vazir-Bold.ttf",
        "./assets/fonts/Vazir-Bold.ttf",
      ];
      
      for (const path of boldFontPaths) {
        try {
          vazirBoldResponse = await fetch(path);
          if (vazirBoldResponse.ok) break;
        } catch (e) {
          continue;
        }
      }
      
      if (!vazirBoldResponse || !vazirBoldResponse.ok) {
        throw new Error("Failed to load Vazir Bold font");
      }
      
      const vazirBoldBlob = await vazirBoldResponse.blob();
      vazirBoldBase64 = await blobToBase64(vazirBoldBlob);
      fontCache.bold = vazirBoldBase64; // Cache for future use
    }

    // Register fonts with jsPDF (per PDF instance)
    // Note: jsPDF v3 requires fonts to be in its internal format
    // Raw TTF base64 might not work directly - fonts may need conversion
    try {
      pdf.addFileToVFS("Vazir-Regular.ttf", vazirRegularBase64);
      pdf.addFont("Vazir-Regular.ttf", "Vazir", "normal");
      
      pdf.addFileToVFS("Vazir-Bold.ttf", vazirBoldBase64);
      pdf.addFont("Vazir-Bold.ttf", "Vazir", "bold");

      // Verify font was registered
      const fontList = pdf.getFontList();
      if (!fontList || !fontList["Vazir"]) {
        console.warn("[FontLoader] Font 'Vazir' not found in font list after registration");
        throw new Error("Font registration failed");
      }

      // Set Vazir as default font for this PDF instance
      pdf.setFont("Vazir", "normal");
      
      console.log("[FontLoader] Persian fonts loaded and registered successfully", {
        fontList: Object.keys(fontList || {}),
        currentFont: pdf.getFont().fontName
      });
    } catch (fontError) {
      console.error("[FontLoader] Font registration error:", fontError);
      throw new Error(`Failed to register Persian fonts: ${fontError instanceof Error ? fontError.message : String(fontError)}`);
    }
  } catch (error) {
    console.error("[FontLoader] Failed to load Persian fonts:", error);
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Convert blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data:application/octet-stream;base64, prefix if present
      const base64Data = base64.split(",")[1] || base64;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Set Persian font for jsPDF instance
 * @param pdf jsPDF instance
 * @param style Font style: 'normal' or 'bold'
 */
export function setPersianFont(pdf: jsPDF, style: "normal" | "bold" = "normal"): void {
  try {
    pdf.setFont("Vazir", style);
  } catch (error) {
    console.warn("[FontLoader] Persian font not available, using default font:", error);
    // Fallback to helvetica
    pdf.setFont("helvetica", style);
  }
}

/**
 * Reset font cache (useful for testing)
 */
export function resetFontCache(): void {
  fontCache = {};
}

