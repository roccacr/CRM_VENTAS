module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  testPathIgnorePatterns: ["/test/integration/"],
  moduleNameMapper: {
    "^uuid$": "<rootDir>/test/mocks/uuid.ts",
  },
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  testEnvironment: "node",
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 45,
      lines: 55,
      statements: 55,
    },
  },
};
