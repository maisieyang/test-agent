---
name: TypeScript Jest Testing
description: Conventions and patterns for generating TypeScript tests with Jest, React Testing Library, and user-event. Use this skill when the target project uses TypeScript + Jest.
---

# TypeScript + Jest Testing Skill

## Test File Conventions

- **Location**: `src/[feature]/__tests__/[Module].test.ts(x)`
- **Extension**: `.test.ts` for pure logic, `.test.tsx` for React components/hooks
- **Naming**: Match the source file name exactly (e.g., `bm25.ts` → `bm25.test.ts`)

## Import Patterns

```typescript
// Always use the project's path alias
import { myFunction } from '@/lib/path/to/module';

// Testing libraries
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Jest is globally available — do NOT import jest, describe, it, expect
```

## Test Structure

```typescript
describe('ModuleName', () => {
  // Group by function or behavior
  describe('functionName', () => {
    it('should handle normal input', () => { ... });
    it('should handle edge case: empty input', () => { ... });
    it('should throw on invalid input', () => { ... });
  });
});
```

## Pure Function Tests (P0)

```typescript
describe('tokenize', () => {
  it('should split English text into lowercase tokens', () => {
    expect(tokenize('Hello World')).toEqual(['hello', 'world']);
  });

  it('should handle CJK characters', () => {
    const result = tokenize('测试文本');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should return empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });
});
```

**Rules:**
- Test real inputs and outputs — no mocking the module under test
- Cover: normal case, edge cases (empty, null, large input), error paths
- For floating-point results, use `toBeCloseTo()` instead of `toBe()`
- For arrays, use `toEqual()` for exact match, `toContain()` for membership

## React Component Tests (P1)

```typescript
describe('ErrorMessage', () => {
  it('should render error text', () => {
    render(<ErrorMessage message="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', async () => {
    const onRetry = jest.fn();
    render(<ErrorMessage message="Error" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should not render when message is empty', () => {
    const { container } = render(<ErrorMessage message="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

**Rules:**
- Use `screen` queries — never destructure from `render()` (except `container`)
- Prefer semantic queries in this order: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`
- Use `userEvent` for interactions (NOT `fireEvent`)
- `userEvent` calls are async — always `await` them
- Test: rendering, user interactions, conditional rendering, callback props
- For components with Providers (theme, etc.), create a wrapper if needed

## Hook Tests (P2)

```typescript
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@/hooks/useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    // Mock browser APIs
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.setItem = jest.fn();
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
  });

  it('should return default theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBeDefined();
  });

  it('should update theme', () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setTheme('dark');
    });
    expect(result.current.theme).toBe('dark');
  });
});
```

**Rules:**
- Use `renderHook()` from `@testing-library/react`
- Wrap state updates in `act()`
- Mock browser APIs (`localStorage`, `matchMedia`) in `beforeEach`
- Clean up mocks in `afterEach` if needed
- Test: initial state, state transitions, side effects, cleanup

## Mocking Patterns

```typescript
// Mock a module
jest.mock('@/lib/embeddings', () => ({
  getEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

// Mock node:fs (for file operations)
jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: 'test' }),
});

// Spy on a method
const spy = jest.spyOn(console, 'error').mockImplementation();
afterEach(() => spy.mockRestore());
```

**Rules:**
- Mock at module boundaries — external APIs, file system, network
- NEVER mock the module under test
- Use `jest.fn()` for callbacks and spies
- Use `jest.mock()` at the top of the file (hoisted by Jest)
- Always restore mocks: use `afterEach(() => jest.restoreAllMocks())`

## Prohibited Patterns

- **NO trivial tests**: `expect(fn).toBeDefined()` or `expect(true).toBe(true)`
- **NO snapshot tests**: They are brittle and add maintenance burden
- **NO testing implementation details**: Don't test internal state, private methods, or CSS classes
- **NO `fireEvent`**: Always use `userEvent` for user interactions
- **NO `getByTestId` as first choice**: Prefer semantic queries
- **NO hardcoded timeouts**: Use `waitFor()` instead of `setTimeout` in tests
- **NO `any` type**: Use proper types in test code, same as source code
