// ───────────────────────────────────────────────────────────────────────────
// 릴리즈노트 모달 — 헤더의 버전 배지를 클릭하면 열린다.
// 별도 데이터 관리 없이 CHANGELOG.md를 빌드 시 ?raw로 임포트해 파싱하므로,
// CHANGELOG만 갱신하면 앱 안 릴리즈노트도 자동으로 최신화된다.
// ───────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { ScrollText, X } from 'lucide-react';
import changelogRaw from '../CHANGELOG.md?raw';

interface ReleaseSection {
  tag: string;      // Added / Changed / Fixed / Removed / 참고 ...
  items: string[];
}
interface Release {
  version: string;  // "v1.19"
  date: string;     // "2026-07-07"
  sections: ReleaseSection[];
}

function parseChangelog(raw: string): Release[] {
  const releases: Release[] = [];
  let release: Release | null = null;
  let section: ReleaseSection | null = null;

  for (const line of raw.split('\n')) {
    const ver = line.match(/^## \[(v[\d.]+)\]\s*—\s*(\S+)/);
    if (ver) {
      release = { version: ver[1], date: ver[2], sections: [] };
      releases.push(release);
      section = null;
      continue;
    }
    const sec = line.match(/^### (.+)/);
    if (sec && release) {
      section = { tag: sec[1].trim(), items: [] };
      release.sections.push(section);
      continue;
    }
    const item = line.match(/^- (.+)/);
    if (item && section) {
      section.items.push(item[1]);
      continue;
    }
    // 들여쓴 하위 불릿은 마지막 항목에 이어 붙인다
    const sub = line.match(/^ {2,}- (.+)/);
    if (sub && section && section.items.length > 0) {
      section.items[section.items.length - 1] += ` · ${sub[1]}`;
    }
  }
  return releases;
}

const TAG_COLORS: Record<string, string> = {
  Added: '#22c55e',
  Changed: '#3b82f6',
  Fixed: '#ef4444',
  Removed: '#94a3b8',
};

/** 마크다운 인라인 서식(굵게·코드)만 가볍게 렌더 */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{ fontSize: '0.92em', padding: '0 4px', borderRadius: 3, background: 'var(--subtle-bg)', border: '1px solid var(--panel-border)' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

interface Props {
  onClose: () => void;
}

export function ReleaseNotesModal({ onClose }: Props) {
  const releases = useMemo(() => parseChangelog(changelogRaw), []);

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="glass-panel modal-panel"
        style={{ width: 620, maxHeight: '80vh', padding: 24, display: 'flex', flexDirection: 'column', gap: 14, borderRadius: 12, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScrollText size={16} style={{ color: 'var(--accent-color)' }} />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, flex: 1 }}>릴리즈노트</h3>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>현재 버전 v{__APP_VERSION__.replace(/\.0$/, '')}</span>
          <button className="glass-button icon-btn" style={{ width: 26, height: 26, padding: 0 }} onClick={onClose}>
            <X size={13} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, paddingRight: 6 }}>
          {releases.map((rel, ri) => (
            <div key={rel.version}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{
                  fontSize: 12, fontWeight: 800, padding: '2px 9px', borderRadius: 10,
                  background: ri === 0 ? 'var(--accent-color)' : 'var(--subtle-bg)',
                  color: ri === 0 ? '#fff' : 'var(--text-primary)',
                  border: ri === 0 ? 'none' : '1px solid var(--panel-border)',
                }}>
                  {rel.version}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{rel.date}</span>
                {ri === 0 && <span style={{ fontSize: 9.5, color: 'var(--accent-color)', fontWeight: 700 }}>LATEST</span>}
              </div>

              {rel.sections.map((sec, si) => (
                <div key={si} style={{ marginBottom: 8 }}>
                  <span style={{
                    display: 'inline-block', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em',
                    padding: '1px 7px', borderRadius: 8, marginBottom: 5,
                    color: TAG_COLORS[sec.tag] ?? 'var(--text-secondary)',
                    background: `color-mix(in srgb, ${TAG_COLORS[sec.tag] ?? '#94a3b8'} 12%, transparent)`,
                  }}>
                    {sec.tag}
                  </span>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {sec.items.map((item, ii) => (
                      <li key={ii} style={{ fontSize: 11.5, lineHeight: 1.55, color: 'var(--text-primary)' }}>
                        {renderInline(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {ri < releases.length - 1 && <div style={{ height: 1, background: 'var(--panel-border)', marginTop: 14 }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
