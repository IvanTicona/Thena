// ***********************************************************
// cypress/e2e/admin-flow.cy.ts
// Admin full flow E2E:
//   login → admin panel → metrics → users → alerts → audit logs → knowledge
// ***********************************************************

/// <reference types="cypress" />

describe('Admin Flow', () => {
  const adminEmail = Cypress.env('adminEmail') as string;
  const adminPassword = Cypress.env('adminPassword') as string;

  beforeEach(() => {
    cy.loginByApi(adminEmail, adminPassword);
  });

  // ── Admin Dashboard ───────────────────────────────────────

  describe('Admin Dashboard', () => {
    it('shows the admin panel at /admin', () => {
      cy.visit('/admin');
      cy.url().should('include', '/admin');
    });

    it('shows the admin sidebar menu', () => {
      cy.visit('/admin');
      cy.get('.app-layout__sider').within(() => {
        cy.contains('Panel de Admin').should('be.visible');
        cy.contains('Gestión de Usuarios').should('be.visible');
        cy.contains('Alertas').should('be.visible');
      });
    });

    it('blocks /dashboard (student-only route) for admin', () => {
      cy.visit('/dashboard');
      cy.url().should('not.include', '/dashboard');
    });
  });

  // ── Metrics ───────────────────────────────────────────────

  describe('Metrics', () => {
    it('shows metrics cards with counts', () => {
      cy.visit('/admin');
      // Admin dashboard has metric cards
      cy.get('.admin-dashboard, .ant-card', { timeout: 10000 }).should('exist');
    });
  });

  // ── User Management ───────────────────────────────────────

  describe('User Management', () => {
    it('navigates to user management from sidebar', () => {
      cy.visit('/admin');
      cy.get('.app-layout__sider').contains('Gestión de Usuarios').click();
      cy.url().should('include', '/admin/users');
    });

    it('shows users table with headers', () => {
      cy.visit('/admin/users');
      cy.contains('Nombre').should('be.visible');
      cy.contains('Email').should('be.visible');
      cy.contains('Rol').should('be.visible');
    });

    it('shows Create User button', () => {
      cy.visit('/admin/users');
      cy.contains('button', 'Crear Usuario', { timeout: 8000 }).should('exist');
    });

    it('opens the create user modal', () => {
      cy.visit('/admin/users');
      cy.contains('button', 'Crear Usuario', { timeout: 8000 }).click();
      cy.get('.ant-modal-content', { timeout: 5000 }).should('be.visible');
      cy.contains('Crear nuevo usuario').should('be.visible');
      // Close it
      cy.get('.ant-modal-close').click();
    });

    it('has a search/filter input', () => {
      cy.visit('/admin/users');
      cy.get('input[type="search"], input[placeholder*="Buscar"]', { timeout: 8000 }).should(
        'exist',
      );
    });
  });

  // ── Alerts ────────────────────────────────────────────────

  describe('Alerts', () => {
    it('navigates to alerts page', () => {
      cy.visit('/admin');
      cy.get('.app-layout__sider').contains('Alertas').click();
      cy.url().should('include', '/admin/alerts');
    });

    it('shows alerts table or empty state', () => {
      cy.visit('/admin/alerts');
      cy.get('.ant-table, .ant-empty', { timeout: 10000 }).should('exist');
    });
  });

  // ── Audit Logs ────────────────────────────────────────────

  describe('Audit Logs', () => {
    it('navigates to audit logs', () => {
      cy.visit('/admin');
      cy.get('.app-layout__sider').contains('Logs de Auditoría').click();
      cy.url().should('include', '/admin/audit');
    });

    it('shows audit logs table', () => {
      cy.visit('/admin/audit');
      cy.get('.ant-table', { timeout: 10000 }).should('exist');
    });
  });

  // ── Knowledge Base (Admin) ────────────────────────────────

  describe('Knowledge Base', () => {
    it('navigates to admin knowledge base', () => {
      cy.visit('/admin');
      cy.get('.app-layout__sider').contains('Base de Conocimiento').click();
      cy.url().should('include', '/knowledge');
    });

    it('shows institutional knowledge management UI', () => {
      cy.visit('/admin/knowledge');
      cy.get('.ant-card, .knowledge', { timeout: 10000 }).should('exist');
    });
  });

  // ── Assignment Management ─────────────────────────────────

  describe('Assignment Management', () => {
    it('navigates to assignment management', () => {
      cy.visit('/admin');
      cy.get('.app-layout__sider').contains('Asignaciones').click();
      cy.url().should('include', '/admin/assignments');
    });

    it('shows assignments table', () => {
      cy.visit('/admin/assignments');
      cy.get('.ant-table', { timeout: 10000 }).should('exist');
    });
  });
});
