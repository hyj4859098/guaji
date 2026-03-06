/**
 * Jest 配置 - 仅真实测试，无 mock
 *
 * - unit: 纯逻辑测试（utils/types/battle/event 等），无需 DB
 * - integration: API 集成测试，使用 MongoDB Memory Server
 */
/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/*.test.ts', '**/*.spec.ts'],
      testPathIgnorePatterns: ['/node_modules/', '/__tests__/integration/'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/*.test.ts',
        '!src/**/*.spec.ts',
        '!src/app.ts',
        '!src/__test-utils__/**',
        '!src/config/db.ts',
      ],
      coveragePathIgnorePatterns: ['/node_modules/', '.*config[/\\\\]db\\.ts$'],
      coverageDirectory: 'coverage',
      coverageThreshold: {
        global: {
          statements: 89,
          branches: 72,
          functions: 94,
          lines: 91,
        },
      },
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src/__tests__/integration'],
      testMatch: ['**/*.integration.test.ts'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      globalSetup: '<rootDir>/src/__tests__/integration/globalSetup.ts',
      globalTeardown: '<rootDir>/src/__tests__/integration/globalTeardown.ts',
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/integration/setup.ts'],
      maxWorkers: 1,
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/*.test.ts',
        '!src/**/*.spec.ts',
        '!src/app.ts',
        '!src/__test-utils__/**',
        '!src/config/db.ts',
      ],
      coveragePathIgnorePatterns: ['/node_modules/', '.*config[/\\\\]db\\.ts$'],
      coverageDirectory: 'coverage',
      coverageThreshold: {
        global: {
          statements: 89,
          branches: 72,
          functions: 94,
          lines: 91,
        },
      },
    },
  ],
};
