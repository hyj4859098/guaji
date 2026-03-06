const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

const typeComparisonRules = [
  {
    selector: 'BinaryExpression[operator=/^[!=]==?$/] > MemberExpression.left[property.name="type"] ~ Literal.right[value>=1][value<=6]',
    message: '禁止直接比较 .type 数字。请使用 isEquipment() / getItemType() / isBoostCard()（from utils/item-type）',
  },
  {
    selector: 'BinaryExpression[operator=/^[!=]==?$/] > Literal.left[value>=1][value<=6] ~ MemberExpression.right[property.name="type"]',
    message: '禁止直接比较 .type 数字。请使用 isEquipment() / getItemType() / isBoostCard()（from utils/item-type）',
  },
];

const hpMpRestoreRules = [
  {
    selector: 'MemberExpression[property.name="hp_restore"]',
    message: '禁止直接访问 .hp_restore。请使用 getHpRestore()（from utils/item-type）',
  },
  {
    selector: 'MemberExpression[property.name="mp_restore"]',
    message: '禁止直接访问 .mp_restore。请使用 getMpRestore()（from utils/item-type）',
  },
];

const baseLanguageOptions = {
  parser: tsParser,
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  globals: { require: 'readonly', module: 'readonly', __dirname: 'readonly', process: 'readonly', console: 'readonly' },
};
const baseRules = {
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-unreachable': 'warn',
  'no-constant-condition': ['warn', { checkLoops: false }],
};

module.exports = [
  {
    files: ['src/**/*.ts'],
    ignores: [
      'src/utils/item-type.ts',
      'src/__tests__/**',
      'src/__test-utils__/**',
      'src/service/item.service.ts',
      'src/service/offline-battle.service.ts',
      'src/api/admin/item.ts',
    ],
    languageOptions: baseLanguageOptions,
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...baseRules,
      'no-restricted-syntax': ['error', ...typeComparisonRules, ...hpMpRestoreRules],
    },
  },
  {
    files: [
      'src/service/item.service.ts',
      'src/service/offline-battle.service.ts',
      'src/api/admin/item.ts',
    ],
    languageOptions: baseLanguageOptions,
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...baseRules,
      'no-restricted-syntax': ['error', ...typeComparisonRules],
    },
  },
  {
    files: ['src/utils/item-type.ts', 'src/__tests__/**/*.ts', 'src/__test-utils__/**/*.ts'],
    languageOptions: baseLanguageOptions,
    plugins: { '@typescript-eslint': tseslint },
    rules: baseRules,
  },
];
