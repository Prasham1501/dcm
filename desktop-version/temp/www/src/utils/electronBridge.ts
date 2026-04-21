/**
 * Electron bridge utilities for safe IPC communication.
 * All functions gracefully fall back when not running in Electron.
 */

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

export function getElectronAPI(): ElectronAPI | null {
  if (isElectron()) {
    return window.electronAPI!;
  }
  return null;
}

export async function getSystemPrinters(): Promise<SystemPrinter[]> {
  const api = getElectronAPI();
  if (!api) return [];
  try {
    const result = await api.getSystemPrinters();
    return result.success ? result.printers : [];
  } catch {
    console.warn('Failed to get system printers');
    return [];
  }
}

export async function printToPrinter(
  options: PrintOptions
): Promise<{ success: boolean; error?: string }> {
  const api = getElectronAPI();
  if (!api) return { success: false, error: 'Not running in Electron' };
  try {
    return await api.printToPrinter(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Print failed';
    return { success: false, error: message };
  }
}

export async function printCurrentToPrinter(
  options: PrintOptions
): Promise<{ success: boolean; error?: string }> {
  const api = getElectronAPI();
  if (!api) return { success: false, error: 'Not running in Electron' };
  try {
    return await api.printCurrentToPrinter(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Print failed';
    return { success: false, error: message };
  }
}

export async function focusMainWindow(): Promise<boolean> {
  const api = getElectronAPI();
  if (!api) return false;
  try {
    const result = await api.focusMainWindow();
    return result.success;
  } catch {
    return false;
  }
}

export async function saveCredentials(
  credentials: SavedCredentials
): Promise<boolean> {
  const api = getElectronAPI();
  if (!api) return false;
  try {
    const result = await api.saveCredentials(credentials);
    return result.success;
  } catch {
    console.warn('Failed to save credentials');
    return false;
  }
}

export async function getCredentials(): Promise<SavedCredentials | null> {
  const api = getElectronAPI();
  if (!api) return null;
  try {
    const result = await api.getCredentials();
    return result.success && result.credentials ? result.credentials : null;
  } catch {
    console.warn('Failed to get credentials');
    return null;
  }
}

export async function clearCredentials(): Promise<boolean> {
  const api = getElectronAPI();
  if (!api) return false;
  try {
    const result = await api.clearCredentials();
    return result.success;
  } catch {
    console.warn('Failed to clear credentials');
    return false;
  }
}

export async function hasAutoLoginCredentials(): Promise<boolean> {
  const api = getElectronAPI();
  if (!api) return false;
  try {
    const result = await api.hasAutoLoginCredentials();
    return result.success && result.hasCredentials;
  } catch {
    return false;
  }
}
