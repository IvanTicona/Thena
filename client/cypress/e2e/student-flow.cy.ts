// ***********************************************************
// cypress/e2e/student-flow.cy.ts
// Student full flow E2E:
//   login → dashboard → chapters → upload DOCX → poll review → view observations
// ***********************************************************

/// <reference types="cypress" />

describe('Student Flow', () => {
  const studentEmail = Cypress.env('studentEmail') as string;
  const studentPassword = Cypress.env('studentPassword') as string;

  // Use fast API login before each test in this suite
  beforeEach(() => {
    cy.loginByApi(studentEmail, studentPassword);
  });

  // ── Dashboard ─────────────────────────────────────────────

  describe('Student Dashboard', () => {
    it('shows the student dashboard at /dashboard', () => {
      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
      cy.contains('Bienvenido').should('be.visible');
    });

    it('shows the THENA brand and student navigation', () => {
      cy.visit('/dashboard');
      cy.contains('THENA').should('be.visible');
      cy.get('.app-layout__nav').within(() => {
        cy.contains('Dashboard').should('be.visible');
        cy.contains('Revisión').should('be.visible');
      });
    });

    it('displays thesis title and chapter cards when thesis exists', () => {
      cy.visit('/dashboard');
      // Wait for API response — thesis data loads asynchronously
      cy.get('.student-dashboard__project-card', { timeout: 10000 })
        .should('exist')
        .within(() => {
          cy.contains('PROYECTO DE GRADO').should('exist');
        });
    });

    it('shows chapter status cards in the dashboard', () => {
      cy.visit('/dashboard');
      cy.get('.student-dashboard__chapter-card', { timeout: 10000 }).should(
        'have.length.gte',
        1,
      );
    });

    it('redirects / to /dashboard for authenticated student', () => {
      cy.visit('/');
      cy.url().should('include', '/dashboard');
    });

    it('blocks /tutor from student — redirects away or shows 403', () => {
      cy.visit('/tutor');
      // ProtectedRoute with allowedRoles=['TUTOR'] will redirect non-tutors
      cy.url().should('not.include', '/tutor').or('contain', '/dashboard');
    });
  });

  // ── Chapter navigation ────────────────────────────────────

  describe('Chapter Navigation', () => {
    it('navigates to the first chapter detail when clicking a chapter card', () => {
      cy.visit('/dashboard');
      // Wait for chapter cards to load
      cy.get('.student-dashboard__chapter-card--clickable', { timeout: 10000 })
        .first()
        .click();
      cy.url().should('match', /\/chapters\/[a-zA-Z0-9-]+$/);
    });

    it('shows chapter detail page with upload dragger or status alert', () => {
      cy.visit('/dashboard');
      cy.get('.student-dashboard__chapter-card--clickable', { timeout: 10000 })
        .first()
        .click();
      cy.url().should('match', /\/chapters\/[a-zA-Z0-9-]+$/);
      // Either the upload zone or a status alert (if chapter is IN_REVIEW or APPROVED)
      cy.get(
        '.chapter-detail__upload-card, .chapter-detail__status-alert, .chapter-detail__review-banner',
        { timeout: 8000 },
      ).should('exist');
    });

    it('shows the submission history table', () => {
      cy.visit('/dashboard');
      cy.get('.student-dashboard__chapter-card--clickable', { timeout: 10000 })
        .first()
        .click();
      cy.contains('Historial de Entregas', { timeout: 8000 }).should('be.visible');
    });
  });

  // ── DOCX upload ───────────────────────────────────────────

  describe('DOCX Upload', () => {
    it('uploads a DOCX file using the file input', () => {
      // Navigate directly to chapters — find first DRAFT chapter with upload available
      cy.visit('/chapters');
      // If it redirects to a specific chapter, that's fine too
      cy.url().should('match', /\/chapters/);

      // Wait for the chapter detail to load
      cy.get('.chapter-detail__upload-card', { timeout: 10000 }).then(
        ($card) => {
          if ($card.length > 0) {
            // Upload zone is available — attach the fixture file
            cy.get('.chapter-detail__upload-card input[type="file"]').selectFile(
              'cypress/fixtures/sample.docx',
              { force: true },
            );

            // After upload, should navigate to review page or show progress
            cy.url().should('match', /\/chapters\/[^/]+\/review\/[^/]+/, {
              timeout: 15000,
            });
          } else {
            // Chapter is IN_REVIEW or APPROVED — upload not available in this state
            cy.log('Chapter not in DRAFT state — skipping upload test');
          }
        },
      );
    });
  });

  // ── Review view ───────────────────────────────────────────

  describe('Review View', () => {
    it('reaches the review view from the chapter detail table', () => {
      cy.visit('/dashboard');
      cy.get('.student-dashboard__chapter-card--clickable', { timeout: 10000 })
        .first()
        .click();
      cy.url().should('match', /\/chapters\/[a-zA-Z0-9-]+$/);

      // If there's a "Ver Revisión" or "Ver Progreso" link in the history table, click it
      cy.get('.chapter-detail__history-card', { timeout: 8000 }).within(() => {
        cy.get('button, a').contains(/Ver Revisión|Ver Progreso/).then(($btn) => {
          if ($btn.length > 0) {
            cy.wrap($btn).first().click();
            cy.url().should(
              'match',
              /\/chapters\/[^/]+\/review\/[^/]+/,
            );
          } else {
            cy.log('No completed submissions in history — skipping review navigation');
          }
        });
      });
    });

    it('review view shows processing state or observations panel', () => {
      // Navigate to the review page via the chapter history if a review exists
      cy.visit('/dashboard');
      cy.get('.student-dashboard__chapter-card--clickable', { timeout: 10000 })
        .first()
        .click();

      cy.get('.chapter-detail__history-card', { timeout: 8000 }).within(() => {
        cy.get('button').contains(/Ver Revisión|Ver Progreso/).then(($btn) => {
          if ($btn.length > 0) {
            cy.wrap($btn).first().click();
            // Wait for the review page to render
            // It shows a Spin+Steps while processing, or Allotment split view when completed
            cy.get(
              '.ant-spin, .review-view__split, .submission-review__split, .submission-review__processing',
              { timeout: 15000 },
            ).should('exist');
          } else {
            cy.log('No submissions available — skipping review view test');
          }
        });
      });
    });
  });

  // ── Notification bell ─────────────────────────────────────

  describe('Notifications', () => {
    it('shows the notification bell icon in the header', () => {
      cy.visit('/dashboard');
      // NotificationBell is rendered in AppLayout header
      cy.get('.app-layout__header').within(() => {
        cy.get('.ant-badge, [class*="notification"]').should('exist');
      });
    });
  });
});
