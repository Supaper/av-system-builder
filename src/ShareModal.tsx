import { useEffect, useState } from 'react';
import { Link2, Copy, Check, ExternalLink, AlertTriangle, Cloud, Loader2 } from 'lucide-react';
import { saveSharedDiagram, buildShareUrl, type SharedDiagram } from './cloud';
import { isFirebaseConfigured } from './firebaseConfig';

interface Props {
  getDiagram: () => SharedDiagram;
  onClose: () => void;
}

export function ShareModal({ getDiagram, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>(
    isFirebaseConfigured ? 'saving' : 'idle'
  );
  const [shareUrl, setShareUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const runCreate = async () => {
    try {
      const id = await saveSharedDiagram(getDiagram());
      setShareUrl(buildShareUrl(id));
      setStatus('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '공유 링크 생성에 실패했습니다.');
      setStatus('error');
    }
  };

  const handleCreate = () => {
    setErrorMsg('');
    setStatus('saving');
    runCreate();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 권한이 없으면 사용자가 직접 선택 복사
    }
  };

  // 모달 열리면 설정되어 있는 경우 자동으로 링크 생성 시작 (status 초기값이 'saving')
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isFirebaseConfigured) runCreate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="glass-panel modal-panel"
        style={{ width: 420, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, borderRadius: 12 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cloud size={16} color="var(--accent-color)" />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>구성도 공유 링크</h3>
        </div>

        {!isFirebaseConfigured ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: '#f59e0b', marginBottom: 10 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontWeight: 600 }}>클라우드 공유가 아직 설정되지 않았습니다.</span>
            </div>
            <p style={{ margin: '0 0 8px' }}>
              공유 링크 기능을 쓰려면 무료 Firebase 프로젝트 연결이 필요합니다.
              <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4 }}>src/firebaseConfig.ts</code>
              파일을 열어 프로젝트 값을 입력하세요.
            </p>
            <ol style={{ margin: '0 0 0 16px', padding: 0 }}>
              <li>console.firebase.google.com 에서 프로젝트 생성</li>
              <li>Firestore Database 생성</li>
              <li>웹 앱 추가 → firebaseConfig 값 복사</li>
              <li><code style={{ fontSize: 11 }}>src/firebaseConfig.ts</code> 에 붙여넣기</li>
            </ol>
          </div>
        ) : status === 'saving' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)', padding: '12px 0' }}>
            <Loader2 size={16} className="spin" />
            클라우드에 업로드 중...
          </div>
        ) : status === 'error' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: '#ef4444', fontSize: 12, lineHeight: 1.6 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{errorMsg}</span>
            </div>
            <button className="glass-button" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={handleCreate}>
              다시 시도
            </button>
          </div>
        ) : status === 'done' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              아래 링크를 다른 브라우저·기기·동료에게 공유하면 이 구성도를 그대로 열 수 있습니다.
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="glass-input"
                readOnly
                value={shareUrl}
                onFocus={e => e.currentTarget.select()}
                style={{ flex: 1, fontSize: 12 }}
              />
              <button className="glass-button primary" onClick={handleCopy} title="링크 복사" style={{ flexShrink: 0 }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <a
                className="glass-button"
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, justifyContent: 'center', fontSize: 12, textDecoration: 'none' }}
              >
                <ExternalLink size={13} /> 새 탭에서 열기
              </a>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.5 }}>
              ※ 이 링크는 생성 시점의 구성도를 저장한 스냅샷입니다. 수정 후 다시 공유하려면 새 링크를 만드세요.
            </p>
          </div>
        ) : (
          <button className="glass-button primary" onClick={handleCreate} style={{ justifyContent: 'center' }}>
            <Link2 size={14} /> 공유 링크 생성
          </button>
        )}

        <button className="glass-button" style={{ alignSelf: 'flex-end', fontSize: 11 }} onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
