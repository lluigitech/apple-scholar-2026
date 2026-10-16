import axios from 'axios';

const CHUNK_SIZE = 1024 * 1024;
const API_BASE = 'http://localhost:5000/api/submission';

const authHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));
const sessionKey = (file, fieldname) => `resumable:${localStorage.getItem('scholar_id')}:${fieldname}:${file.name}:${file.size}:${file.lastModified}`;

const retry = async (operation) => {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = !error.response || error.response.status >= 500 || error.code === 'ECONNABORTED';
      if (!retryable || attempt === 2) throw error;
      await wait(750 * (attempt + 1));
    }
  }
  throw lastError;
};

const createOrResumeSession = async (file, fieldname) => {
  const key = sessionKey(file, fieldname);
  const saved = JSON.parse(localStorage.getItem(key) || 'null');
  if (saved?.uploadId) {
    try {
      const status = await axios.get(`${API_BASE}/uploads/session/${saved.uploadId}`, { headers: authHeader(), timeout: 15_000 });
      return { ...saved, ...status.data, key };
    } catch {
      localStorage.removeItem(key);
    }
  }

  const response = await axios.post(`${API_BASE}/uploads/session`, {
    originalName: file.name,
    mimetype: file.type,
    size: file.size,
    fieldname,
    totalChunks: Math.ceil(file.size / CHUNK_SIZE),
  }, { headers: { ...authHeader(), 'Content-Type': 'application/json' }, timeout: 15_000 });
  const session = { uploadId: response.data.uploadId, chunkSize: response.data.chunkSize || CHUNK_SIZE };
  localStorage.setItem(key, JSON.stringify(session));
  return { ...session, received: [], key };
};

export const uploadResumableFile = async (file, fieldname, onProgress = () => {}) => {
  const session = await createOrResumeSession(file, fieldname);
  const chunkSize = session.chunkSize || CHUNK_SIZE;
  const received = new Set(session.received || []);
  const totalChunks = Math.ceil(file.size / chunkSize);

  for (let index = 0; index < totalChunks; index += 1) {
    if (received.has(index)) {
      onProgress((index + 1) / totalChunks);
      continue;
    }
    const chunk = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize));
    await retry(async () => {
      const formData = new FormData();
      formData.append('chunk', chunk, file.name);
      await axios.put(`${API_BASE}/uploads/session/${session.uploadId}/chunk/${index}`, formData, {
        headers: authHeader(),
        timeout: 60_000,
      });
    });
    onProgress((index + 1) / totalChunks);
  }

  await retry(() => axios.post(`${API_BASE}/uploads/session/${session.uploadId}/complete`, {}, {
    headers: authHeader(),
    timeout: 120_000,
  }));
  localStorage.removeItem(session.key);
  return session.uploadId;
};

export const cancelResumableFile = async (file, fieldname, uploadId) => {
  const id = uploadId || JSON.parse(localStorage.getItem(sessionKey(file, fieldname)) || 'null')?.uploadId;
  if (!id) return;
  await axios.delete(`${API_BASE}/uploads/session/${id}`, { headers: authHeader() }).catch(() => {});
  localStorage.removeItem(sessionKey(file, fieldname));
};
