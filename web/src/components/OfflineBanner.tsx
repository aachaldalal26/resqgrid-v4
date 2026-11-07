'use client';
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/** Weak-internet support: tells people they are seeing the last saved data. */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="sticky top-0 z-[1100] flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950">
      <WifiOff size={16} /> You are offline — showing the last saved risk data. Call 112 in an emergency.
    </div>
  );
}
