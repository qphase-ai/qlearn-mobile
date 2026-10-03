import { EnvError, parseEnv } from '../env';

const base = {
  EXPO_PUBLIC_API_URL: 'https://api.example.com/',
  EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
};

describe('parseEnv', () => {
  it('parses valid config and strips trailing slashes', () => {
    expect(parseEnv(base)).toEqual({
      apiUrl: 'https://api.example.com',
      supabaseUrl: 'https://abc.supabase.co',
      supabaseAnonKey: 'anon',
      contentSource: 'legacy',
      contentUrl: null,
    });
  });

  it('requires the API URL', () => {
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_API_URL: '' })).toThrow(EnvError);
  });

  it('rejects non-http URLs', () => {
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_SUPABASE_URL: 'abc.supabase.co' })).toThrow(/http/);
  });

  it('requires the anon key', () => {
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined })).toThrow(/ANON_KEY/);
  });

  it('requires a content URL only for the cms source', () => {
    expect(() => parseEnv({ ...base, EXPO_PUBLIC_CONTENT_SOURCE: 'cms' })).toThrow(/CONTENT_URL/);
    expect(
      parseEnv({ ...base, EXPO_PUBLIC_CONTENT_SOURCE: 'cms', EXPO_PUBLIC_CONTENT_URL: 'https://web.test' })
    ).toMatchObject({ contentSource: 'cms', contentUrl: 'https://web.test' });
  });
});
