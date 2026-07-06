import { useState, useMemo } from 'react';
import { useStore, getDefaultPortTypeForCategory, getAvailableOptionsForEquipment } from './store';
import type { Equipment, EquipmentCategory, EquipmentOption, Port, PortType } from './store';
import { Trash2, Plus, Upload, Pencil } from 'lucide-react';
import { EditOptionModal } from './EditOptionModal';

// 장비 라이브러리(카탈로그) 원본 편집 모달 — 팀 공용 장비 DB를 직접 수정한다.
// 노드 인스턴스를 수정하는 EditNodeModal과 달리 여기서의 변경은 Firestore로
// 실시간 동기화되어 모든 팀원에게 반영된다. 이미 캔버스에 배치된 노드는
// 배치 시점의 정보를 자기완결적으로 품고 있으므로 영향받지 않는다.
interface Props {
  equipment: Equipment;
  onClose: () => void;
}

export function EditEquipmentModal({ equipment, onClose }: Props) {
  const updateEquipment = useStore((state) => state.updateEquipment);
  const removeEquipment = useStore((state) => state.removeEquipment);
  const equipmentOptions = useStore((state) => state.equipmentOptions);
  const lineTypes = useStore((state) => state.lineTypes);

  // 포트 타입 선택지 = 라인 타입(케이블 타입) 목록. 하드코딩 금지 — 상단 필터와 항상 일치해야 함
  const portTypeOptions = lineTypes.map(lt => (
    <option key={lt.id} value={lt.id}>{lt.name}</option>
  ));

  // 옵션 편집 모달 상태: undefined = 닫힘, null = 신규 생성, EquipmentOption = 편집
  const [editingOption, setEditingOption] = useState<EquipmentOption | null | undefined>(undefined);

  const [name, setName] = useState(equipment.name);
  const [model, setModel] = useState(equipment.model);
  const [manufacturer, setManufacturer] = useState(equipment.manufacturer || '');
  const [description, setDescription] = useState(equipment.description || '');
  const [series, setSeries] = useState(equipment.series || '');
  const [category, setCategory] = useState<EquipmentCategory>(equipment.category);
  const [inputs, setInputs] = useState<Port[]>([...equipment.inputs]);
  const [outputs, setOutputs] = useState<Port[]>([...equipment.outputs]);
  const [bidirectional, setBidirectional] = useState<Port[]>([...(equipment.bidirectional || [])]);
  const [imageUrl, setImageUrl] = useState(equipment.imageUrl || '');

  // 현재 폼의 모델명/시리즈 기준으로 호환 옵션 조회 — 편집 중 값이 바뀌면 즉시 갱신됨
  const compatibleOptions = useMemo(
    () => getAvailableOptionsForEquipment({ model, series: series.trim() || undefined }, equipmentOptions),
    [model, series, equipmentOptions]
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImageUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateEquipment(equipment.id, {
      ...equipment,
      name,
      model,
      manufacturer: manufacturer.trim() || undefined,
      description: description.trim() || undefined,
      series: series.trim() || undefined,
      category,
      inputs,
      outputs,
      bidirectional,
      imageUrl: imageUrl || undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!window.confirm(`"${name} (${model})" 장비를 라이브러리에서 삭제할까요?\n팀 공용 DB에서 삭제되며 되돌릴 수 없습니다. (이미 배치된 노드는 유지됩니다)`)) return;
    removeEquipment(equipment.id);
    onClose();
  };

  const handleAddPort = (kind: 'in' | 'out' | 'both') => {
    const defaultType: PortType = getDefaultPortTypeForCategory(category);
    const list = kind === 'in' ? inputs : kind === 'out' ? outputs : bidirectional;
    const newPort: Port = {
      id: `${kind}-${Date.now()}`,
      label: `${kind === 'both' ? 'Port' : kind === 'in' ? 'In' : 'Out'} ${list.length + 1}`,
      type: defaultType,
      direction: kind,
    };
    if (kind === 'in') setInputs([...inputs, newPort]);
    else if (kind === 'out') setOutputs([...outputs, newPort]);
    else setBidirectional([...bidirectional, newPort]);
  };

  const portSetter = (kind: 'in' | 'out' | 'both') =>
    kind === 'in' ? setInputs : kind === 'out' ? setOutputs : setBidirectional;
  const portList = (kind: 'in' | 'out' | 'both') =>
    kind === 'in' ? inputs : kind === 'out' ? outputs : bidirectional;

  const handleRemovePort = (kind: 'in' | 'out' | 'both', index: number) => {
    portSetter(kind)(portList(kind).filter((_, i) => i !== index));
  };
  const handlePortChange = (kind: 'in' | 'out' | 'both', index: number, patch: Partial<Port>) => {
    portSetter(kind)(portList(kind).map((p, i) => i === index ? { ...p, ...patch } : p));
  };

  const renderPortSection = (title: string, kind: 'in' | 'out' | 'both', addLabel: string) => (
    <div style={{ backgroundColor: 'var(--subtle-bg)', padding: '12px', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>{title}</span>
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
              onChange={(e) => handlePortChange(kind, idx, { label: e.target.value })}
            />
            <select
              className="glass-input"
              style={{ flex: 1.5, padding: '4px', fontSize: '0.75rem', backgroundColor: 'var(--panel-bg)' }}
              value={port.type}
              onChange={(e) => handlePortChange(kind, idx, { type: e.target.value as PortType })}
            >
              {portTypeOptions}
            </select>
            <button type="button" className="glass-button" style={{ padding: '4px' }} onClick={() => handleRemovePort(kind, idx)}>
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
      zIndex: 100
    }}>
      <div className="glass-panel modal-panel" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '12px' }}>
        <h2 style={{ marginBottom: '4px', fontSize: '1.25rem' }}>장비 정보 편집</h2>
        <p style={{ marginBottom: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          팀 공용 장비 라이브러리를 수정합니다. 저장 시 모든 기기에 실시간 반영됩니다. (이미 배치된 노드는 영향받지 않음)
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>제품유형 (Name)</label>
              <input required className="glass-input" value={name} onChange={e => setName(e.target.value)} placeholder="예: 매트릭스 스위처" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>모델명 (Model)</label>
              <input required className="glass-input" value={model} onChange={e => setModel(e.target.value)} placeholder="예: XDM-12" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>제조사</label>
              <input className="glass-input" value={manufacturer} onChange={e => setManufacturer(e.target.value)} placeholder="예: RTCOM" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>카테고리</label>
              <select
                className="glass-input"
                value={category}
                onChange={e => setCategory(e.target.value as EquipmentCategory)}
                style={{ backgroundColor: 'var(--panel-bg)' }}
              >
                <option value="video">Video</option>
                <option value="display">Display</option>
                <option value="conferencing">Conferencing</option>
                <option value="audio">Audio</option>
                <option value="control">Control</option>
                <option value="network">Network</option>
                <option value="broadcast">Broadcast</option>
                <option value="etc">Etc</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>설명</label>
            <input className="glass-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="예: 4K/60P지원, 모듈형 12슬롯" />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>
              시리즈 태그 <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>— 모듈형 프레임 제품군 (옵션 카드 호환 판정용, 예: "XDM 시리즈")</span>
            </label>
            <input className="glass-input" value={series} onChange={e => setSeries(e.target.value)} placeholder="비워두면 일반 장비" />
          </div>

          {/* 호환 옵션 카드 — 독립 카탈로그에서 모델/시리즈 매칭으로 조회 */}
          <div style={{ backgroundColor: 'var(--subtle-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: compatibleOptions.length > 0 ? '8px' : 0 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                호환 옵션 카드 ({compatibleOptions.length})
              </span>
              <button
                type="button"
                className="glass-button"
                style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', gap: '4px', alignItems: 'center' }}
                onClick={() => setEditingOption(null)}
              >
                <Plus size={12} /> 새 옵션 추가
              </button>
            </div>
            {compatibleOptions.length === 0 ? (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
                이 장비(모델명 접두 또는 시리즈 태그)와 호환되는 옵션이 없습니다. 옵션은 노드 편집 화면에서 선택 시 포트를 추가하는 장착형 카드/액세서리입니다.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {compatibleOptions.map(opt => {
                  const portCount = opt.addPorts.inputs.length + opt.addPorts.outputs.length + opt.addPorts.bidirectional.length;
                  return (
                    <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', borderRadius: '4px', fontSize: '0.78rem' }}>
                      <span style={{ fontWeight: 600, flexShrink: 0 }}>{opt.name}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        포트 {portCount}개{portCount === 0 && ' ⚠'}{opt.description ? ` — ${opt.description}` : ''}
                      </span>
                      <button
                        type="button"
                        className="glass-button"
                        style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}
                        onClick={() => setEditingOption(opt)}
                      >
                        <Pencil size={11} /> 편집
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>장비 사진 (선택)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
                id="edit-equipment-db-image-file"
              />
              <label
                htmlFor="edit-equipment-db-image-file"
                className="glass-button"
                style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Upload size={14} /> 이미지 업로드
              </label>
              {imageUrl && (
                <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--panel-border)' }}>
                  <img src={imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    style={{
                      position: 'absolute', top: 0, right: 0,
                      background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none',
                      width: '16px', height: '16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', cursor: 'pointer', borderBottomLeftRadius: '4px'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {renderPortSection('입력 포트 (Input)', 'in', '입력 추가')}
            {renderPortSection('출력 포트 (Output)', 'out', '출력 추가')}
            {renderPortSection('양방향 포트 (Bidirectional)', 'both', '양방향 추가')}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              className="glass-button"
              style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}
              onClick={handleDelete}
            >
              <Trash2 size={13} /> 라이브러리에서 삭제
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="glass-button" onClick={onClose}>취소</button>
              <button type="submit" className="glass-button primary">저장</button>
            </div>
          </div>
        </form>
      </div>

      {editingOption !== undefined && (
        <EditOptionModal
          option={editingOption}
          defaultCompatible={
            series.trim() ? { series: series.trim() } : { model }
          }
          onClose={() => setEditingOption(undefined)}
        />
      )}
    </div>
  );
}
