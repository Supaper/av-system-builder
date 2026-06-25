import { Layers, PlusSquare, ExternalLink } from 'lucide-react';
import type { DiagramPreset } from './store';

interface Props {
  preset: DiagramPreset;
  onReplace: () => void;
  onAddToCanvas: () => void;
  onNewTab: () => void;
  onClose: () => void;
}

export function LoadPresetModal({ preset, onReplace, onAddToCanvas, onNewTab, onClose }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="glass-panel"
        style={{ width: 340, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, borderRadius: 12 }}
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 4px 0' }}>
            프리셋 불러오기
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
            "{preset.name}"을 어떻게 불러올까요?
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="glass-button"
            style={{ justifyContent: 'flex-start', gap: 12, padding: '10px 14px', textAlign: 'left' }}
            onClick={() => { onReplace(); onClose(); }}
          >
            <Layers size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>현재 캔버스 교체</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                현재 작업 내용을 지우고 프리셋으로 교체합니다
              </div>
            </div>
          </button>

          <button
            className="glass-button"
            style={{ justifyContent: 'flex-start', gap: 12, padding: '10px 14px', textAlign: 'left' }}
            onClick={() => { onAddToCanvas(); onClose(); }}
          >
            <PlusSquare size={16} style={{ flexShrink: 0, color: '#22c55e' }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>현재 캔버스에 추가</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                기존 내용을 유지하고 오른쪽 빈 영역에 추가합니다
              </div>
            </div>
          </button>

          <button
            className="glass-button"
            style={{ justifyContent: 'flex-start', gap: 12, padding: '10px 14px', textAlign: 'left' }}
            onClick={() => { onNewTab(); onClose(); }}
          >
            <ExternalLink size={16} style={{ flexShrink: 0, color: '#3b82f6' }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>새 탭에서 열기</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                별도 브라우저 탭에 프리셋을 독립적으로 로드합니다
              </div>
            </div>
          </button>
        </div>

        <button
          className="glass-button"
          style={{ alignSelf: 'flex-end', fontSize: 11 }}
          onClick={onClose}
        >
          취소
        </button>
      </div>
    </div>
  );
}
