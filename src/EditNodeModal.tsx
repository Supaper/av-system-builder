import { useState } from 'react';
import { useStore } from './store';
import type { Equipment, EquipmentCategory, Port, PortType } from './store';
import { Trash2, Plus, Upload } from 'lucide-react';

interface Props {
  nodeId: string;
  initialData: Equipment;
  onClose: () => void;
}

export function EditNodeModal({ nodeId, initialData, onClose }: Props) {
  const updateNodeData = useStore((state) => state.updateNodeData);
  
  const [name, setName] = useState(initialData.name);
  const [model, setModel] = useState(initialData.model);
  const [category, setCategory] = useState<EquipmentCategory>(initialData.category);
  const [inputs, setInputs] = useState<Port[]>([...initialData.inputs]);
  const [outputs, setOutputs] = useState<Port[]>([...initialData.outputs]);
  const [bidirectional, setBidirectional] = useState<Port[]>([...(initialData.bidirectional || [])]);
  const [imageUrl, setImageUrl] = useState(initialData.imageUrl || '');

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
    updateNodeData(nodeId, {
      ...initialData,
      name,
      model,
      category,
      inputs,
      outputs,
      bidirectional,
      imageUrl
    });
    onClose();
  };

  const handleAddPort = (type: 'in' | 'out' | 'both') => {
    const defaultType: PortType = 
      category === 'video' ? 'video' :
      category === 'audio' ? 'audio' :
      category === 'control' ? 'control' : 'network';

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
      <div className="glass-panel" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '12px' }}>
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
              <option value="audio">Audio</option>
              <option value="control">Control</option>
              <option value="network">Network</option>
            </select>
          </div>

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
