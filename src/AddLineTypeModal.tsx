import { useState } from 'react';
import { useStore } from './store';

interface Props {
  onClose: () => void;
}

export function AddLineTypeModal({ onClose }: Props) {
  const addLineType = useStore((state) => state.addLineType);
  
  const [name, setName] = useState('');
  const [color, setColor] = useState('#ffffff');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addLineType({ name, color });
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
      <div className="glass-panel modal-panel" style={{ width: '300px', padding: '24px', borderRadius: '12px' }}>
        <h2 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Add Line Type</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>Name</label>
            <input 
              required 
              className="glass-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. HDMI"
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>Color</label>
            <input 
              required 
              type="color"
              className="glass-input" 
              value={color} 
              onChange={e => setColor(e.target.value)} 
              style={{ height: '40px', padding: '2px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button type="button" className="glass-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="glass-button primary">Add Line</button>
          </div>
        </form>
      </div>
    </div>
  );
}
