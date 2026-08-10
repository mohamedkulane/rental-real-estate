import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
];
