# ISO/IEC 25010 Software Quality Evaluation

## Scope

This document defines the evaluation plan for the Apple Scholar System using the ISO/IEC 25010 product quality model. The correct standard reference is **ISO/IEC 25010**, not ISO/IEC 2510.

The evaluation should be conducted with representative scholars, officers, staff, and administrators after the core workflows are stable. Survey results must be reported with the number of respondents, role distribution, date, instrument version, and response scale.

## Evaluation Scale

Respondents rate each statement using a five-point Likert scale:

| Score | Interpretation |
| --- | --- |
| 5 | Strongly Agree |
| 4 | Agree |
| 3 | Neither Agree nor Disagree |
| 2 | Disagree |
| 1 | Strongly Disagree |

For each quality characteristic:

`Mean score = sum of item scores / number of valid responses`

`Percentage score = (mean score / 5) x 100`

Suggested interpretation:

| Percentage | Interpretation |
| --- | --- |
| 90-100% | Excellent |
| 80-89% | Very Good |
| 70-79% | Good |
| 60-69% | Fair; improvement recommended |
| Below 60% | Poor; corrective action required |

These thresholds are project evaluation criteria, not claims that ISO/IEC 25010 defines mandatory pass marks.

## Evaluation Matrix

| ISO/IEC 25010 characteristic | Application to Apple Scholar | Measurable indicators | Evidence or test method |
| --- | --- | --- | --- |
| Functional suitability | The system supports role-based access, scholar profiles, submissions, grade and document uploads, officer review, compliance tracking, notifications, analytics, audit logs, and exports. | Required workflow completion rate; functional test pass rate; percentage of requirements implemented; number of critical defects. | Traceability matrix, acceptance tests, role-based workflow tests, issue log. |
| Performance efficiency | The system should provide responsive page loads and API operations while handling normal scholar and staff workloads. | Median and 95th-percentile API response time; page load time; concurrent-user test result; upload completion time; server resource use. | Browser performance tools, API timing logs, controlled load test, upload test using files up to the configured 10 MB limit. |
| Compatibility | The system should work with supported browsers, the client-server API, MySQL, Cloudinary, SMTP, Google Sheets, and the optional ML service. | Browser pass rate; API integration pass rate; successful external-service calls; layout and workflow consistency across supported screen sizes. | Compatibility checklist, integration tests, browser tests, mobile and desktop verification. |
| Usability | Scholars and staff should be able to complete common tasks with understandable labels, feedback, validation, and navigation. | Task completion rate; time on task; error frequency; System Usability Scale (SUS) score if administered; user satisfaction mean. | Moderated task observation, SUS questionnaire, support/request log, accessibility and responsive-layout review. |
| Reliability | The system should preserve data, handle failures predictably, and recover from temporary service or network problems. | Successful request rate; failed upload recovery rate; data integrity defects; backup restore result; notification retry/failure visibility. | Error logs, database integrity checks, backup and restore drill, failure-injection tests, notification logs. |
| Security | The system should restrict access to authorized roles and protect scholar data and uploaded files. | Unauthorized access rejection rate; authentication and authorization test pass rate; upload validation pass rate; audit-log coverage; security finding count. | Route authorization tests, input validation tests, file-size/MIME/signature tests, audit-log review, dependency and configuration review. Production claims must also verify HTTPS, private/signed URLs, encryption, malware scanning, rate limiting, and retention controls. |
| Maintainability | The code should be understandable, modular, testable, and support controlled changes. | Lint/type/syntax result; test coverage for critical paths; defect correction time; dependency freshness; duplicated-code or complexity findings. | Code review, static checks, test reports, change history, issue resolution records, deployment checklist. |
| Portability | The system should be deployable in supported environments and usable across supported operating systems, browsers, and screen sizes. | Environment setup success rate; deployment repeatability; browser/OS pass rate; responsive workflow pass rate; configuration portability. | Clean-environment deployment, installation checklist, browser matrix, desktop/mobile tests, environment configuration review. |

## Suggested Questionnaire

Use the statements below as a project-specific instrument. Respondents should answer only items they can reasonably observe from their role. Add a Not Applicable option during collection, but exclude Not Applicable responses from the denominator.

### Functional suitability

1. The system provides the functions needed for my assigned role.
2. I can complete my main workflow without using an unrecorded manual workaround.
3. The submission, review, compliance, and reporting results are appropriate for their intended purpose.
4. The system provides sufficient information for me to make or act on a decision.

### Performance efficiency

1. Pages and dashboards load within an acceptable amount of time.
2. Search, filtering, and report operations respond within an acceptable amount of time.
3. File uploads provide clear progress or completion feedback.
4. The system remains usable when several users are working at the same time.

### Compatibility

1. The system works correctly in the supported browser that I use.
2. The client and server exchange data correctly during normal workflows.
3. Connected services such as file storage, email, exports, or ML evaluation behave consistently when configured.
4. The system remains usable on the supported desktop and mobile screen sizes.

### Usability

1. The labels, instructions, and status messages are easy to understand.
2. I can find the functions needed for my role without unnecessary steps.
3. The system clearly identifies validation errors and how to correct them.
4. I can tell whether an upload, review, export, or notification action succeeded.

### Reliability

1. The system completes normal operations without unexpected failures.
2. My submitted data remains accurate after saving and reopening it.
3. The system handles failed or interrupted operations with understandable feedback.
4. Logs or status records make important failures and notification results visible to authorized users.

### Security

1. I can access only the functions and scholar information appropriate to my role.
2. The system requires authentication before protected information or files are accessed.
3. The system validates uploaded file type and size before accepting a file.
4. Important account, file, review, and data actions are recorded in an audit trail.

### Maintainability

1. Changes to one module can be made without unexpectedly breaking unrelated workflows.
2. The system has clear and consistent structures that support future maintenance.
3. Errors and important operations provide enough technical information for troubleshooting.
4. The project has adequate documentation for setup, configuration, and deployment.

### Portability

1. The system can be installed and configured in the supported deployment environment.
2. The system works across the supported browsers and operating systems.
3. The responsive interface supports the workflows I need on desktop and mobile devices.
4. The system can be moved to another supported environment by following the documented setup steps.

## Reporting Template

| Characteristic | Valid responses | Mean | Percentage | Interpretation | Key evidence | Improvement action |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Functional suitability | TBD | TBD | TBD | TBD | Acceptance test results | TBD |
| Performance efficiency | TBD | TBD | TBD | TBD | Timing/load results | TBD |
| Compatibility | TBD | TBD | TBD | TBD | Browser/integration matrix | TBD |
| Usability | TBD | TBD | TBD | TBD | Questionnaire/task results | TBD |
| Reliability | TBD | TBD | TBD | TBD | Error and restore tests | TBD |
| Security | TBD | TBD | TBD | TBD | Authorization/upload/audit tests | TBD |
| Maintainability | TBD | TBD | TBD | TBD | Code quality and test results | TBD |
| Portability | TBD | TBD | TBD | TBD | Deployment/browser/device tests | TBD |

## Interpretation and Limitations

- ISO/IEC 25010 provides a quality model; it does not by itself certify that this system is compliant or secure.
- Survey perception scores must be reported separately from objective technical measurements.
- A high usability score does not prove security, malware protection, encryption at rest, or regulatory compliance.
- Security claims must be limited to controls that were actually implemented and tested. HTTPS enforcement, encryption at rest, malware scanning, signed private URLs, rate limiting, retention, and backup controls require separate implementation and evidence if they are claimed.
- Naive Bayes and any future Logistic Regression model must be evaluated separately using labeled data and metrics such as accuracy, precision, recall, F1-score, and a confusion matrix. They should not be used as evidence that the whole system satisfies an ISO/IEC 25010 characteristic.
- Results should identify the respondents, test environment, sample size, date, and unresolved defects so that the evaluation is reproducible.
