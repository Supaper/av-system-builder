import { useState } from 'react';
import { useStore } from './store';
import type { EquipmentOption, Port, PortType } from './store';
import { Trash2, Plus } from 'lucide-react';

// 옵션 카드(EquipmentOption) 카탈로그 편집 모달.
// 옵션은 특정 장비에 종속되지 않는 독립 카탈로그이며, compatibleModels(모델명
// 접두 일치) / compatibleSeries(Equipment.series와 일치)로 여러 장비에 다대다
// 호환된다. 변경은 Firestore equipmentOptions 컬렉션에 실시간 동기화된다.
interface Props {
  /** 편집 대상. null이면 신규 생성 모드 */
  option: EquipmentOption | null;
  /** 신규 생성 시 미리 채울 호환 조건 (호출한 장비의 series 또는 model) */
  defaultCompatible?: { series?: string; model?: string };
  onClose: () => void;
}

export function EditOptionModal({ option, defaultCompatible, onClose }: Props) {
  const addEquipmentOption = useStore((s) => s.addEquipmentOption);
  const updateEquipmentOption = useStore((s) => s.updateEquipmentOption);
  const removeEquipmentOption = useStore((s) => s.removeEquipmentOption);
  const lineTypes = useStore((s) => s.lineTypes);

  // 포트 타입 선택지 = 라인 타입(케이블 타입) 목록. 하드코딩 금지 — 상단 필터와 항상 일치해야 함
  const portTypeOptions = lineTypes.map(lt => (
    <option key={lt.id} value={lt.id}>{lt.name}</option>
  ));

  const [name, setName] = useState(option?.name || '');
  const [model, setModel] = useState(option?.model || '');
  const [manufacturer, setManufacturer] = useState(option?.manufacturer || '');
  const [description, setDescription] = useState(option?.description || '');
  const [compatibleModels, setCompatibleModels] = useState(
    (option?.compatibleModels || (defaultCompatible?.model ? [defaultCompatible.model] : [])).join(', ')
  );
  const [compatibleSeries, setCompatibleSeries] = useState(
    (option?.compatibleSeries || (defaultCompatible?.series ? [defaultCompatible.series] : [])).join(', ')
  );
  const [inputs, setInputs] = useState<Port[]>([...(option?.addPorts.inputs || [])]);
  const [outputs, setOutputs] = useState<Port[]>([...(option?.addPorts.outputs || [])]);
  const [bidirectional, setBidirectional] = useState<Port[]>([...(option?.addPorts.bidirectional || [])]);

  const parseList = (s: string) => s.split(',').map(v => v.trim()).filter(Boolean);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const models = parseList(compatibleModels);
    const series = parseList(compatibleSeries);
    const payload: Omit<EquipmentOption, 'id'> = {
      name,
      model: model.trim() || undefined,
      manufacturer: manufacturer.trim() || undefined,
      description: description.trim() || undefined,
      compatibleModels: models.length ? models : undefined,
      compatibleSeries: series.length ? series : undefined,
      addPorts: { inputs, outputs, bidirectional },
    };
    if (option) updateEquipmentOption(option.id, payload);
    else addEquipmentOption(payload);
    onClose();
  };

  const handleDelete = () => {
    if (!option) return;
    if (!window.confirm(`옵션 "${name}"을(를) 카탈로그에서 삭제할까요?\n이 옵션과 호환되는 모든 장비에서 선택지가 사라집니다.`)) return;
    removeEquipmentOption(option.id);
    onClose();
  };

  const portList = (kind: 'in' | 'out' | 'both') =>
    kind === 'in' ? inputs : kind === 'out' ? outputs : bidirectional;
  const portSetter = (kind: 'in' | 'out' | 'both') =>
    kind === 'in' ? setInputs : kind === 'out' ? setOutputs : setBidirectional;

  const handleAddPort = (kind: 'in' | 'out' | 'both') => {
    const list = portList(kind);
    const newPort: Port = {
      id: `opt-${kind}-${Date.now()}`,
      label: `${kind === 'both' ? 'Port' : kind === 'in' ? 'In' : 'Out'} ${list.length + 1}`,
      type: 'video',
      direction: kind,
    };
    portSetter(kind)([...list, newPort]);
  };

  const renderPortSection = (title: string, kind: 'in' | 'out' | 'both', addLabel: string) => (
    <div style={{ backgroundColor: 'var(--subtle-bg)', padding: '12px', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{title}</span>
        <button type="button" className="glass-button" style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', gap: '4px', alignItems: 'center' }} onClick={() => handleAddPort(kind)}>
          <Plus size={12} /> {addLabel}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {portList(kind).map((port, idx) => (
          <div key={port.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              className="glass-input"
              style={{ flex: 2, padding: '4px 8px', fontSize: '0.75rem' }}
              value={port.label}
              onChange={(e) => portSetter(kind)(portList(kind).map((p, i) => i === idx ? { ...p, label: e.target.value } : p))}
            />
            <select
              className="glass-input"
              style={{ flex: 1.5, padding: '4px', fontSize: '0.75rem', backgroundColor: 'var(--panel-bg)' }}
              value={port.type}
              onChange={(e) => portSetter(kind)(portList(kind).map((p, i) => i === idx ? { ...p, type: e.target.value as PortType } : p))}
            >
              {portTypeOptions}
            </select>
            <button type="button" className="glass-button" style={{ padding: '4px' }} onClick={() => portSetter(kind)(portList(kind).filter((_, i) => i !== idx))}>
              <Trash2 size={12} color="#ef4444" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 120
    }}>
      <div className="glass-panel modal-panel" style={{ width: '560px', maxHeight: '88vh', overflowY: 'auto', padding: '24px', borderRadius: '12px' }}>
        <h2 style={{ marginBottom: '4px', fontSize: '1.1rem' }}>{option ? '옵션 카드 편집' : '새 옵션 카드 추가'}</h2>
        <p style={{ marginBottom: '16px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          옵션은 독립 카탈로그입니다 — 호환 조건에 맞는 모든 장비의 노드 편집 화면에 선택지로 나타나며, 선택 시 아래 포트가 노드에 추가됩니다.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem' }}>옵션명</label>
              <input required className="glass-input" value={name} onChange={e => setName(e.target.value)} placeholder="예: XDM-HI100" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem' }}>모델명 (선택)</label>
              <input className="glass-input" value={model} onChange={e => setModel(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem' }}>제조사 (선택)</label>
              <input className="glass-input" value={manufacturer} onChange={e => setManufacturer(e.target.value)} placeholder="예: RTCOM" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem' }}>설명 (선택)</label>
              <input className="glass-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="예: HDMI 입력 카드" />
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--subtle-bg)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>호환 대상 (쉼표로 구분, 둘 중 하나만 채워도 됨)</span>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                호환 모델 — 장비 모델명이 이 값으로 시작하면 호환 (접두 일치)
              </label>
              <input className="glass-input" value={compatibleModels} onChange={e => setCompatibleModels(e.target.value)} placeholder="예: BLU-101, XDM-12" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                호환 시리즈 — 장비의 시리즈 태그와 정확히 일치하면 호환 (프레임 제품군 전체 대상)
              </label>
              <input className="glass-input" value={compatibleSeries} onChange={e => setCompatibleSeries(e.target.value)} placeholder="예: XDM 시리즈" />
            </div>
          </div>

          <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>이 옵션이 장비에 추가하는 포트</span>
          {renderPortSection('입력 포트', 'in', '입력 추가')}
          {renderPortSection('출력 포트', 'out', '출력 추가')}
          {renderPortSection('양방향 포트', 'both', '양방향 추가')}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
            {option ? (
              <button
                type="button"
                className="glass-button"
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}
                onClick={handleDelete}
              >
                <Trash2 size={13} /> 옵션 삭제
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="glass-button" onClick={onClose}>취소</button>
              <button type="submit" className="glass-button primary">저장</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
