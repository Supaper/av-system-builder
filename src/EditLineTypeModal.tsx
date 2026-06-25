import { useState } from 'react';
import { useStore } from './store';
import type { LineType } from './store';
import { Trash2 } from 'lucide-react';

interface Props {
  lineType: LineType;
  onClose: () => void;
}

export function EditLineTypeModal({ lineType, onClose }: Props) {
  const updateLineType = useStore((state) => state.updateLineType);
  const removeLineType = useStore((state) => state.removeLineType);
  
  const [name, setName] = useState(lineType.name);
  const [color, setColor] = useState(lineType.color);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateLineType(lineType.id, { name, color });
    onClose();
  };

  const handleDelete = () => {
    // Only delete if it's not the last one, or just allow it
    if (confirm(`Are you sure you want to delete the line type "${lineType.name}"?`)) {
      removeLineType(lineType.id);
      onClose();
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
      <div className="glass-panel" style={{ width: '300px', padding: '24px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Edit Line Type</h2>
          <button type="button" className="glass-button" style={{ padding: '6px' }} onClick={handleDelete}>
            <Trash2 size={16} color="#ef4444" />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>Name</label>
            <input 
              required 
              className="glass-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>Color</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                required 
                type="color"
                className="glass-input" 
                value={color} 
                onChange={e => setColor(e.target.value)} 
                style={{ height: '40px', padding: '2px', width: '60px' }}
              />
              <span style={{ fontSize: '0.875rem' }}>{color}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button type="button" className="glass-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="glass-button primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
