import { requireEnv } from '../../../src/shared/utils/require-env.js';

describe('requireEnv', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns the value when the variable is set', () => {
    process.env.TEST_VAR = 'hello';
    expect(requireEnv('TEST_VAR')).toBe('hello');
  });

  it('throws when the variable is missing', () => {
    delete process.env.TEST_VAR;
    expect(() => requireEnv('TEST_VAR')).toThrow('TEST_VAR is required');
  });

  it('throws when the variable is an empty string', () => {
    process.env.TEST_VAR = '';
    expect(() => requireEnv('TEST_VAR')).toThrow('TEST_VAR is required');
  });
});
