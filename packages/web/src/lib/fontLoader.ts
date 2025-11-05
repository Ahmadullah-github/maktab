/**
 * Font Loader Utility for jsPDF
 *
 * Loads Persian fonts (Vazir) and registers them with jsPDF
 * for proper Persian/Arabic text rendering in PDFs.
 */

import jsPDF from "jspdf";

/**
 * Load Persian fonts into jsPDF instance
 * Directly embeds Vazir fonts from TTF files for reliable font support
 */
export async function loadPersianFonts(pdf: jsPDF): Promise<void> {
  try {
    // Check if fonts are already loaded
    const fontList = pdf.getFontList();
    if (fontList && fontList["Vazir"] && fontList["Vazir-Bold"]) {
      console.log("[FontLoader] Persian fonts already loaded");
      pdf.setFont("Vazir", "normal");
      return;
    }

    // Load Vazir regular font
    const vazirResponse = await fetch('/assets/fonts/Vazir.ttf');
    if (!vazirResponse.ok) {
      throw new Error(`Failed to load Vazir font: ${vazirResponse.status}`);
    }
    const vazirBuffer = await vazirResponse.arrayBuffer();
    const vazirBase64 = btoa(String.fromCharCode(...new Uint8Array(vazirBuffer)));

    // Load Vazir Bold font
    const vazirBoldResponse = await fetch('/assets/fonts/Vazir-Bold.ttf');
    if (!vazirBoldResponse.ok) {
      throw new Error(`Failed to load Vazir-Bold font: ${vazirBoldResponse.status}`);
    }
    const vazirBoldBuffer = await vazirBoldResponse.arrayBuffer();
    const vazirBoldBase64 = btoa(String.fromCharCode(...new Uint8Array(vazirBoldBuffer)));

    // Add fonts to jsPDF
    pdf.addFileToVFS('Vazir.ttf', vazirBase64);
    pdf.addFileToVFS('Vazir-Bold.ttf', vazirBoldBase64);
    pdf.addFont('Vazir.ttf', 'Vazir', 'normal');
    pdf.addFont('Vazir-Bold.ttf', 'Vazir-Bold', 'normal');

    // Set default font
    pdf.setFont("Vazir", "normal");

    console.log("[FontLoader] Persian fonts loaded successfully", {
      fontList: Object.keys(pdf.getFontList() || {}),
      currentFont: pdf.getFont().fontName
    });
  } catch (error) {
    console.error("[FontLoader] Failed to load Persian fonts:", error);
    // Fallback to Helvetica
    pdf.setFont("helvetica", "normal");
    throw error;
  }
}


/**
 * Set Persian font for jsPDF instance
 * @param pdf jsPDF instance
 * @param style Font style: 'normal' or 'bold'
 */
export function setPersianFont(pdf: jsPDF, style: "normal" | "bold" = "normal"): void {
  try {
    // Check if Vazir fonts are available
    const fontList = pdf.getFontList();
    if (fontList && fontList["Vazir"] && fontList["Vazir-Bold"]) {
      if (style === "bold") {
        pdf.setFont("Vazir-Bold", "normal");
      } else {
        pdf.setFont("Vazir", "normal");
      }
    } else {
      throw new Error("Vazir fonts not loaded");
    }
  } catch (error) {
    console.warn("[FontLoader] Persian font not available, using default font:", error);
    // Fallback to helvetica
    pdf.setFont("helvetica", style);
  }
}

/**
 * Test function to verify font loading
 */
export async function testFontLoading(): Promise<boolean> {
  try {
    const pdf = new jsPDF();
    await loadPersianFonts(pdf);

    const fontList = pdf.getFontList();
    const hasVazir = fontList && fontList["Vazir"];
    const hasVazirBold = fontList && fontList["Vazir-Bold"];

    console.log("[FontTest] Font loading test:", {
      hasVazir,
      hasVazirBold,
      currentFont: pdf.getFont().fontName,
      availableFonts: Object.keys(fontList || {})
    });

    return hasVazir && hasVazirBold;
  } catch (error) {
    console.error("[FontTest] Font loading test failed:", error);
    return false;
  }
}

