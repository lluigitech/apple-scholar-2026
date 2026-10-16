import { useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';

const OfflineIndicator = () => {
  const [offline, setOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg" style={{ background: '#241512', color: '#fff' }}>
      <CloudOff size={14} />
      Offline mode: drafts remain on this device. Uploads need a connection.
    </div>
  );
};

export default OfflineIndicator;
