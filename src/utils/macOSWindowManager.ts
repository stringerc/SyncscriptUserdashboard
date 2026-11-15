// macOS Window Management Utilities
// Provides AppleScript-based window control for Cortana desktop automation

import { execSync } from 'child_process';

/**
 * Execute AppleScript command and return result
 */
export function executeApplescript(script: string): string {
  try {
    const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' });
    return result.trim();
  } catch (error) {
    console.error('AppleScript execution error:', error);
    throw new Error(`Failed to execute AppleScript: ${error.message}`);
  }
}

/**
 * Get list of running applications
 */
export function getRunningApps(): string[] {
  const script = `
    tell application "System Events"
      get name of every application process whose background only is false
    end tell
  `;

  const result = executeApplescript(script);
  return result.split(', ').filter(app => app.length > 0);
}

/**
 * Get frontmost application
 */
export function getFrontmostApp(): string {
  const script = `
    tell application "System Events"
      get name of first application process whose frontmost is true
    end tell
  `;

  return executeApplescript(script);
}

/**
 * Get windows for a specific application
 */
export function getAppWindows(appName: string): any[] {
  const script = `
    tell application "System Events"
      tell process "${appName}"
        get name of every window
      end tell
    end tell
  `;

  const result = executeApplescript(script);
  return result.split(', ').map(name => ({ name })).filter(w => w.name.length > 0);
}

/**
 * Move and resize window
 * @param appName Application name
 * @param windowName Window title (optional, uses first window if not specified)
 * @param x X position
 * @param y Y position
 * @param width Window width
 * @param height Window height
 */
export function moveWindow(
  appName: string,
  windowName: string | null = null,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  let script = `
    tell application "System Events"
      tell process "${appName}"
  `;

  if (windowName) {
    script += `
      tell window "${windowName}"
        set position to {${x}, ${y}}
        set size to {${width}, ${height}}
      end tell
    `;
  } else {
    script += `
      tell window 1
        set position to {${x}, ${y}}
        set size to {${width}, ${height}}
      end tell
    `;
  }

  script += `
      end tell
    end tell
  `;

  try {
    executeApplescript(script);
    return true;
  } catch (error) {
    console.error('Failed to move window:', error);
    return false;
  }
}

/**
 * Center window on screen
 */
export function centerWindow(appName: string, windowName: string | null = null): boolean {
  // Get screen dimensions
  const screenScript = `
    tell application "System Events"
      set screenWidth to width of screen 1
      set screenHeight to height of screen 1
    end tell
  `;

  try {
    const screenResult = executeApplescript(screenScript);
    const [screenWidth, screenHeight] = screenResult.split(', ').map(Number);

    // Get window size (we'll use default 800x600 for now, could be enhanced)
    const windowWidth = 800;
    const windowHeight = 600;

    const x = Math.floor((screenWidth - windowWidth) / 2);
    const y = Math.floor((screenHeight - windowHeight) / 2);

    return moveWindow(appName, windowName, x, y, windowWidth, windowHeight);
  } catch (error) {
    console.error('Failed to center window:', error);
    return false;
  }
}

/**
 * Minimize window
 */
export function minimizeWindow(appName: string, windowName: string | null = null): boolean {
  let script = `
    tell application "System Events"
      tell process "${appName}"
  `;

  if (windowName) {
    script += `
      tell window "${windowName}"
        set minimized to true
      end tell
    `;
  } else {
    script += `
      tell window 1
        set minimized to true
      end tell
    `;
  }

  script += `
      end tell
    end tell
  `;

  try {
    executeApplescript(script);
    return true;
  } catch (error) {
    console.error('Failed to minimize window:', error);
    return false;
  }
}

/**
 * Hide application
 */
export function hideApplication(appName: string): boolean {
  const script = `
    tell application "${appName}"
      hide
    end tell
  `;

  try {
    executeApplescript(script);
    return true;
  } catch (error) {
    console.error('Failed to hide application:', error);
    return false;
  }
}

/**
 * Show application
 */
export function showApplication(appName: string): boolean {
  const script = `
    tell application "${appName}"
      activate
    end tell
  `;

  try {
    executeApplescript(script);
    return true;
  } catch (error) {
    console.error('Failed to show application:', error);
    return false;
  }
}

/**
 * Common window arrangements
 */
export const WindowArrangements = {
  /**
   * Split screen left half
   */
  leftHalf: (appName: string, windowName: string | null = null): boolean => {
    const screenScript = `
      tell application "System Events"
        set screenWidth to width of screen 1
        set screenHeight to height of screen 1
      end tell
    `;

    try {
      const screenResult = executeApplescript(screenScript);
      const [screenWidth, screenHeight] = screenResult.split(', ').map(Number);

      const width = Math.floor(screenWidth / 2);
      const height = screenHeight;
      const x = 0;
      const y = 0;

      return moveWindow(appName, windowName, x, y, width, height);
    } catch (error) {
      console.error('Failed to arrange window left half:', error);
      return false;
    }
  },

  /**
   * Split screen right half
   */
  rightHalf: (appName: string, windowName: string | null = null): boolean => {
    const screenScript = `
      tell application "System Events"
        set screenWidth to width of screen 1
        set screenHeight to height of screen 1
      end tell
    `;

    try {
      const screenResult = executeApplescript(screenScript);
      const [screenWidth, screenHeight] = screenResult.split(', ').map(Number);

      const width = Math.floor(screenWidth / 2);
      const height = screenHeight;
      const x = Math.floor(screenWidth / 2);
      const y = 0;

      return moveWindow(appName, windowName, x, y, width, height);
    } catch (error) {
      console.error('Failed to arrange window right half:', error);
      return false;
    }
  },

  /**
   * Full screen
   */
  fullScreen: (appName: string, windowName: string | null = null): boolean => {
    const screenScript = `
      tell application "System Events"
        set screenWidth to width of screen 1
        set screenHeight to height of screen 1
      end tell
    `;

    try {
      const screenResult = executeApplescript(screenScript);
      const [screenWidth, screenHeight] = screenResult.split(', ').map(Number);

      return moveWindow(appName, windowName, 0, 0, screenWidth, screenHeight);
    } catch (error) {
      console.error('Failed to make window full screen:', error);
      return false;
    }
  }
};

export default {
  executeApplescript,
  getRunningApps,
  getFrontmostApp,
  getAppWindows,
  moveWindow,
  centerWindow,
  minimizeWindow,
  hideApplication,
  showApplication,
  WindowArrangements
};