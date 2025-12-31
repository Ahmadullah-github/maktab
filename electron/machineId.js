/**
 * Machine ID Module for Electron
 * Generates a unique hardware-based fingerprint for license binding
 */

const { machineIdSync, machineId } = require("node-machine-id");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

// File path for fallback UUID storage
const FALLBACK_UUID_FILENAME = ".maktab-machine-id";

/**
 * Get the path for storing fallback UUID
 * @returns {string} Path to the fallback UUID file
 */
function getFallbackUuidPath() {
  // Use app.getPath('userData') if available, otherwise use home directory
  try {
    const userDataPath = app.getPath("userData");
    return path.join(userDataPath, FALLBACK_UUID_FILENAME);
  } catch (e) {
    // Fallback to home directory if app is not ready
    const homeDir = process.env.HOME || process.env.USERPROFILE || ".";
    return path.join(homeDir, FALLBACK_UUID_FILENAME);
  }
}

/**
 * Generate a new UUID v4
 * @returns {string} A new UUID
 */
function generateUuid() {
  return crypto.randomUUID();
}

/**
 * Get or create a persistent fallback UUID
 * @returns {string} The persistent UUID
 */
function getOrCreateFallbackUuid() {
  const fallbackPath = getFallbackUuidPath();
  
  try {
    // Try to read existing UUID
    if (fs.existsSync(fallbackPath)) {
      const existingUuid = fs.readFileSync(fallbackPath, "utf8").trim();
      if (existingUuid && existingUuid.length > 0) {
        return existingUuid;
      }
    }
  } catch (e) {
    console.warn("[MachineId] Could not read fallback UUID:", e.message);
  }
  
  // Generate and store new UUID
  const newUuid = generateUuid();
  try {
    // Ensure directory exists
    const dir = path.dirname(fallbackPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fallbackPath, newUuid, "utf8");
  } catch (e) {
    console.warn("[MachineId] Could not persist fallback UUID:", e.message);
  }
  
  return newUuid;
}

/**
 * Convert a raw ID string to short format (XXXX-XXXX-XXXX)
 * @param {string} rawId - The raw machine ID or UUID
 * @returns {string} Formatted short ID
 */
function toShortFormat(rawId) {
  // Create a hash of the raw ID for consistent length
  const hash = crypto.createHash("sha256").update(rawId).digest("hex");
  
  // Take first 12 characters and convert to uppercase
  const shortHash = hash.substring(0, 12).toUpperCase();
  
  // Format as XXXX-XXXX-XXXX
  return `${shortHash.substring(0, 4)}-${shortHash.substring(4, 8)}-${shortHash.substring(8, 12)}`;
}

/**
 * Get the full hardware-based machine ID
 * Falls back to persistent UUID if hardware ID is unavailable
 * @returns {Promise<string>} The machine ID
 */
async function getMachineId() {
  try {
    // Try to get hardware-based machine ID
    const hwId = await machineId();
    if (hwId && hwId.length > 0) {
      return hwId;
    }
  } catch (e) {
    console.warn("[MachineId] Hardware ID unavailable:", e.message);
  }
  
  // Fallback to persistent UUID
  return getOrCreateFallbackUuid();
}

/**
 * Get the full hardware-based machine ID (synchronous version)
 * Falls back to persistent UUID if hardware ID is unavailable
 * @returns {string} The machine ID
 */
function getMachineIdSync() {
  try {
    // Try to get hardware-based machine ID
    const hwId = machineIdSync();
    if (hwId && hwId.length > 0) {
      return hwId;
    }
  } catch (e) {
    console.warn("[MachineId] Hardware ID unavailable:", e.message);
  }
  
  // Fallback to persistent UUID
  return getOrCreateFallbackUuid();
}

/**
 * Get the short format machine ID (XXXX-XXXX-XXXX)
 * Suitable for SMS/phone communication
 * @returns {Promise<string>} The short format machine ID
 */
async function getShortMachineId() {
  const fullId = await getMachineId();
  return toShortFormat(fullId);
}

/**
 * Get the short format machine ID (synchronous version)
 * @returns {string} The short format machine ID
 */
function getShortMachineIdSync() {
  const fullId = getMachineIdSync();
  return toShortFormat(fullId);
}

module.exports = {
  getMachineId,
  getMachineIdSync,
  getShortMachineId,
  getShortMachineIdSync,
  toShortFormat,
  // Exported for testing
  getOrCreateFallbackUuid,
  getFallbackUuidPath,
};
