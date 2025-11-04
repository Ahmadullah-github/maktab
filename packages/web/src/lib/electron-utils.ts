/**
 * Electron utility functions
 * Detects if running in Electron
 */

// Check if we're running in Electron
export const isElectron = (): boolean => {
  return (
    typeof window !== "undefined" &&
    window.process &&
    (window.process as any).type === "renderer"
  );
};

/**
 * Get Electron API if available
 */
export const getElectronAPI = () => {
  if (isElectron() && (window as any).electron) {
    return (window as any).electron;
  }
  return null;
};
