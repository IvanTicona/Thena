// ***********************************************************
// cypress/support/commands.ts
// Custom Cypress commands for Thena E2E tests.
// ***********************************************************

/// <reference types="cypress" />

// ── Type declarations for custom commands ─────────────────

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login via the UI login form.
       * Navigates to /login, fills email + password, submits.
       * @param email - The user's email address
       * @param password - The user's password
       */
      login(email: string, password: string): Chainable<void>;

      /**
       * Login via API (faster — skips UI form, sets cookie directly).
       * Use this for tests that don't test the login flow itself.
       * @param email - The user's email address
       * @param password - The user's password
       */
      loginByApi(email: string, password: string): Chainable<void>;

      /**
       * Logout by clicking the logout button in the AppLayout header.
       */
      logout(): Chainable<void>;
    }
  }
}

// ── cy.login — UI-based login ──────────────────────────────

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login');
  cy.url().should('include', '/login');

  // Ant Design Input — the actual <input> is inside the wrapper
  cy.get('input[autocomplete="email"]').clear().type(email);
  cy.get('input[autocomplete="current-password"]').clear().type(password);

  // Submit — find the login button by its text
  cy.contains('button', 'Iniciar Sesión').click();
});

// ── cy.loginByApi — programmatic login via API ─────────────

Cypress.Commands.add('loginByApi', (email: string, password: string) => {
  const apiUrl = Cypress.env('apiUrl') as string;

  cy.request({
    method: 'POST',
    url: `${apiUrl}/auth/login`,
    body: { email, password },
    // The server sets an httpOnly cookie — cy.request will store it
    withCredentials: true,
  }).then((response) => {
    expect(response.status).to.eq(201);
  });
});

// ── cy.logout — UI-based logout ───────────────────────────

Cypress.Commands.add('logout', () => {
  // The user button in AppLayout header is a .app-layout__user-btn
  // It opens an Ant Design Dropdown with "Cerrar Sesión" menu item
  cy.get('.app-layout__user-btn').click();
  cy.contains('.ant-dropdown-menu-item', 'Cerrar Sesión').click();
  cy.url().should('include', '/login');
});

export {};
