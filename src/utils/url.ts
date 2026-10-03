import * as WebBrowser from 'expo-web-browser';

/** Only absolute http(s) URLs from lesson content are rendered or opened. */
export function isSafeHttpUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https?:\/\/[^\s]+$/i.test(url.trim());
}

/** Open an external link in the in-app browser; anything else is ignored. */
export async function openExternalUrl(url: string | null | undefined): Promise<void> {
  if (isSafeHttpUrl(url)) await WebBrowser.openBrowserAsync(url.trim());
}
