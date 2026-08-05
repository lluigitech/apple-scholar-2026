const { google } = require('googleapis');

// ─── Auth setup ───────────────────────────────────────────────────────────────
// Sa .env mo ilagay:
//   GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
//   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
//   GOOGLE_SHARE_WITH=yourname@gmail.com  ← para ma-access ang sheet sa browser

const getAuth = () =>
  new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

// ─── Style helpers ────────────────────────────────────────────────────────────
const BRAND_RGB = { red: 0.498, green: 0.176, blue: 0.227 }; // #7f2d3a

const headerFormat = {
  backgroundColor: BRAND_RGB,
  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
  horizontalAlignment: 'CENTER',
  verticalAlignment: 'MIDDLE',
};

const evenRowFormat = {
  backgroundColor: { red: 0.988, green: 0.973, blue: 0.973 }, // #fcf8f8
};

const buildRequests = (sheetId, numCols, numRows) => [
  // Freeze header row
  {
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: 'gridProperties.frozenRowCount',
    },
  },
  // Style header row
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: numCols },
      cell: { userEnteredFormat: headerFormat },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
    },
  },
  // Style even data rows
  ...(numRows > 1
    ? [{
        addConditionalFormatRule: {
          rule: {
            ranges: [{ sheetId, startRowIndex: 1, endRowIndex: numRows, startColumnIndex: 0, endColumnIndex: numCols }],
            booleanRule: {
              condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=ISEVEN(ROW())' }] },
              format: { backgroundColor: evenRowFormat.backgroundColor },
            },
          },
          index: 0,
        },
      }]
    : []),
  // Auto-resize columns
  {
    autoResizeDimensions: {
      dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: numCols },
    },
  },
];

// ─── Sheet data builders ──────────────────────────────────────────────────────
const rowValues = (obj) =>
  Object.values(obj).map((v) => ({
    userEnteredValue: v === null || v === undefined
      ? { stringValue: '' }
      : typeof v === 'number'
        ? { numberValue: v }
        : { stringValue: String(v) },
  }));

const buildSheetData = (headers, rows) => ({
  headers,
  values: [
    headers.map((h) => ({ userEnteredValue: { stringValue: h } })),
    ...rows.map(rowValues),
  ],
});

const getSheets = (kind, data) => {
  if (kind === 'compliance') {
    return [
      {
        title: 'Duty Attendance',
        ...buildSheetData(
          ['Scholar', 'Course', 'Year', 'Date', 'Duty', 'Status', 'Hours'],
          data.duty_attendance.map(({ scholar, course, year_level, date, duty, status, hours }) =>
            ({ scholar, course, year_level, date, duty, status, hours })
          )
        ),
      },
      {
        title: 'Submissions',
        ...buildSheetData(
          ['Scholar', 'Type', 'Period', 'Submitted At', 'Status'],
          data.submissions.map(({ scholar, type, period, submitted_at, status }) =>
            ({ scholar, type, period, submitted_at: submitted_at ?? '—', status })
          )
        ),
      },
      {
        title: 'Requirements',
        ...buildSheetData(
          ['Scholar', 'Requirement', 'Semester', 'Submitted At', 'Status'],
          data.requirements.map(({ scholar, type, semester, submitted_at, status }) =>
            ({ scholar, type, semester, submitted_at: submitted_at ?? '—', status })
          )
        ),
      },
      {
        title: 'Activity Participation',
        ...buildSheetData(
          ['Scholar', 'Activity', 'Date', 'Attended', 'With Photos', 'Photo Count'],
          data.activities.map(({ scholar, activity, date, attended, with_photos, photos_count }) =>
            ({ scholar, activity, date,
               attended:    attended    ? 'Yes' : 'No',
               with_photos: with_photos ? 'Yes' : 'No',
               photos_count })
          )
        ),
      },
    ];
  }

  if (kind === 'donor') {
    return [{
      title: 'Donor Report',
      ...buildSheetData(
        ['Scholar', 'Course', 'Year', 'GPA', 'Reports Sub.', 'Reports Ver.', 'Req Sub.', 'Req Ver.', 'Duty Hours', 'Activities', 'w/ Photos'],
        data.map(({ scholar, course, year_level, gpa,
                    reports_submitted, reports_verified,
                    requirements_submitted, requirements_verified,
                    total_duty_hours, activities_attended, activities_with_photos }) =>
          ({ scholar, course, year_level, gpa,
             reports_submitted, reports_verified,
             requirements_submitted, requirements_verified,
             total_duty_hours, activities_attended, activities_with_photos })
        )
      ),
    }];
  }

  if (kind === 'audit') {
    return [{
      title: 'Audit Trail',
      ...buildSheetData(
        ['Timestamp', 'Performed By', 'Role', 'Action', 'Module', 'Details', 'IP Address'],
        data.map(({ timestamp, performed_by, role, action, module, details, ip_address }) =>
          ({ timestamp, performed_by, role, action, module, details, ip_address })
        )
      ),
    }];
  }

  return [];
};

// ─── Main function ────────────────────────────────────────────────────────────
const createSpreadsheet = async (title, kind, data) => {
  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive  = google.drive({ version: 'v3', auth });

  const sheetDefs = getSheets(kind, data);

  // 1. Create spreadsheet with all sheets
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: sheetDefs.map((s, i) => ({
        properties: { sheetId: i, title: s.title, index: i },
      })),
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId;
  const spreadsheetUrl = createRes.data.spreadsheetUrl;

  // 2. Write data to each sheet
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: sheetDefs.map((s, i) => ({
        range: `${s.title}!A1`,
        values: s.values.map((row) =>
          row.map((cell) =>
            cell.userEnteredValue.numberValue !== undefined
              ? cell.userEnteredValue.numberValue
              : cell.userEnteredValue.stringValue
          )
        ),
      })),
    },
  });

  // 3. Apply formatting (header color, freeze, auto-resize, alternating rows)
  const formatRequests = sheetDefs.flatMap((s, i) =>
    buildRequests(i, s.headers.length, s.values.length)
  );

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: formatRequests },
  });

  // 4. Share with admin email so it opens in browser
  if (process.env.GOOGLE_SHARE_WITH) {
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: 'writer',
        type: 'user',
        emailAddress: process.env.GOOGLE_SHARE_WITH,
      },
    });
  }

  return spreadsheetUrl;
};

module.exports = { createSpreadsheet };