import { useState, useEffect } from 'react';
import { useStore } from './store';
import type { EquipmentCategory, Port, PortType } from './store';
import { Upload } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function AddEquipmentModal({ onClose }: Props) {
  const addEquipment = useStore((state) => state.addEquipment);
  
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState<EquipmentCategory>('video');
  const [inputs, setInputs] = useState(1);
  const [outputs, setOutputs] = useState(1);
  const [bidirectional, setBidirectional] = useState(0);
  const [imageUrl, setImageUrl] = useState('');

  // Default port counts when category changes to control or network
  useEffect(() => {
    if (category === 'control' || category === 'network') {
      setInputs(0);
      setOutputs(0);
      setBidirectional(4);
    } else {
      setInputs(1);
      setOutputs(1);
      setBidirectional(0);
    }
  }, [category]);

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
    
    const defaultType: PortType = 
      category === 'video' ? 'video' :
      category === 'audio' ? 'audio' :
      category === 'control' ? 'control' : 'network';

    const generatedInputs: Port[] = Array.from({ length: inputs }).map((_, i) => ({
      id: `in-${i + 1}`,
      label: `In ${i + 1}`,
      type: defaultType,
      direction: 'in'
    }));
    
    const generatedOutputs: Port[] = Array.from({ length: outputs }).map((_, i) => ({
      id: `out-${i + 1}`,
      label: `Out ${i + 1}`,
      type: defaultType,
      direction: 'out'
    }));

    const generatedBidi: Port[] = Array.from({ length: bidirectional }).map((_, i) => ({
      id: `both-port-${i + 1}`,
      label: `Port ${i + 1}`,
      type: defaultType,
      direction: 'both'
    }));

    addEquipment({ 
      name, 
      model, 
      category, 
      inputs: generatedInputs, 
      outputs: generatedOutputs,
      bidirectional: generatedBidi,
      imageUrl
    });
    onClose();
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
      <div className="glass-panel modal-panel" style={{ width: '400px', padding: '24px', borderRadius: '12px' }}>
        <h2 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Add New Equipment</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>Name</label>
            <input 
              required 
              className="glass-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. PTZ Camera"
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>Model</label>
            <input 
              required 
              className="glass-input" 
              value={model} 
              onChange={e => setModel(e.target.value)} 
              placeholder="e.g. TR315"
            />
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
                id="equipment-image-file"
              />
              <label 
                htmlFor="equipment-image-file" 
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

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>Input Count</label>
              <input 
                type="number" 
                min="0" max="32"
                className="glass-input" 
                value={inputs} 
                onChange={e => setInputs(Number(e.target.value))} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>Output Count</label>
              <input 
                type="number" 
                min="0" max="32"
                className="glass-input" 
                value={outputs} 
                onChange={e => setOutputs(Number(e.target.value))} 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>Bidirectional Count (Control/Network)</label>
            <input 
              type="number" 
              min="0" max="32"
              className="glass-input" 
              value={bidirectional} 
              onChange={e => setBidirectional(Number(e.target.value))} 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button type="button" className="glass-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="glass-button primary">Add Equipment</button>
          </div>
        </form>
      </div>
    </div>
  );
}
