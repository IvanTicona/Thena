// ***********************************************************
// cypress/support/e2e.ts
// Global setup file — runs before all test files.
// ***********************************************************

// Import custom commands
import './commands';

// Disable uncaught exception failures for known async React errors
// that don't affect test validity (e.g. lazy-load chunk errors in test env)
Cypress.on('uncaught:exception', (err) => {
  // Ignore ResizeObserver loop errors (common in layout-heavy apps)
  if (err.message.includes('ResizeObserver loop')) return false;
  // Ignore dynamic import / chunk load errors
  if (err.message.includes('Loading chunk')) return false;
  // Ignore Vite HMR errors
  if (err.message.includes('Failed to fetch dynamically')) return false;
  // For all other errors, let Cypress handle them
  return true;
});
