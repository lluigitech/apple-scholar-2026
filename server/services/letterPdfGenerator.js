const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const db = require('../config/db');
const cloudinary = require('../config/cloudinary');

const promiseDb = db.promise();

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'letter-template.docx');
const OUTPUT_DIR = path.join(__dirname, '..', 'uploads', 'generated-letters');
const SOFFICE_PATH = process.env.SOFFICE_PATH || (process.platform === 'win32'
  ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
  : 'soffice');

const ensureOutputDir = () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
};

const execAsync = (cmd) => new Promise((resolve, reject) => {
  exec(cmd, (err, stdout, stderr) => {
    if (err) return reject({ err, stdout, stderr });
    resolve({ stdout, stderr });
  });
});

const fetchImageBuffer = async (filePath) => {
  if (!filePath) return null;
  try {
    // Remote URL (Cloudinary or external)
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      const res = await fetch(filePath);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }

    // Local server file path (e.g. /uploads/...) -> resolve to project root
    const rel = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const abs = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(abs)) return null;
    return fs.readFileSync(abs);
  } catch (e) {
    console.warn('Failed to read image', filePath, e && e.message ? e.message : e);
    return null;
  }
};

/**
 * Generate a PDF for a given submission ID by filling the docx template,
 * inserting up to two photos, converting to PDF via LibreOffice, and
 * saving the generated PDF under `server/uploads/generated-letters`.
 * Returns the public path (relative to `/uploads`) to the generated PDF.
 */
async function generateLetterPdf(submissionId) {
  if (!submissionId) throw new Error('submissionId required');

  // Load submission + user
  // Validate submissionId is an integer-like value to avoid accidental path injections
  if (!Number.isInteger(Number(submissionId))) {
    throw new Error('Invalid submissionId');
  }

  const [rows] = await promiseDb.query(
    `SELECT s.id, s.letter_content, s.submitted_at, s.report_card_path, s.cor_path, s.generated_pdf_path, s.scholar_id
     FROM submissions s
     WHERE s.id = ? LIMIT 1`,
    [submissionId]
  );

  if (!rows || rows.length === 0) throw new Error('Submission not found');
  const sub = rows[0];

  // Try to fetch user profile fields, but log the exact result and any failures.
  let userProfile = { full_name: '', year_level: '', course: '', school: '' };
  const [uRows] = await promiseDb.query('SELECT full_name, year_level, course, school FROM users WHERE scholar_id = ? LIMIT 1', [sub.scholar_id]);
  console.log('DEBUG userProfile query result', JSON.stringify(uRows, null, 2));
  if (uRows && uRows.length > 0) {
    userProfile = { ...userProfile, ...uRows[0] };
  } else {
    console.warn('DEBUG no matching user profile found for scholar_id', sub.scholar_id);
  }

  // merge user profile into sub-like object used below
  sub.full_name = userProfile.full_name || '';
  sub.year_level = userProfile.year_level || '';
  sub.course = userProfile.course || '';
  sub.school = userProfile.school || '';

  // Load media (up to two photos expected)
  const [mediaRows] = await promiseDb.query(
    `SELECT file_path, description FROM submission_media WHERE submission_id = ? ORDER BY id ASC LIMIT 2`,
    [submissionId]
  );

  // Prepare data for docxtemplater
  const data = {
    name: sub.full_name || '',
    age: '',
    year_level: sub.year_level || '',
    course: sub.course || '',
    school: sub.school || '',
    date: sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '',
    letter_body: sub.letter_content || '',
    scholar_name: sub.full_name || '',
    documentation1_caption: mediaRows?.[0]?.description || '',
    documentation2_caption: mediaRows?.[1]?.description || '',
    additional_attachments_caption: (sub.report_card_path || sub.cor_path) ? 'Report Card/COR attached' : '',
  };
  console.log('DEBUG docxtemplater data', JSON.stringify(data, null, 2));

  // Fetch photo buffers (if any) so image module can return Buffer synchronously
  const imageBuffers = {
    photo1: null,
    photo2: null,
  };
  for (let i = 0; i < 2; i++) {
    const mr = mediaRows?.[i];
    if (mr && mr.file_path) {
      const buf = await fetchImageBuffer(mr.file_path);
      imageBuffers[`photo${i + 1}`] = buf || null;
    }
  }

  // Transparent PNG fallback when an image is missing
  const TRANSPARENT_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    'base64'
  );

  data.photo1 = 'photo1';
  data.photo2 = 'photo2';

  // Verify template exists
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`Template not found at ${TEMPLATE_PATH}`);
  }

  // Read template
  const content = fs.readFileSync(TEMPLATE_PATH, 'binary');
  const zip = new PizZip(content);

  // Image module expects getImage to return a Buffer synchronously.
  console.log('DEBUG photo1', !!data.photo1, data.photo1 ? data.photo1.length : null);
  console.log('DEBUG photo2', !!data.photo2, data.photo2 ? data.photo2.length : null);

  const imageModule = new ImageModule({
    getImage: function(tagValue, tagName) {
      const buffer = imageBuffers[tagValue] || TRANSPARENT_PNG;
      console.log('DEBUG getImage', tagValue, buffer && buffer.length);
      return buffer;
    },
    getSize: function(img, tagValue) {
      console.log('DEBUG getSize', img && img.length, tagValue);
      return [450, 300];
    }
  });

  // Use v3 docxtemplater API: render with data directly.
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, modules: [imageModule] });

  try {
    doc.render(data);
  } catch (renderErr) {
    console.error('DOCX RENDER ERROR OBJECT:', renderErr);
    console.error('DOCX RENDER ERROR STACK:', renderErr.stack);
    if (renderErr.properties && renderErr.properties.errors) {
      console.error('DOCX RENDER ERROR DETAILS:', JSON.stringify(renderErr.properties.errors, null, 2));
    }
    throw renderErr;
  }

  const buf = doc.getZip().generate({ type: 'nodebuffer' });

  ensureOutputDir();

  const timestamp = Date.now();
  const baseName = `submission-${submissionId}-${timestamp}`;
  const outDocx = path.join(OUTPUT_DIR, `${baseName}.docx`);
  const outPdf = path.join(OUTPUT_DIR, `${baseName}.pdf`);

  fs.writeFileSync(outDocx, buf);

  // Convert to PDF using LibreOffice headless
  const sofficeCommand = process.platform === 'win32' ? `"${SOFFICE_PATH}"` : SOFFICE_PATH;
  const cmd = `${sofficeCommand} --headless --convert-to pdf --outdir "${OUTPUT_DIR}" "${outDocx}"`;
  try {
    await execAsync(cmd);
  } catch (convErr) {
    // include stdout/stderr when available
    throw new Error('LibreOffice conversion failed: ' + JSON.stringify(convErr));
  }

  if (!fs.existsSync(outPdf)) {
    // LibreOffice sometimes names differently; try to guess fallback
    const altPdf = path.join(OUTPUT_DIR, `${baseName}.pdf`);
    if (!fs.existsSync(altPdf)) throw new Error('PDF not found after conversion');
  }

  let publicPath;
  try {
    const uploadResult = await cloudinary.uploader.upload(outPdf, {
      resource_type: 'auto',
      folder: 'apple-scholar/generated-letters',
      public_id: baseName,
      overwrite: true,
    });

    publicPath = uploadResult.secure_url;
  } catch (cloudErr) {
    console.warn('Cloudinary upload failed, falling back to local static path:', cloudErr && cloudErr.message ? cloudErr.message : cloudErr);
    publicPath = path.posix.join('/uploads', 'generated-letters', `${baseName}.pdf`);
  }

  try {
    await promiseDb.query('UPDATE submissions SET generated_pdf_path = ? WHERE id = ?', [publicPath, submissionId]);
  } catch (dbErr) {
    console.warn('Failed to update submission.generated_pdf_path', dbErr && dbErr.message ? dbErr.message : dbErr);
  }

  return publicPath;
}

module.exports = {
  generateLetterPdf,
};
