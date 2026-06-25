import { useState } from 'react';
import { useStore } from './store';

interface Props {
  edgeId: string;
  initialLabel: string;
  onClose: () => void;
}

export function EditEdgeModal({ edgeId, initialLabel, onClose }: Props) {
  const [label, setLabel] = useState(initialLabel);
  const { edges, setEdges } = useStore();

  const handleSave = () => {
    const updated = edges.map(e =>
      e.id === edgeId
        ? { ...e, data: { ...(e.data as any), label } }
        : e
    );
    setEdges(updated);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="glass-panel"
        style={{ width: 300, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, borderRadius: 12 }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>연결선 레이블 편집</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            레이블 (예: 8CH, 2ch, SDI×3)
          </label>
          <input
            className="glass-input"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="채널 수 또는 설명..."
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="glass-button" onClick={onClose}>취소</button>
          <button className="glass-button primary" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
