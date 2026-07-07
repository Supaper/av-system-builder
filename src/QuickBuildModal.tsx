// ───────────────────────────────────────────────────────────────────────────
// 빠른제작 위저드 — 3단계 (템플릿 선택 → 장비 대입 → 확인/생성)
// 템플릿의 슬롯에 실제 장비를 대입하면 buildFromTemplate이 노드/엣지를 생성한다.
// ───────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { Zap, ChevronLeft, ChevronRight, AlertTriangle, Layers, PlusSquare, Minus, Plus, Pencil, Trash2 } from 'lucide-react';
import { useStore, getCandidatesForSlot, CATEGORY_LABELS } from './store';
import type { QuickBuildTemplate } from './store';
import { buildFromTemplate, pickBestCandidate } from './utils/quickBuild';
import type { QuickBuildResult, SlotAssignment } from './utils/quickBuild';
import { TemplateEditorModal } from './TemplateEditorModal';

interface Props {
  onClose: () => void;
  /** mode: 'add' = 현재 캔버스 오른쪽에 추가, 'replace' = 캔버스 교체 */
  onCreate: (result: QuickBuildResult, mode: 'add' | 'replace') => void;
}

export function QuickBuildModal({ onClose, onCreate }: Props) {
  const equipmentDB = useStore(s => s.equipmentDB);
  const lineTypes = useStore(s => s.lineTypes);
  // 템플릿은 전부 사용자 정의 (기본 제공 개념 없음 — Firestore quickTemplates 동기화)
  const templates = useStore(s => s.quickTemplates);

  const removeQuickTemplate = useStore(s => s.removeQuickTemplate);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [template, setTemplate] = useState<QuickBuildTemplate | null>(null);
  const [assignments, setAssignments] = useState<Record<string, SlotAssignment>>({});
  // 편집기 상태 — undefined = 닫힘, null = 새 템플릿, 객체 = 편집(빌트인이면 사본)
  const [editorTarget, setEditorTarget] = useState<QuickBuildTemplate | null | undefined>(undefined);

  const selectTemplate = (tpl: QuickBuildTemplate) => {
    const init: Record<string, SlotAssignment> = {};
    for (const slot of tpl.slots) {
      const candidates = getCandidatesForSlot(slot, equipmentDB);
      const preferred = slot.defaultEquipmentId && candidates.some(c => c.id === slot.defaultEquipmentId)
        ? slot.defaultEquipmentId
        : pickBestCandidate(slot, tpl, candidates)?.id ?? null;
      init[slot.slotId] = { equipmentId: preferred, quantity: slot.quantity };
    }
    setTemplate(tpl);
    setAssignments(init);
    setStep(2);
  };

  // Step 2/3에서 항상 드라이런 — 경고(포트 부족 등)를 실시간 표시
  const dryRun = useMemo(() => {
    if (!template) return null;
    return buildFromTemplate(template, assignments, equipmentDB, lineTypes);
  }, [template, assignments, equipmentDB, lineTypes]);

  const setAssign = (slotId: string, patch: Partial<SlotAssignment>) => {
    setAssignments(prev => ({ ...prev, [slotId]: { ...prev[slotId], ...patch } }));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="glass-panel modal-panel"
        style={{ width: 560, maxHeight: '82vh', padding: 24, display: 'flex', flexDirection: 'column', gap: 14, borderRadius: 12, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={16} style={{ color: 'var(--accent-color)' }} />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, flex: 1 }}>
            빠른제작 {template ? `— ${template.name}` : ''}
          </h3>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Step {step} / 3</span>
        </div>

        {/* ── Step 1: 템플릿 선택 ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
            {templates.map(tpl => (
              <div key={tpl.id} style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
                <button
                  className="glass-button"
                  style={{ flex: 1, justifyContent: 'flex-start', gap: 12, padding: '12px 14px', textAlign: 'left', minWidth: 0 }}
                  onClick={() => selectTemplate(tpl)}
                >
                  <Zap size={16} style={{ flexShrink: 0, color: 'var(--accent-color)' }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{tpl.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {tpl.description || `슬롯 ${tpl.slots.length}개 · 연결 ${tpl.connections.length}개`}
                    </div>
                  </div>
                </button>
                <button className="glass-button icon-btn" style={{ width: 32, flexShrink: 0 }} title="템플릿 편집"
                  onClick={() => setEditorTarget(tpl)}>
                  <Pencil size={13} />
                </button>
                <button className="glass-button icon-btn" style={{ width: 32, flexShrink: 0 }} title="템플릿 삭제"
                  onClick={() => { if (confirm(`템플릿 "${tpl.name}"을 삭제할까요?`)) removeQuickTemplate(tpl.id); }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {templates.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '10px 6px', textAlign: 'center' }}>
                아직 템플릿이 없습니다.<br />
                자주 쓰는 시스템 구성(회의실, 강당 등)을 템플릿으로 만들어두면<br />
                장비만 대입해서 구성도를 바로 생성할 수 있습니다.
              </div>
            )}

            <button
              className="glass-button"
              style={{ justifyContent: 'center', gap: 8, padding: '10px 14px', borderStyle: 'dashed' }}
              onClick={() => setEditorTarget(null)}
            >
              <Plus size={14} /> 새 템플릿 만들기
            </button>
          </div>
        )}

        {/* ── Step 2: 장비 대입 ── */}
        {step === 2 && template && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 4 }}>
            {template.slots.map(slot => {
              const candidates = getCandidatesForSlot(slot, equipmentDB);
              const assign = assignments[slot.slotId];
              return (
                <div key={slot.slotId} style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 10px', background: 'var(--subtle-bg)', border: '1px solid var(--panel-border)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{slot.label}</span>
                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                      {slot.targetName || CATEGORY_LABELS[slot.category]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {candidates.length === 0 ? (
                      <span style={{ fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <AlertTriangle size={12} /> 후보 장비 없음 — 장비 DB에서 먼저 등록하세요
                      </span>
                    ) : (
                      <select
                        className="glass-input"
                        style={{ flex: 1, fontSize: 11, minWidth: 0 }}
                        value={assign?.equipmentId ?? ''}
                        onChange={e => setAssign(slot.slotId, { equipmentId: e.target.value || null })}
                      >
                        <option value="">(빈 슬롯 — 건너뛰기)</option>
                        {candidates.map(eq => (
                          <option key={eq.id} value={eq.id}>
                            {eq.model}{eq.manufacturer ? ` — ${eq.manufacturer}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <button className="glass-button icon-btn" style={{ width: 22, height: 22, padding: 0 }}
                        onClick={() => setAssign(slot.slotId, { quantity: Math.max(0, (assign?.quantity ?? 0) - 1) })}>
                        <Minus size={11} />
                      </button>
                      <span style={{ fontSize: 12, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{assign?.quantity ?? 0}</span>
                      <button className="glass-button icon-btn" style={{ width: 22, height: 22, padding: 0 }}
                        onClick={() => setAssign(slot.slotId, { quantity: (assign?.quantity ?? 0) + 1 })}>
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {dryRun && dryRun.warnings.length > 0 && (
              <div style={{ fontSize: 10.5, color: '#f59e0b', display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8 }}>
                {dryRun.warnings.map((w, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                    <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} /> {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: 확인 및 생성 ── */}
        {step === 3 && template && dryRun && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
            <div style={{ display: 'flex', gap: 16, padding: '12px 14px', background: 'var(--subtle-bg)', border: '1px solid var(--panel-border)', borderRadius: 8, fontSize: 12 }}>
              <span>노드 <strong>{dryRun.nodes.length}</strong>개</span>
              <span>연결 <strong>{dryRun.connectedCount}</strong>개</span>
              {dryRun.skippedCount > 0 && <span style={{ color: '#f59e0b' }}>미연결 {dryRun.skippedCount}건</span>}
            </div>

            {dryRun.warnings.length > 0 && (
              <div style={{ fontSize: 10.5, color: '#f59e0b', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {dryRun.warnings.map((w, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                    <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} /> {w}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="glass-button"
                disabled={dryRun.nodes.length === 0}
                style={{ justifyContent: 'flex-start', gap: 12, padding: '10px 14px', textAlign: 'left' }}
                onClick={() => { onCreate(dryRun, 'add'); onClose(); }}
              >
                <PlusSquare size={16} style={{ flexShrink: 0, color: '#22c55e' }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>현재 캔버스에 추가</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>기존 내용을 유지하고 오른쪽 빈 영역에 배치합니다</div>
                </div>
              </button>
              <button
                className="glass-button"
                disabled={dryRun.nodes.length === 0}
                style={{ justifyContent: 'flex-start', gap: 12, padding: '10px 14px', textAlign: 'left' }}
                onClick={() => { onCreate(dryRun, 'replace'); onClose(); }}
              >
                <Layers size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>새 캔버스로</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>현재 작업 내용을 지우고 이 구성으로 교체합니다 (Ctrl+Z 복구 가능)</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── 하단 내비게이션 ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--panel-border)', paddingTop: 12 }}>
          <button className="glass-button" onClick={onClose} style={{ fontSize: 11 }}>취소</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && (
              <button className="glass-button" style={{ fontSize: 11 }} onClick={() => setStep(step === 3 ? 2 : 1)}>
                <ChevronLeft size={12} /> 이전
              </button>
            )}
            {step === 2 && (
              <button className="glass-button primary" style={{ fontSize: 11 }} onClick={() => setStep(3)}>
                다음 <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 템플릿 편집기 오버레이 — 저장하면 그 템플릿으로 바로 Step 2 진입 */}
      {editorTarget !== undefined && (
        <TemplateEditorModal
          template={editorTarget}
          onClose={() => setEditorTarget(undefined)}
          onSaved={(saved) => selectTemplate(saved)}
        />
      )}
    </div>
  );
}
