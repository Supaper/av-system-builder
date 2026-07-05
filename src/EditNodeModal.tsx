import { useState, useMemo } from 'react';
import { useStore, getAvailableOptionsForEquipment, getDefaultPortTypeForCategory } from './store';
import type { Equipment, EquipmentCategory, Port, PortType } from './store';
import { Trash2, Plus, Upload } from 'lucide-react';

interface Props {
  nodeId: string;
  initialData: Equipment;
  onClose: () => void;
}

export function EditNodeModal({ nodeId, initialData, onClose }: Props) {
  const updateNodeData = useStore((state) => state.updateNodeData);
  const equipmentOptions = useStore((state) => state.equipmentOptions);

  const [name, setName] = useState(initialData.name);
  const [model, setModel] = useState(initialData.model);
  const [category, setCategory] = useState<EquipmentCategory>(initialData.category);

  // 옵션이 추가한 포트를 제외한 "기본 포트"만 관리한다 — 옵션 포트는 optionQuantities로부터
  // 매번 다시 계산되므로(아래 selectedOptionPorts), 여기 섞이면 옵션 해제 시 제거가 안 된다.
  const existingOptionPortIds = new Set((initialData.optionPortIds as string[] | undefined) || []);
  const [inputs, setInputs] = useState<Port[]>(initialData.inputs.filter(p => !existingOptionPortIds.has(p.id)));
  const [outputs, setOutputs] = useState<Port[]>(initialData.outputs.filter(p => !existingOptionPortIds.has(p.id)));
  const [bidirectional, setBidirectional] = useState<Port[]>((initialData.bidirectional || []).filter(p => !existingOptionPortIds.has(p.id)));
  const [imageUrl, setImageUrl] = useState(initialData.imageUrl || '');
  const [isReused, setIsReused] = useState(initialData.isReused ?? false);

  // 옵션별 장착 수량 (같은 카드를 여러 장 꽂는 경우 지원).
  // 구버전 노드는 selectedOptionIds(체크 배열)만 있으므로 수량 1로 이전한다.
  const [optionQuantities, setOptionQuantities] = useState<Record<string, number>>(() => {
    const stored = initialData.selectedOptionQuantities as Record<string, number> | undefined;
    if (stored) return { ...stored };
    const legacyIds = (initialData.selectedOptionIds as string[] | undefined) || [];
    return Object.fromEntries(legacyIds.map(id => [id, 1]));
  });

  const availableOptions = useMemo(
    () => getAvailableOptionsForEquipment({ model, series: initialData.series }, equipmentOptions),
    [model, initialData.series, equipmentOptions]
  );

  const selectedOptionPorts = useMemo(() => {
    const result = { inputs: [] as Port[], outputs: [] as Port[], bidirectional: [] as Port[] };
    Object.entries(optionQuantities).forEach(([optId, qty]) => {
      if (qty <= 0) return;
      const opt = equipmentOptions.find(o => o.id === optId);
      if (!opt) return;
      for (let i = 0; i < qty; i++) {
        // 카드가 여러 장이면 포트 라벨에 #n을 붙여 몇 번째 카드인지 구분
        const namespace = (p: Port): Port => ({
          ...p,
          id: `opt-${opt.id}-${i}-${p.id}`,
          label: qty > 1 ? `${p.label} #${i + 1}` : p.label,
        });
        result.inputs.push(...opt.addPorts.inputs.map(namespace));
        result.outputs.push(...opt.addPorts.outputs.map(namespace));
        result.bidirectional.push(...opt.addPorts.bidirectional.map(namespace));
      }
    });
    return result;
  }, [optionQuantities, equipmentOptions]);

  const setOptionQty = (optId: string, qty: number) => {
    const clamped = Math.max(0, Math.min(99, qty));
    setOptionQuantities(prev => {
      if (clamped === 0) {
        const { [optId]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [optId]: clamped };
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalInputs = [...inputs, ...selectedOptionPorts.inputs];
    const finalOutputs = [...outputs, ...selectedOptionPorts.outputs];
    const finalBidirectional = [...bidirectional, ...selectedOptionPorts.bidirectional];
    updateNodeData(nodeId, {
      ...initialData,
      name,
      model,
      category,
      inputs: finalInputs,
      outputs: finalOutputs,
      bidirectional: finalBidirectional,
      imageUrl,
      isReused,
      selectedOptionQuantities: optionQuantities,
      selectedOptionIds: undefined, // 레거시 필드 제거 (수량 방식으로 대체)
      optionPortIds: [...selectedOptionPorts.inputs, ...selectedOptionPorts.outputs, ...selectedOptionPorts.bidirectional].map(p => p.id),
    });
    onClose();
  };

  const handleAddPort = (type: 'in' | 'out' | 'both') => {
    const defaultType: PortType = getDefaultPortTypeForCategory(category);

    const newPort: Port = {
      id: `${type}-${Date.now()}`,
      label: `${type === 'both' ? 'Bidi' : type === 'in' ? 'In' : 'Out'} ${
        type === 'in' ? inputs.length + 1 : type === 'out' ? outputs.length + 1 : bidirectional.length + 1
      }`,
      type: defaultType,
      direction: type === 'both' ? 'both' : type === 'in' ? 'in' : 'out'
    };

    if (type === 'in') setInputs([...inputs, newPort]);
    else if (type === 'out') setOutputs([...outputs, newPort]);
    else setBidirectional([...bidirectional, newPort]);
  };

  const handleRemovePort = (type: 'in' | 'out' | 'both', index: number) => {
    if (type === 'in') {
      setInputs(inputs.filter((_, i) => i !== index));
    } else if (type === 'out') {
      setOutputs(outputs.filter((_, i) => i !== index));
    } else {
      setBidirectional(bidirectional.filter((_, i) => i !== index));
    }
  };

  const handlePortLabelChange = (type: 'in' | 'out' | 'both', index: number, newLabel: string) => {
    if (type === 'in') {
      const newInputs = [...inputs];
      newInputs[index].label = newLabel;
      setInputs(newInputs);
    } else if (type === 'out') {
      const newOutputs = [...outputs];
      newOutputs[index].label = newLabel;
      setOutputs(newOutputs);
    } else {
      const newBidi = [...bidirectional];
      newBidi[index].label = newLabel;
      setBidirectional(newBidi);
    }
  };

  const handlePortTypeChange = (type: 'in' | 'out' | 'both', index: number, newType: PortType) => {
    if (type === 'in') {
      const newInputs = [...inputs];
      newInputs[index].type = newType;
      setInputs(newInputs);
    } else if (type === 'out') {
      const newOutputs = [...outputs];
      newOutputs[index].type = newType;
      setOutputs(newOutputs);
    } else {
      const newBidi = [...bidirectional];
      newBidi[index].type = newType;
      setBidirectional(newBidi);
    }
  };

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
        <h2 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Edit Node Properties</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>Name</label>
              <input required className="glass-input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>Model</label>
              <input required className="glass-input" value={model} onChange={e => setModel(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>Category</label>
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

          {availableOptions.length > 0 && (
            <div style={{ backgroundColor: 'var(--subtle-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>옵션 (수량만큼 포트 구성에 반영)</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {availableOptions.map(opt => {
                  const portCount = opt.addPorts.inputs.length + opt.addPorts.outputs.length + opt.addPorts.bidirectional.length;
                  const qty = optionQuantities[opt.id] || 0;
                  return (
                    <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                      {/* 수량 스테퍼 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                        <button
                          type="button"
                          className="glass-button icon-btn"
                          style={{ width: 20, height: 20, fontSize: 12, opacity: qty === 0 ? 0.35 : 1 }}
                          disabled={qty === 0}
                          onClick={() => setOptionQty(opt.id, qty - 1)}
                        >−</button>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          className="glass-input"
                          value={qty}
                          onChange={e => setOptionQty(opt.id, parseInt(e.target.value) || 0)}
                          style={{
                            width: 38, height: 20, padding: '0 2px', fontSize: 11, textAlign: 'center',
                            fontWeight: qty > 0 ? 700 : 400,
                            color: qty > 0 ? 'var(--accent-color)' : 'var(--text-secondary)',
                            borderColor: qty > 0 ? 'var(--accent-color)' : 'var(--panel-border)',
                          }}
                        />
                        <button
                          type="button"
                          className="glass-button icon-btn"
                          style={{ width: 20, height: 20, fontSize: 12 }}
                          onClick={() => setOptionQty(opt.id, qty + 1)}
                        >+</button>
                      </div>
                      <span style={{ fontWeight: 600, color: qty > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{opt.name}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        포트 {portCount}개/장{qty > 1 ? ` × ${qty} = ${portCount * qty}개` : ''}{opt.description ? ` — ${opt.description}` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <label style={{
            display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
            padding: '8px 12px', borderRadius: '8px',
            background: isReused ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.02)',
            border: isReused ? '1px solid rgba(234,179,8,0.4)' : '1px solid var(--panel-border)',
            transition: 'all 0.15s ease',
          }}>
            <input
              type="checkbox"
              checked={isReused}
              onChange={e => setIsReused(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: '#eab308', cursor: 'pointer' }}
            />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: isReused ? '#eab308' : 'var(--text-primary)' }}>
                재활용 장비
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                기존 설치 장비를 재활용하는 경우 표시
              </div>
            </div>
          </label>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>Equipment Photo (Optional)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageChange}
                style={{ display: 'none' }}
                id="edit-equipment-image-file"
              />
              <label 
                htmlFor="edit-equipment-image-file" 
                className="glass-button" 
                style={{ 
                  cursor: 'pointer', 
                  padding: '6px 12px', 
                  fontSize: '0.8125rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Upload size={14} /> Upload Image
              </label>
              {imageUrl && (
                <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--panel-border)' }}>
                  <img src={imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button 
                    type="button" 
                    onClick={() => setImageUrl('')}
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      right: 0, 
                      background: 'rgba(239, 68, 68, 0.9)', 
                      color: 'white', 
                      border: 'none', 
                      width: '16px', 
                      height: '16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '10px',
                      cursor: 'pointer',
                      borderBottomLeftRadius: '4px'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Inputs Column */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>Input Ports (Target)</span>
                <button type="button" className="glass-button" style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', gap: '4px', alignItems: 'center' }} onClick={() => handleAddPort('in')}>
                  <Plus size={12} /> Add Input
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {inputs.map((port, idx) => (
                  <div key={port.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      className="glass-input" 
                      style={{ flex: 2, padding: '4px 8px', fontSize: '0.75rem' }} 
                      value={port.label} 
                      onChange={(e) => handlePortLabelChange('in', idx, e.target.value)} 
                    />
                    <select
                      className="glass-input"
                      style={{ flex: 1.5, padding: '4px', fontSize: '0.75rem', backgroundColor: 'var(--panel-bg)' }}
                      value={port.type}
                      onChange={(e) => handlePortTypeChange('in', idx, e.target.value as PortType)}
                    >
                      <option value="video">Video</option>
                      <option value="audio">Audio</option>
                      <option value="control">Control</option>
                      <option value="network">Network</option>
                    </select>
                    <button type="button" className="glass-button" style={{ padding: '4px' }} onClick={() => handleRemovePort('in', idx)}>
                      <Trash2 size={12} color="#ef4444" />
                    </button>
                  </div>
                ))}
                {selectedOptionPorts.inputs.map(port => (
                  <div key={port.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', opacity: 0.6 }}>
                    <span style={{ flex: 2, fontSize: '0.75rem' }}>{port.label}</span>
                    <span style={{ flex: 1.5, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{port.type} (옵션)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Outputs Column */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>Output Ports (Source)</span>
                <button type="button" className="glass-button" style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', gap: '4px', alignItems: 'center' }} onClick={() => handleAddPort('out')}>
                  <Plus size={12} /> Add Output
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {outputs.map((port, idx) => (
                  <div key={port.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      className="glass-input" 
                      style={{ flex: 2, padding: '4px 8px', fontSize: '0.75rem' }} 
                      value={port.label} 
                      onChange={(e) => handlePortLabelChange('out', idx, e.target.value)} 
                    />
                    <select
                      className="glass-input"
                      style={{ flex: 1.5, padding: '4px', fontSize: '0.75rem', backgroundColor: 'var(--panel-bg)' }}
                      value={port.type}
                      onChange={(e) => handlePortTypeChange('out', idx, e.target.value as PortType)}
                    >
                      <option value="video">Video</option>
                      <option value="audio">Audio</option>
                      <option value="control">Control</option>
                      <option value="network">Network</option>
                    </select>
                    <button type="button" className="glass-button" style={{ padding: '4px' }} onClick={() => handleRemovePort('out', idx)}>
                      <Trash2 size={12} color="#ef4444" />
                    </button>
                  </div>
                ))}
                {selectedOptionPorts.outputs.map(port => (
                  <div key={port.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', opacity: 0.6 }}>
                    <span style={{ flex: 2, fontSize: '0.75rem' }}>{port.label}</span>
                    <span style={{ flex: 1.5, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{port.type} (옵션)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bidirectional Column */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>Bidirectional Ports (Control / Network)</span>
                <button type="button" className="glass-button" style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', gap: '4px', alignItems: 'center' }} onClick={() => handleAddPort('both')}>
                  <Plus size={12} /> Add Bidirectional
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bidirectional.map((port, idx) => (
                  <div key={port.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      className="glass-input" 
                      style={{ flex: 2, padding: '4px 8px', fontSize: '0.75rem' }} 
                      value={port.label} 
                      onChange={(e) => handlePortLabelChange('both', idx, e.target.value)} 
                    />
                    <select
                      className="glass-input"
                      style={{ flex: 1.5, padding: '4px', fontSize: '0.75rem', backgroundColor: 'var(--panel-bg)' }}
                      value={port.type}
                      onChange={(e) => handlePortTypeChange('both', idx, e.target.value as PortType)}
                    >
                      <option value="control">Control</option>
                      <option value="network">Network</option>
                      <option value="video">Video</option>
                      <option value="audio">Audio</option>
                    </select>
                    <button type="button" className="glass-button" style={{ padding: '4px' }} onClick={() => handleRemovePort('both', idx)}>
                      <Trash2 size={12} color="#ef4444" />
                    </button>
                  </div>
                ))}
                {selectedOptionPorts.bidirectional.map(port => (
                  <div key={port.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', opacity: 0.6 }}>
                    <span style={{ flex: 2, fontSize: '0.75rem' }}>{port.label}</span>
                    <span style={{ flex: 1.5, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{port.type} (옵션)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button type="button" className="glass-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="glass-button primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
