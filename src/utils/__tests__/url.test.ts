import * as WebBrowser from 'expo-web-browser';

import { isSafeHttpUrl, openExternalUrl } from '../url';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

describe('isSafeHttpUrl', () => {
  it('allows only absolute http(s) URLs', () => {
    expect(isSafeHttpUrl('https://qiskit.org/docs')).toBe(true);
    expect(isSafeHttpUrl('http://example.com')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('/media/x.png')).toBe(false);
    expect(isSafeHttpUrl('qlearn://lesson/1')).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
  });
});

describe('openExternalUrl', () => {
  it('opens safe URLs and ignores the rest', async () => {
    await openExternalUrl('javascript:alert(1)');
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    await openExternalUrl('https://qiskit.org');
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://qiskit.org');
  });
});
