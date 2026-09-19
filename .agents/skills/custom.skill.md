# Frontend Development Skill

## Objective

Build a production-quality React/Next.js feature using **component-based architecture**, **custom React hooks**, clean separation of concerns, and maintainable TypeScript code.

The implementation must contain a **minimum of 200 meaningful lines of code (LOC)**.

---

## Core Requirements

### 1. Minimum LOC

* The implementation must contain **at least 200 meaningful lines of code**.
* LOC must represent actual functionality.
* Do not artificially increase LOC using:

  * Blank lines
  * Repeated code
  * Unnecessary comments
  * Duplicate components
  * Unused variables/functions
  * Boilerplate that provides no value

The 200 LOC requirement should naturally result from implementing the required functionality.

---

### 2. Component-Based Architecture

Use a component-based architecture.

The feature must be divided into multiple focused and reusable components.

A recommended structure is:

```text
feature/
├── components/
    |__
├── hooks/
    |__
├── services/
    |__
├── types/
    |__
└── page.tsx
```

Do not implement the entire feature inside a single large component.

Each component should have a clear responsibility.

---

## 3. Custom Hooks


Custom hooks should encapsulate reusable stateful or business logic.

Custom hooks may handle:

* Data fetching
* State management
* Filtering
* Pagination
* Debouncing
* Form state
* Event handling
* Derived state
* Local persistence

Avoid putting complex business logic directly inside presentation components.

---
