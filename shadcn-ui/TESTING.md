# Testing Guide

## Overview
This project uses Vitest for unit testing. Tests are located in `src/lib/__tests__/` directory.

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode (for development)
pnpm test

# Run tests with UI
pnpm test:ui

# Generate coverage report
pnpm test:coverage
```

## Test Files

### `calculations.test.ts`
Tests for the estimation calculation engine:
- `roundHalfUp()` - Number rounding utility
- `calculateDriverMultiplier()` - Driver multiplication logic
- `calculateRiskScore()` - Risk weight summation
- `getContingencyPercentage()` - Contingency percentage calculation
- `calculateEstimate()` - Complete estimate calculation

### `validation.test.ts`
Tests for input validation:
- Type guards (`isValidComplexity`, `isValidEnvironments`, etc.)
- `validateEstimate()` - Unified validation function
- `assertValidEstimateForSave()` - Pre-save validation

## Installing Test Dependencies

To run tests, you need to install Vitest:

```bash
pnpm add -D vitest @vitest/ui @vitest/coverage-v8 jsdom
```

## Writing New Tests

Follow the existing patterns:

```typescript
import { describe, it, expect } from 'vitest';
import { yourFunction } from '../yourModule';

describe('yourModule', () => {
  describe('yourFunction', () => {
    it('should do something correctly', () => {
      const result = yourFunction(input);
      expect(result).toBe(expected);
    });
  });
});
```

## Coverage Goals

- **Calculations**: 100% coverage (critical business logic)
- **Validation**: 100% coverage (input safety)
- **Storage**: 80%+ coverage (database operations)
- **Components**: 60%+ coverage (UI logic)
