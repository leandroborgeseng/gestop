export const APP_BOOT_TIME = Date.now();

export function getUptimeSeconds() {
  return Math.floor((Date.now() - APP_BOOT_TIME) / 1000);
}
