const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
    testEnvironment: "node",
    roots: ["<rootDir>/backend"],
    testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
    setupFilesAfterEnv: ["<rootDir>/backend/src/__tests__/setup.ts"],
    testTimeout: 30000,
    transform: {
        ...tsJestTransformCfg,
    },
};
