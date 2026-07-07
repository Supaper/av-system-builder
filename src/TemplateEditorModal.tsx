// ───────────────────────────────────────────────────────────────────────────
// 빠른제작 템플릿 편집기 — 슬롯(장비 자리)과 연결 정의를 폼으로 작성/수정한다.
// 저장하면 useStore.quickTemplates에 반영 → librarySync가 Firestore
// quickTemplates 컬렉션으로 실시간 push.
// ───────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { Plus, Trash2, AlertTriangle, ArrowRight, Save } from 'lucide-react';
import { useStore, CATEGORY_LABELS, getCandidatesForSlot } from './store';
import type { EquipmentCategory, QuickBuildTemplate, TemplateSlot, TemplateConnection } from './store';

interface Props {
  /** null = 새 템플릿 */
  template: QuickBuildTemplate | null;
  onClose: () => void;
  /** 저장 후 상위(위저드)가 목록을 갱신하거나 해당 템플릿을 선택할 수 있게 알림 */
  onSaved?: (saved: QuickBuildTemplate) => void;
}

let seq = 0;
const newId = (prefix: string) => `${prefix}_${Date.now()}_${seq++}`;

export function TemplateEditorModal({ template, onClose, onSaved }: Props) {
  const equipmentDB = useStore(s => s.equipmentDB);
  const lineTypes = useStore(s => s.lineTypes);
  const addQuickTemplate = useStore(s => s.addQuickTemplate);
  const updateQuickTemplate = useStore(s => s.updateQuickTemplate);

  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [slots, setSlots] = useState<TemplateSlot[]>(
    template ? template.slots.map(s => ({ ...s })) : []
  );
  const [connections, setConnections] = useState<TemplateConnection[]>(
    template ? template.connections.map(c => ({ ...c })) : []
  );

  // 중분류(name) 자동완성 후보 — 현재 장비 DB의 고유 name 목록
  const subgroupNames = useMemo(
    () => [...new Set(equipmentDB.map(eq => eq.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')),
    [equipmentDB]
  );

  const setSlot = (idx: number, patch: Partial<TemplateSlot>) =>
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));

  const removeSlot = (idx: number) => {
    const slotId = slots[idx].slotId;
    setSlots(prev => prev.filter((_, i) => i !== idx));
    setConnections(prev => prev.filter(c => c.fromSlot !== slotId && c.toSlot !== slotId));
  };

  const addSlot = () => setSlots(prev => [...prev, {
    slotId: newId('slot'),
    label: `슬롯 ${prev.length + 1}`,
    category: 'video',
    quantity: 1,
  }]);

  const setConn = (idx: number, patch: Partial<TemplateConnection>) =>
    setConnections(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));

  const addConn = () => setConnections(prev => [...prev, {
    id: newId('conn'),
    fromSlot: slots[0]?.slotId ?? '',
    toSlot: slots[1]?.slotId ?? slots[0]?.slotId ?? '',
    lineTypeId: lineTypes[0]?.id ?? 'video',
    distribution: 'one-to-one',
  }]);

  const validationError = useMemo(() => {
    if (!name.trim()) return '템플릿 이름을 입력하세요';
    if (slots.length === 0) return '슬롯을 1개 이상 추가하세요';
    if (slots.some(s => !s.label.trim())) return '이름 없는 슬롯이 있습니다';
    for (const c of connections) {
      if (!slots.some(s => s.slotId === c.fromSlot) || !slots.some(s => s.slotId === c.toSlot))
        return '슬롯이 지정되지 않은 연결이 있습니다';
      if (c.fromSlot === c.toSlot) return '같은 슬롯끼리는 연결할 수 없습니다';
    }
    return null;
  }, [name, slots, connections]);

  const handleSave = () => {
    if (validationError) return;
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      slots,
      connections,
    };
    if (template) {
      updateQuickTemplate(template.id, body);
      onSaved?.({ ...template, ...body });
    } else {
      addQuickTemplate(body);
      const saved = useStore.getState().quickTemplates.at(-1);
      if (saved) onSaved?.(saved);
    }
    onClose();
  };

  return (
    /* 위저드 오버레이 안에서 열리므로 stopPropagation으로 부모(위저드) 닫힘 방지 */
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, background: 'rgba(0,0,0,0.55)' }}
      onClick={e => { e.stopPropagation(); onClose(); }}>
      <div
        className="glass-panel modal-panel"
        style={{ width: 640, maxHeight: '86vh', padding: 24, display: 'flex', flexDirection: 'column', gap: 12, borderRadius: 12, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
          {template ? '템플릿 편집' : '새 템플릿 만들기'}
        </h3>

        <div style={{ display: 'flex', gap: 8 }}>
          <input className="glass-input" style={{ flex: 1, fontSize: 12 }} placeholder="템플릿 이름 (예: 중형 회의실)"
            value={name} onChange={e => setName(e.target.value)} />
          <input className="glass-input" style={{ flex: 2, fontSize: 12 }} placeholder="설명 (선택)"
            value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 4 }}>
          {/* ── 슬롯 편집 ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>장비 슬롯</span>
              <button className="glass-button" style={{ fontSize: 10.5, padding: '3px 8px' }} onClick={addSlot}>
                <Plus size={11} /> 슬롯 추가
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {slots.map((slot, idx) => {
                const matchCount = getCandidatesForSlot(slot, equipmentDB).length;
                return (
                  <div key={slot.slotId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--subtle-bg)', border: '1px solid var(--panel-border)', borderRadius: 8 }}>
                    <input className="glass-input" style={{ width: 120, fontSize: 11 }} placeholder="슬롯 이름"
                      value={slot.label} onChange={e => setSlot(idx, { label: e.target.value })} />
                    <input className="glass-input" style={{ flex: 1, fontSize: 11, minWidth: 0 }} placeholder="중분류 (예: 매트릭스 스위처)"
                      list="qb-subgroup-names"
                      value={slot.targetName ?? ''}
                      onChange={e => setSlot(idx, { targetName: e.target.value || undefined })} />
                    <select className="glass-input" style={{ width: 100, fontSize: 11 }}
                      value={slot.category}
                      onChange={e => setSlot(idx, { category: e.target.value as EquipmentCategory })}>
                      {(Object.entries(CATEGORY_LABELS) as [EquipmentCategory, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <input className="glass-input" type="number" min={1} max={99} style={{ width: 48, fontSize: 11 }}
                      value={slot.quantity}
                      onChange={e => setSlot(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
                    <span style={{ fontSize: 9.5, color: matchCount > 0 ? 'var(--text-secondary)' : '#f59e0b', width: 48, textAlign: 'right', flexShrink: 0 }}
                      title="현재 장비 DB에서 이 슬롯에 대입 가능한 장비 수">
                      {matchCount > 0 ? `${matchCount}종` : '0종 ⚠'}
                    </span>
                    <button className="glass-button icon-btn" style={{ width: 24, height: 24, padding: 0, flexShrink: 0 }} title="슬롯 삭제 (연결도 함께 제거)"
                      onClick={() => removeSlot(idx)}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
              {slots.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '8px 4px' }}>
                  슬롯은 "장비의 자리"입니다 — 예: [매트릭스 ×1], [디스플레이 ×2]. 빠른제작 실행 때 실제 장비를 대입합니다.
                </span>
              )}
            </div>
            <datalist id="qb-subgroup-names">
              {subgroupNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>

          {/* ── 연결 편집 ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>연결 정의</span>
              <button className="glass-button" style={{ fontSize: 10.5, padding: '3px 8px' }} onClick={addConn} disabled={slots.length < 2}>
                <Plus size={11} /> 연결 추가
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {connections.map((conn, idx) => (
                <div key={conn.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--subtle-bg)', border: '1px solid var(--panel-border)', borderRadius: 8 }}>
                  <select className="glass-input" style={{ flex: 1, fontSize: 11, minWidth: 0 }}
                    value={conn.fromSlot} onChange={e => setConn(idx, { fromSlot: e.target.value })}>
                    {slots.map(s => <option key={s.slotId} value={s.slotId}>{s.label}</option>)}
                  </select>
                  <ArrowRight size={12} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                  <select className="glass-input" style={{ flex: 1, fontSize: 11, minWidth: 0 }}
                    value={conn.toSlot} onChange={e => setConn(idx, { toSlot: e.target.value })}>
                    {slots.map(s => <option key={s.slotId} value={s.slotId}>{s.label}</option>)}
                  </select>
                  <select className="glass-input" style={{ width: 86, fontSize: 11 }}
                    value={conn.lineTypeId} onChange={e => setConn(idx, { lineTypeId: e.target.value })}>
                    {lineTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                  </select>
                  <select className="glass-input" style={{ width: 92, fontSize: 11 }}
                    title="one-to-one: i번째↔i번째 / fan-out: 1대→N대 분배 / fan-in: N대→1대 집선"
                    value={conn.distribution} onChange={e => setConn(idx, { distribution: e.target.value as TemplateConnection['distribution'] })}>
                    <option value="one-to-one">1:1 순차</option>
                    <option value="fan-out">분배 (1→N)</option>
                    <option value="fan-in">집선 (N→1)</option>
                  </select>
                  <input className="glass-input" style={{ width: 70, fontSize: 11 }} placeholder="라벨"
                    value={conn.edgeLabel ?? ''} onChange={e => setConn(idx, { edgeLabel: e.target.value || undefined })} />
                  <button className="glass-button icon-btn" style={{ width: 24, height: 24, padding: 0, flexShrink: 0 }} title="연결 삭제"
                    onClick={() => setConnections(prev => prev.filter((_, i) => i !== idx))}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              {connections.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '8px 4px' }}>
                  연결은 슬롯과 슬롯 사이의 배선 규칙입니다 — 생성 시 실제 장비의 포트에 자동 매핑됩니다.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── 하단 ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--panel-border)', paddingTop: 12 }}>
          <span style={{ fontSize: 10.5, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5, minHeight: 16 }}>
            {validationError && <><AlertTriangle size={11} /> {validationError}</>}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="glass-button" style={{ fontSize: 11 }} onClick={onClose}>취소</button>
            <button className="glass-button primary" style={{ fontSize: 11 }} disabled={!!validationError} onClick={handleSave}>
              <Save size={12} /> 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
