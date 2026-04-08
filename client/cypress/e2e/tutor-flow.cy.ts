// ***********************************************************
// cypress/e2e/tutor-flow.cy.ts
// Tutor full flow E2E:
//   login → tutor dashboard → view submissions → view review → approve/reject chapter
// ***********************************************************

/// <reference types="cypress" />

describe('Tutor Flow', () => {
  const tutorEmail = Cypress.env('tutorEmail') as string;
  const tutorPassword = Cypress.env('tutorPassword') as string;

  // Use fast API login before each test
  beforeEach(() => {
    cy.loginByApi(tutorEmail, tutorPassword);
  });

  // ── Tutor Dashboard ───────────────────────────────────────

  describe('Tutor Dashboard', () => {
    it('shows the tutor dashboard at /tutor', () => {
      cy.visit('/tutor');
      cy.url().should('include', '/tutor');
      cy.contains('Panel del Tutor').should('be.visible');
    });

    it('shows the sidebar menu with navigation items', () => {
      cy.visit('/tutor');
      cy.get('.app-layout__sider').within(() => {
        cy.contains('Panel de Tutor').should('be.visible');
        cy.contains('Base de Conocimiento').should('be.visible');
      });
    });

    it('shows thesis cards or empty state', () => {
      cy.visit('/tutor');
      cy.get('.tutor-dashboard__loading', { timeout: 8000 }).should('not.exist');
      // Either thesis cards or empty state
      cy.get('.thesis-card, .tutor-dashboard__empty, .ant-empty', {
        timeout: 10000,
      }).should('exist');
    });

    it('shows assigned theses with student names', () => {
      cy.visit('/tutor');
      // Wait for loading to finish
      cy.get('.tutor-dashboard__loading', { timeout: 8000 }).should('not.exist');

      cy.get('.thesis-card', { timeout: 10000 }).then(($cards) => {
        if ($cards.length > 0) {
          // Each thesis card should have student info visible
          cy.wrap($cards.first()).within(() => {
            cy.get('.thesis-card__student-info').should('exist');
          });
        } else {
          cy.log('No theses assigned to this tutor — empty state shown');
        }
      });
    });

    it('blocks /dashboard (student-only route) for tutor', () => {
      cy.visit('/dashboard');
      // ProtectedRoute with allowedRoles=['STUDENT'] should block tutors
      cy.url().should('not.include', '/dashboard');
    });
  });

  // ── Chapter expansion ─────────────────────────────────────

  describe('Chapter List Expansion', () => {
    it('expands a thesis card to see chapters', () => {
      cy.visit('/tutor');
      cy.get('.tutor-dashboard__loading', { timeout: 8000 }).should('not.exist');

      cy.get('.thesis-card', { timeout: 10000 }).then(($cards) => {
        if ($cards.length > 0) {
          // Click "Ver capítulos" button to expand
          cy.wrap($cards.first())
            .contains('Ver capítulos')
            .click();
          // Chapters list should be visible
          cy.wrap($cards.first())
            .find('.thesis-card__chapters')
            .should('exist');
        } else {
          cy.log('No thesis cards — skipping expansion test');
        }
      });
    });

    it('shows chapter status tags in the expanded list', () => {
      cy.visit('/tutor');
      cy.get('.tutor-dashboard__loading', { timeout: 8000 }).should('not.exist');

      cy.get('.thesis-card', { timeout: 10000 }).then(($cards) => {
        if ($cards.length > 0) {
          cy.wrap($cards.first()).contains('Ver capítulos').click();
          cy.wrap($cards.first())
            .find('.ant-tag')
            .should('have.length.gte', 1);
        } else {
          cy.log('No thesis cards — skipping status tags test');
        }
      });
    });
  });

  // ── Submission review navigation ──────────────────────────

  describe('Submission Review', () => {
    it('navigates to submission review when "Ver revisión" is clicked', () => {
      cy.visit('/tutor');
      cy.get('.tutor-dashboard__loading', { timeout: 8000 }).should('not.exist');

      cy.get('.thesis-card', { timeout: 10000 }).then(($cards) => {
        if ($cards.length > 0) {
          cy.wrap($cards.first()).contains('Ver capítulos').click();

          // Look for "Ver revisión" link in the chapter list
          cy.wrap($cards.first())
            .find('button, a')
            .contains('Ver revisión')
            .then(($link) => {
              if ($link.length > 0) {
                cy.wrap($link).first().click();
                // Should navigate to /tutor/submissions/:submissionId?chapterId=...
                cy.url().should(
                  'match',
                  /\/tutor\/submissions\/[a-zA-Z0-9-]+\?chapterId=/,
                );
              } else {
                cy.log('No submissions available to review — skipping navigation test');
              }
            });
        } else {
          cy.log('No thesis cards — skipping submission review test');
        }
      });
    });

    it('renders the submission review page with approve/reject buttons', () => {
      cy.visit('/tutor');
      cy.get('.tutor-dashboard__loading', { timeout: 8000 }).should('not.exist');

      cy.get('.thesis-card', { timeout: 10000 }).then(($cards) => {
        if ($cards.length > 0) {
          cy.wrap($cards.first()).contains('Ver capítulos').click();

          cy.wrap($cards.first())
            .find('button, a')
            .contains('Ver revisión')
            .then(($link) => {
              if ($link.length > 0) {
                cy.wrap($link).first().click();
                cy.url().should('match', /\/tutor\/submissions\//);

                // The submission review page has approve / reject buttons
                cy.contains('button', 'Aprobar capítulo', { timeout: 10000 }).should(
                  'exist',
                );
                cy.contains('button', 'Rechazar capítulo').should('exist');
              } else {
                cy.log('No submissions to review');
              }
            });
        } else {
          cy.log('No thesis cards');
        }
      });
    });

    it('shows "Volver al panel" button in submission review', () => {
      cy.visit('/tutor');
      cy.get('.tutor-dashboard__loading', { timeout: 8000 }).should('not.exist');

      cy.get('.thesis-card', { timeout: 10000 }).then(($cards) => {
        if ($cards.length > 0) {
          cy.wrap($cards.first()).contains('Ver capítulos').click();

          cy.wrap($cards.first())
            .find('button, a')
            .contains('Ver revisión')
            .then(($link) => {
              if ($link.length > 0) {
                cy.wrap($link).first().click();
                cy.contains('Volver al panel', { timeout: 8000 }).should(
                  'be.visible',
                );
              } else {
                cy.log('No submissions to review');
              }
            });
        } else {
          cy.log('No thesis cards');
        }
      });
    });
  });

  // ── Approve chapter flow (requires IN_REVIEW chapter) ─────

  describe('Approve Chapter (direct approval from thesis card)', () => {
    it('shows Aprobar button for IN_REVIEW chapters and triggers confirm modal', () => {
      cy.visit('/tutor');
      cy.get('.tutor-dashboard__loading', { timeout: 8000 }).should('not.exist');

      cy.get('.thesis-card', { timeout: 10000 }).then(($cards) => {
        if ($cards.length > 0) {
          cy.wrap($cards.first()).contains('Ver capítulos').click();

          // Look for an "Aprobar" button (only present for IN_REVIEW chapters)
          cy.wrap($cards.first())
            .find('button')
            .contains('Aprobar')
            .then(($btn) => {
              if ($btn.length > 0) {
                cy.wrap($btn).first().click();
                // Ant Design Modal.confirm should appear
                cy.get('.ant-modal-content', { timeout: 5000 }).should('be.visible');
                cy.contains('Aprobar capítulo').should('be.visible');
                // Cancel the modal — we don't want to actually approve in E2E
                cy.contains('button', 'Cancelar').click();
                cy.get('.ant-modal-content').should('not.exist');
              } else {
                cy.log('No IN_REVIEW chapters — Aprobar button not shown');
              }
            });
        } else {
          cy.log('No thesis cards');
        }
      });
    });

    it('shows Rechazar button for IN_REVIEW chapters and triggers confirm modal', () => {
      cy.visit('/tutor');
      cy.get('.tutor-dashboard__loading', { timeout: 8000 }).should('not.exist');

      cy.get('.thesis-card', { timeout: 10000 }).then(($cards) => {
        if ($cards.length > 0) {
          cy.wrap($cards.first()).contains('Ver capítulos').click();

          cy.wrap($cards.first())
            .find('button')
            .contains('Rechazar')
            .then(($btn) => {
              if ($btn.length > 0) {
                cy.wrap($btn).first().click();
                cy.get('.ant-modal-content', { timeout: 5000 }).should('be.visible');
                cy.contains('Rechazar capítulo').should('be.visible');
                cy.contains('button', 'Cancelar').click();
                cy.get('.ant-modal-content').should('not.exist');
              } else {
                cy.log('No IN_REVIEW chapters — Rechazar button not shown');
              }
            });
        } else {
          cy.log('No thesis cards');
        }
      });
    });
  });

  // ── Knowledge Base navigation ─────────────────────────────

  describe('Knowledge Base', () => {
    it('navigates to knowledge base from sidebar', () => {
      cy.visit('/tutor');
      cy.get('.app-layout__sider').within(() => {
        cy.contains('Base de Conocimiento').click();
      });
      cy.url().should('include', '/tutor/knowledge');
    });
  });
});
