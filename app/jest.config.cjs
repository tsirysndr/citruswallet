module.exports = {
  preset: 'jest-expo',
  testTimeout: 15000,
  moduleNameMapper: { '^lucide-react-native/icons/(.*)$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js' },
  transform: { '^.+\\.mjs$': 'babel-jest', '^.+\\.[jt]sx?$': 'babel-jest' },
  testMatch: ['**/tests/**/*.test.jsx', '**/src/**/*.test.jsx'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.cjs'],
  transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo[^/]*|@expo(nent)?/.*|react-native-svg|@unimodules/.*|unimodules|native-base|react-native-css-interop)/)'],
};
