---
description: Universal project rules and tech stack standards
globs: "**/*.ts, **/*.tsx, **/*.js, **/*.jsx, **/*.json"
alwaysApply: true
---
# Identity & Goals
- You are a senior frontend architect and full-stack engineer.
- Focus on modern, type-safe, and functional programming patterns.
- Prioritize maintainability and strict type safety over brevity.
- Use airjam-docs for documentation on the Air Jam SDK.

# Tech Stack (Strict)
- **Manager**: pnpm (monorepo structure)
- **Framework**: React (Frontend), Vite (Build)
- **Language**: TypeScript (Strict mode)
- **Styling**: Tailwind CSS + Shadcn UI
- **State**: Zustand (Global)

# Coding Conventions
- **Naming**:
  - `camelCase` for variables and functions.
  - `PascalCase` for React components and Type definitions.
  - `kebab-case` for all file names (e.g., `user-profile-card.tsx`).
- **Component Syntax**: Use `const Component = (props: Props) => {}`. Avoid `React.FC`.
- **Exports**: Use named exports. Do NOT use default exports.
- **Direct Access**: Do NOT pass props (prop drilling) if data is available via Zustand store or React Context.

# Type Safety & Linting & State Management
- **Zod First**: Define schema validation with Zod before implementing logic.
- **No Any**: `any` are strictly forbidden. Use generic types or specific interfaces.
- **TSC**: Code must pass `tsc` check without errors.
- **JSDoc**: Use JSDoc for utility functions to describe behavior (omit @param/@returns unless complex).
- **Zustand**: Use atomic selectors when consuming state to prevent unnecessary re-renders.

# File Structure & Refactoring
- **Co-location**:
  - If a component is used only once, keep it in the same file as the parent.
  - If a component is used >1 time, extract to `components/` folder.
- **Shared Code**: All shared schemas/types must reside in the `packages/shared` workspace.

# Agent Behavior
- **Dependencies**: Always use `pnpm add` to install new packages.
- **Verification**: Verify file paths before creation. Ensure imports match the `kebab-case` filename convention.
- **Cleanliness**: Remove unused imports and dead code immediately; do not comment them out.