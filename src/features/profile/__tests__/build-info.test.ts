import { describeBuild, type BuildInfoSource } from '../build-info';

const release: BuildInfoSource = {
  version: '1.2.0',
  isDev: false,
  updatesEnabled: true,
  channel: 'production',
  updateId: '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0',
  isEmbeddedLaunch: false,
};

describe('describeBuild', () => {
  it('shows the channel and a short update id for a downloaded update', () => {
    expect(describeBuild(release)).toEqual({ version: '1.2.0', channel: 'production', update: '0f1e2d3c' });
  });

  it('marks the update that shipped in the binary as embedded', () => {
    expect(describeBuild({ ...release, isEmbeddedLaunch: true }).update).toBe('Embedded · 0f1e2d3c');
    expect(describeBuild({ ...release, isEmbeddedLaunch: true, updateId: null }).update).toBe('Embedded');
  });

  it('labels development (Expo Go, dev client), where expo-updates is off', () => {
    expect(describeBuild({ ...release, isDev: true, channel: null, updateId: null })).toEqual({
      version: '1.2.0',
      channel: 'Development',
      update: 'Development build',
    });
  });

  it('labels a release build without an updates URL', () => {
    expect(
      describeBuild({ ...release, updatesEnabled: false, channel: null, updateId: null, isEmbeddedLaunch: true })
    ).toEqual({ version: '1.2.0', channel: 'None (updates off)', update: 'Embedded (updates off)' });
  });

  it('never shows null', () => {
    expect(describeBuild({ ...release, version: undefined, channel: null, updateId: null })).toEqual({
      version: 'Unknown',
      channel: 'None',
      update: 'Unknown',
    });
  });
});
