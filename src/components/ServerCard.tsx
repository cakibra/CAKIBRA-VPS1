import { motion } from 'framer-motion';
import { Heart, HeartOff, Pencil, PlugZap, Shield, SquareArrowOutUpRight, Trash2 } from 'lucide-react';
import type { ConnectionProfile, RuntimeSnapshot } from '../types';
import { cx, flagEmoji, formatDateTime, formatLatency, protocolLabel } from '../lib/utils';

interface ServerCardProps {
  profile: ConnectionProfile;
  runtime: RuntimeSnapshot;
  onConnect: (profile: ConnectionProfile) => void;
  onToggleFavorite: (profileId: string) => void;
  onEdit: (profileId: string) => void;
  onDelete: (profileId: string) => void;
  onExport: (profile: ConnectionProfile) => void;
}

export function ServerCard({ profile, runtime, onConnect, onToggleFavorite, onEdit, onDelete, onExport }: ServerCardProps): JSX.Element {
  const active = runtime.activeProfileId === profile.id;
  const disabled = runtime.status === 'connecting' || runtime.status === 'disconnecting';
  const stateClass = active ? 'is-active' : profile.statusView.state === 'online' ? 'is-online' : '';
  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className={cx('server-card', stateClass)}>
      <div className="server-card__header">
        <div>
          <div className="server-card__title"><span className="server-card__flag">{flagEmoji(profile.countryCode)}</span><span>{profile.name}</span></div>
          <div className="server-card__subtitle">{profile.server}:{profile.port} · {profile.countryName ?? 'Unknown'}</div>
        </div>
        <div className="server-card__status">
          <span className={`status-dot status-dot--${active ? 'connected' : profile.statusView.state}`} />
          <span>{active ? 'connected' : profile.statusView.state}</span>
        </div>
      </div>
      <div className="server-card__chips">
        <span className="soft-chip">{protocolLabel(profile.protocol)}</span>
        <span className="soft-chip">{formatLatency(profile.latencyMs)}</span>
        <span className="soft-chip">{profile.sourceLabel}</span>
        <span className="soft-chip">{formatDateTime(profile.lastCheckedAt)}</span>
      </div>
      <div className="server-card__footer">
        <button type="button" className="primary-button primary-button--small" disabled={disabled} onClick={() => onConnect(profile)}>
          <PlugZap size={15} />{active ? 'Active' : 'Connect'}
        </button>
        <div className="server-card__footer-actions">
          <button type="button" className="icon-button" onClick={() => onToggleFavorite(profile.id)}>{profile.favorite ? <Heart size={16} /> : <HeartOff size={16} />}</button>
          <button type="button" className="icon-button" onClick={() => onEdit(profile.id)}><Pencil size={16} /></button>
          <button type="button" className="icon-button" onClick={() => onExport(profile)}><SquareArrowOutUpRight size={16} /></button>
          <button type="button" className="icon-button" onClick={() => onDelete(profile.id)}><Trash2 size={16} /></button>
          <div className="server-card__shield"><Shield size={14} /> {profile.sourceType}</div>
        </div>
      </div>
    </motion.article>
  );
}
