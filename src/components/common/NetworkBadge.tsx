import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { Wifi, WifiOff } from 'lucide-react';

export default function NetworkBadge() {
  const online = useNetworkStatus();
  return (
    <span className={`badge ${online ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.68rem' }}>
      {online ? <Wifi size={10} /> : <WifiOff size={10} />}
      {online ? 'Online' : 'Offline'}
    </span>
  );
}
