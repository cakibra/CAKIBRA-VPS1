import { motion } from 'framer-motion';
import { Box, PlusCircle } from 'lucide-react';
import type { ConnectionProfile, RuntimeSnapshot, SubscriptionEntry } from '../types';
import { EmptyState } from './ui/EmptyState';
import { ServerCard } from './ServerCard';

interface ServerListProps {
  profiles: ConnectionProfile[];
  subscriptions: SubscriptionEntry[];
  runtime: RuntimeSnapshot;
  onConnect: (profile: ConnectionProfile) => void;
  onToggleFavorite: (profileId: string) => void;
  onEdit: (profileId: string) => void;
  onDelete: (profileId: string) => void;
  onExport: (profile: ConnectionProfile) => void;
  onCreateProfile: () => void;
}

export function ServerList({ profiles, subscriptions, runtime, onConnect, onToggleFavorite, onEdit, onDelete, onExport, onCreateProfile }: ServerListProps): JSX.Element {
  const groups = profiles.reduce<Record<string, ConnectionProfile[]>>((acc, profile) => {
    const key = profile.subscriptionId ?? 'local';
    acc[key] = acc[key] ?? [];
    acc[key].push(profile);
    return acc;
  }, {});
  if (profiles.length === 0) {
    return <EmptyState icon={<Box size={24} />} title="Пока нет профилей" description="Импортируйте конфиг, добавьте подписку или создайте профиль вручную." action={<button type="button" className="primary-button" onClick={onCreateProfile}><PlusCircle size={16} />Создать профиль</button>} />;
  }
  return (
    <div className="server-groups">
      {Object.entries(groups).map(([key, group]) => {
        const title = key === 'local' ? 'Локальные конфиги' : subscriptions.find((sub) => sub.id === key)?.name ?? key;
        return (
          <section key={key} className="server-group">
            <div className="section-header"><div><h3>{title}</h3><p>{group.length} профилей</p></div></div>
            <motion.div layout className="server-grid">
              {group.map((profile) => (
                <ServerCard key={profile.id} profile={profile} runtime={runtime} onConnect={onConnect} onToggleFavorite={onToggleFavorite} onEdit={onEdit} onDelete={onDelete} onExport={onExport} />
              ))}
            </motion.div>
          </section>
        );
      })}
    </div>
  );
}
