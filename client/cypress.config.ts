import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    video: false,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,
    viewportWidth: 1280,
    viewportHeight: 800,
    env: {
      apiUrl: 'http://localhost:3000/api/v1',
      studentEmail: 'student@thena.dev',
      studentPassword: 'devpassword123',
      tutorEmail: 'tutor@thena.dev',
      tutorPassword: 'devpassword123',
    },
  },
});
