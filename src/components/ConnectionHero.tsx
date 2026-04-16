import { motion } from 'framer-motion';
import { CheckCircle2, Play, RefreshCcw, Square, Timer } from 'lucide-react';
import type { ConnectionProfile, RuntimeSnapshot } from '../types';
import { flagEmoji, formatDateTime, formatLatency, protocolLabel } from '../lib/utils';

interface ConnectionHeroProps {
  runtime: RuntimeSnapshot;
  activeProfile?: ConnectionProfile | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onQuickTest: () => void;
  connectDisabled: boolean;
  disconnectDisabled: boolean;
}

export function ConnectionHero({
  runtime, activeProfile, onConnect, onDisconnect, onQuickTest, connectDisabled, disconnectDisabled
}: ConnectionHeroProps): JSX.Element {
  const resolvedProfile = activeProfile ?? null;
  return (
    <motion.section className="hero-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
      <div className="hero-card__main">
        <div className="hero-card__badge">{resolvedProfile ? protocolLabel(resolvedProfile.protocol) : 'Idle'}</div>
        <h1>{resolvedProfile ? resolvedProfile.name : 'Готово к подключению'}</h1>
        <p>
          {resolvedProfile
            ? `${flagEmoji(resolvedProfile.countryCode)} ${resolvedProfile.countryName ?? 'Unknown'} · ${resolvedProfile.server}:${resolvedProfile.port}`
            : 'Выберите профиль или импортируйте подписку, чтобы начать.'}
        </p>
        <div className="hero-card__chips">
          <span className={`status-chip status-chip--${runtime.status}`}>{runtime.status}</span>
          <span className="status-chip status-chip--subtle"><Timer size={14} /> {formatLatency(resolvedProfile?.latencyMs)}</span>
          <span className="status-chip status-chip--subtle"><CheckCircle2 size={14} /> {formatDateTime(resolvedProfile?.lastSuccessfulTestAt)}</span>
        </div>
      </div>
      <div className="hero-card__actions">
        <button type="button" className="primary-button" disabled={connectDisabled} onClick={onConnect}>
          <Play size={16} />Connect
        </button>
        <button type="button" className="secondary-button" disabled={disconnectDisabled} onClick={onDisconnect}>
          <Square size={16} />Disconnect
        </button>
        <button type="button" className="secondary-button" onClick={onQuickTest}>
          <RefreshCcw size={16} />Quick test
        </button>
      </div>
    </motion.section>
  );
}
