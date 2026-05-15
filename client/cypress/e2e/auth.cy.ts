// ***********************************************************
// cypress/e2e/auth.cy.ts
// Auth flow E2E tests — login, failed login, logout
// ***********************************************************

/// <reference types="cypress" />

describe('Auth Flow', () => {
  const studentEmail = Cypress.env('studentEmail') as string;
  const studentPassword = Cypress.env('studentPassword') as string;
  const tutorEmail = Cypress.env('tutorEmail') as string;
  const tutorPassword = Cypress.env('tutorPassword') as string;

  // ── Login page renders ───────────────────────────────────

  describe('Login Page', () => {
    beforeEach(() => {
      cy.visit('/login');
    });

    it('renders the login form', () => {
      cy.contains('Bienvenido').should('be.visible');
      cy.contains('Ingresá a tu cuenta').should('be.visible');
      cy.get('input[autocomplete="email"]').should('exist');
      cy.get('input[autocomplete="current-password"]').should('exist');
      cy.contains('button', 'Iniciar Sesión').should('be.visible');
    });

    it('shows validation errors when submitting empty form', () => {
      cy.contains('button', 'Iniciar Sesión').click();
      cy.contains('Ingresá tu correo electrónico').should('be.visible');
      cy.contains('Ingresá tu contraseña').should('be.visible');
    });

    it('shows an error for invalid email format', () => {
      cy.get('input[autocomplete="email"]').type('notanemail');
      cy.get('input[autocomplete="current-password"]').type('somepassword');
      cy.contains('button', 'Iniciar Sesión').click();
      cy.contains('Ingresá un correo electrónico válido').should('be.visible');
    });

    it('shows an error alert for wrong credentials', () => {
      cy.get('input[autocomplete="email"]').type('wrong@email.com');
      cy.get('input[autocomplete="current-password"]').type('wrongpassword');
      cy.contains('button', 'Iniciar Sesión').click();
      // Server returns 401 — the Alert component renders with the error message
      cy.get('.ant-alert[class*="error"]', { timeout: 10000 }).should('be.visible');
    });

    it('redirects to /login when visiting / unauthenticated', () => {
      cy.visit('/');
      cy.url().should('include', '/login');
    });

    it('redirects to /dashboard from /login when already authenticated', () => {
      cy.loginByApi(studentEmail, studentPassword);
      cy.visit('/login');
      // PublicOnlyRoute should redirect to /dashboard
      cy.url().should('include', '/dashboard');
    });
  });

  // ── Student login ────────────────────────────────────────

  describe('Student login flow', () => {
    it('logs in as student and lands on /dashboard', () => {
      cy.login(studentEmail, studentPassword);
      cy.url().should('include', '/dashboard', { timeout: 10000 });
      cy.contains('Bienvenido').should('be.visible');
    });
  });

  // ── Tutor login ──────────────────────────────────────────

  describe('Tutor login flow', () => {
    it('logs in as tutor and lands on /tutor', () => {
      cy.login(tutorEmail, tutorPassword);
      // Tutor goes to /tutor (TutorDashboard) after the redirect from "/"
      cy.url().should('include', '/tutor', { timeout: 10000 });
      cy.contains('Panel del Tutor').should('be.visible');
    });
  });

  // ── Logout ───────────────────────────────────────────────

  describe('Logout', () => {
    beforeEach(() => {
      cy.loginByApi(studentEmail, studentPassword);
      cy.visit('/dashboard');
    });

    it('logs out and redirects to /login', () => {
      cy.logout();
      cy.url().should('include', '/login');
    });

    it('cannot access /dashboard after logout', () => {
      cy.logout();
      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });
  });

  // ── Change Password ───────────────────────────────────────

  describe('Change Password', () => {
    beforeEach(() => {
      cy.loginByApi(studentEmail, studentPassword);
      cy.visit('/dashboard');
    });

    it('opens the change password modal from the user menu', () => {
      cy.get('.app-layout__user-btn').click();
      cy.contains('.ant-dropdown-menu-item', 'Cambiar Contraseña').click();
      cy.get('.ant-modal-content', { timeout: 5000 }).should('be.visible');
      cy.contains('Cambiar Contraseña').should('be.visible');
    });

    it('closes the change password modal with Cancel', () => {
      cy.get('.app-layout__user-btn').click();
      cy.contains('.ant-dropdown-menu-item', 'Cambiar Contraseña').click();
      cy.get('.ant-modal-content', { timeout: 5000 }).should('be.visible');
      cy.contains('button', 'Cancelar').click();
      cy.get('.ant-modal-content').should('not.exist');
    });

    it('shows validation errors when submitting empty form', () => {
      cy.get('.app-layout__user-btn').click();
      cy.contains('.ant-dropdown-menu-item', 'Cambiar Contraseña').click();
      cy.get('.ant-modal-content', { timeout: 5000 }).should('be.visible');
      cy.contains('button', 'Guardar').click();
      // Ant Design Form should show required field errors
      cy.get('.ant-form-item-explain-error', { timeout: 5000 }).should(
        'have.length.gte',
        1,
      );
    });
  });
});
