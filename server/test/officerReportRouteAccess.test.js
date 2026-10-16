const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const routes = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'officer', 'officerRoutes.js'),
  'utf8'
);
const controller = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'officerController.js'),
  'utf8'
);

test('officer summary routes allow officers and retain role protection', () => {
  assert.match(
    routes,
    /router\.get\('\/reports\/compliance-summary', verifyToken, requireRole\(\['officer'\]/
  );
  assert.match(
    routes,
    /router\.get\('\/reports\/task-completion', verifyToken, requireRole\(\['officer'\]/
  );
});

test('officers can request supported scholar report types without bypassing report validation', () => {
  assert.match(controller, /const supportedReportTypes = new Set\(\[/);
  for (const reportType of ['Monthly Letter', 'Report Cards', 'Grades', 'Report Cards & Grades', 'COR', 'Other Documents']) {
    assert.ok(controller.includes(`'${reportType}'`), `${reportType} should be supported`);
  }
  assert.match(controller, /if \(!supportedReportTypes\.has\(report_type\)\)/);
  assert.doesNotMatch(controller, /Officers may access monthly letter summaries only/);
});

test('selected assigned year levels are normalized before filtering scholars', () => {
  assert.match(controller, /yearLevelSqlExpression\('u\.year_level'\)/);
  assert.match(controller, /scholarValues\.push\(normalizeYearLevel\(scholar_group\)\)/);
});
