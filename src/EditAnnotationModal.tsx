import { useState } from 'react';
import { useStore } from './store';

interface Props {
  nodeId: string;
  nodeType: 'annotation' | 'shape';
  initialData: any;
  onClose: () => void;
}

const colorPresets = [
  { name: 'Transparent', value: 'transparent' },
  { name: 'Dark Slate', value: '#1e293b' },
  { name: 'Deep Night', value: '#0f172a' },
  { name: 'Steel Gray', value: '#334155' },
  { name: 'Warm Amber', value: '#78350f' },
  { name: 'Forest Green', value: '#064e3b' },
  { name: 'Navy Blue', value: '#1e3a8a' },
  { name: 'Burgundy Red', value: '#5c0606' },
  { name: 'Royal Purple', value: '#4c1d95' },
  { name: 'Sticky Yellow', value: '#4d4615' }, // darker premium sticky yellow
];

const borderPresets = [
  { name: 'Slate Gray', value: '#475569' },
  { name: 'Sky Blue', value: '#38bdf8' },
  { name: 'Emerald Green', value: '#10b981' },
  { name: 'Amber Gold', value: '#f59e0b' },
  { name: 'Vibrant Red', value: '#ef4444' },
  { name: 'Soft White', value: '#ffffff' },
  { name: 'None', value: 'transparent' },
];

const quickTemplates = [
  { 
    name: '📌 Sticky Yellow', 
    bgColor: '#4d4615', 
    bgOpacity: 0.9, 
    fontColor: '#fef08a', 
    borderColor: '#ca8a04', 
    borderStyle: 'solid',
    borderRadius: 4
  },
  { 
    name: 'ℹ️ Info Blue', 
    bgColor: '#1e3a8a', 
    bgOpacity: 0.8, 
    fontColor: '#93c5fd', 
    borderColor: '#3b82f6', 
    borderStyle: 'solid',
    borderRadius: 8
  },
  { 
    name: '⚠️ Warning Red', 
    bgColor: '#5c0606', 
    bgOpacity: 0.85, 
    fontColor: '#fca5a5', 
    borderColor: '#ef4444', 
    borderStyle: 'dashed',
    borderRadius: 8
  },
  { 
    name: '📄 Clean Card', 
    bgColor: '#0f172a', 
    bgOpacity: 0.95, 
    fontColor: '#f8fafc', 
    borderColor: '#334155', 
    borderStyle: 'solid',
    borderRadius: 8
  },
];

export function EditAnnotationModal({ nodeId, nodeType, initialData, onClose }: Props) {
  const { updateNodeData, setNodes, nodes } = useStore();

  // Annotation states
  const [label, setLabel] = useState(initialData.label || '');
  const [fontSize, setFontSize] = useState(initialData.fontSize || 14);
  const [fontColor, setFontColor] = useState(initialData.fontColor || '#ffffff');
  const [bgColor, setBgColor] = useState(initialData.bgColor || '#1e293b');
  const [bgOpacity, setBgOpacity] = useState(initialData.bgOpacity !== undefined ? initialData.bgOpacity : (nodeType === 'shape' ? 0.3 : 0.8));
  const [borderColor, setBorderColor] = useState(initialData.borderColor || '#38bdf8');
  const [borderStyle, setBorderStyle] = useState(initialData.borderStyle || (nodeType === 'shape' ? 'solid' : 'dashed'));
  const [borderRadius, setBorderRadius] = useState(initialData.borderRadius || 8);
  const [textAlign, setTextAlign] = useState(initialData.textAlign || 'center');

  const [locked, setLocked] = useState(initialData.locked || false);

  // Shape states
  const [shapeType, setShapeType] = useState(initialData.shapeType || 'rectangle');
  const [borderWidth, setBorderWidth] = useState(initialData.borderWidth || 2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedData: any = {
      label,
      fontSize: Number(fontSize),
      fontColor,
      bgColor,
      bgOpacity: Number(bgOpacity),
      borderColor,
      borderStyle,
      locked,
    };

    if (nodeType === 'annotation') {
      updatedData.borderRadius = Number(borderRadius);
      updatedData.textAlign = textAlign;
    } else {
      updatedData.shapeType = shapeType;
      updatedData.borderWidth = Number(borderWidth);
    }

    updateNodeData(nodeId, updatedData);
    onClose();
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this annotation?')) {
      setNodes(nodes.filter((n) => n.id !== nodeId));
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div className="glass-panel modal-panel" style={{ width: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '12px' }}>
        <h2 style={{ marginBottom: '16px', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Edit {nodeType === 'annotation' ? 'Text Annotation' : 'Shape / Zone'}</span>
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Label / Text area */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {nodeType === 'annotation' ? 'Annotation Text' : 'Zone Label (Optional)'}
            </label>
            {nodeType === 'annotation' ? (
              <textarea 
                required 
                className="glass-input" 
                value={label} 
                onChange={e => setLabel(e.target.value)} 
                rows={3}
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              />
            ) : (
              <input 
                className="glass-input" 
                value={label} 
                onChange={e => setLabel(e.target.value)} 
                style={{ width: '100%' }}
                placeholder="e.g. ZONE A / MAIN RACK"
              />
            )}
          </div>

          {nodeType === 'annotation' && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Quick Presets (빠른 템플릿)
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {quickTemplates.map((template) => (
                  <button
                    key={template.name}
                    type="button"
                    className="glass-button"
                    style={{ fontSize: '0.75rem', padding: '6px 10px', flex: '1 1 auto', textAlign: 'center' }}
                    onClick={() => {
                      setBgColor(template.bgColor);
                      setBgOpacity(template.bgOpacity);
                      setFontColor(template.fontColor);
                      setBorderColor(template.borderColor);
                      setBorderStyle(template.borderStyle);
                      setBorderRadius(template.borderRadius);
                    }}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {nodeType === 'shape' && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Shape Type</label>
              <select className="glass-input" value={shapeType} onChange={e => setShapeType(e.target.value as any)} style={{ backgroundColor: 'var(--panel-bg)', width: '100%' }}>
                <option value="rectangle">Rectangle (직사각형)</option>
                <option value="rounded-rectangle">Rounded Rectangle (둥근 직사각형)</option>
                <option value="circle">Oval / Circle (원형)</option>
              </select>
            </div>
          )}

          {/* Typography options */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Font Size (px)</label>
              <input 
                type="number" 
                className="glass-input" 
                min={10} 
                max={60} 
                value={fontSize} 
                onChange={e => setFontSize(e.target.value)} 
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Font Color</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="color" 
                  value={fontColor.startsWith('#') ? fontColor : '#ffffff'} 
                  onChange={e => setFontColor(e.target.value)} 
                  style={{ width: '32px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
                />
                <input 
                  type="text" 
                  className="glass-input" 
                  value={fontColor} 
                  onChange={e => setFontColor(e.target.value)} 
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
            </div>
          </div>

          {nodeType === 'annotation' && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Text Alignment</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {['left', 'center', 'right'].map((align) => (
                  <button
                    key={align}
                    type="button"
                    className={`glass-button ${textAlign === align ? 'primary' : ''}`}
                    onClick={() => setTextAlign(align as any)}
                    style={{ flex: 1, textTransform: 'capitalize', fontSize: '0.75rem', padding: '6px' }}
                  >
                    {align}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Background settings */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Background Fill Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {colorPresets.map(preset => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setBgColor(preset.value)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: preset.value === 'transparent' ? '#ffffff' : preset.value,
                    backgroundImage: preset.value === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : undefined,
                    backgroundSize: preset.value === 'transparent' ? '8px 8px' : undefined,
                    backgroundPosition: preset.value === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : undefined,
                    border: bgColor === preset.value ? '2px solid var(--accent-color)' : '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer'
                  }}
                  title={preset.name}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="color" 
                value={bgColor.startsWith('#') ? bgColor : '#1e293b'} 
                onChange={e => setBgColor(e.target.value)} 
                style={{ width: '32px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
              />
              <input 
                type="text" 
                className="glass-input" 
                value={bgColor} 
                onChange={e => setBgColor(e.target.value)} 
                style={{ flex: 1, minWidth: 0 }}
              />
            </div>
          </div>

          {/* Opacity slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Fill Opacity</label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{Math.round(bgOpacity * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={bgOpacity} 
              onChange={e => setBgOpacity(Number(e.target.value))} 
              style={{ width: '100%', accentColor: 'var(--accent-color)' }}
            />
          </div>

          {/* Border settings */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Border Style</label>
              <select className="glass-input" value={borderStyle} onChange={e => setBorderStyle(e.target.value)} style={{ backgroundColor: 'var(--panel-bg)', width: '100%' }}>
                <option value="none">None (없음)</option>
                <option value="solid">Solid (실선)</option>
                <option value="dashed">Dashed (점선)</option>
                <option value="dotted">Dotted (초점선)</option>
              </select>
            </div>

            {nodeType === 'annotation' ? (
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Corner Radius (px)</label>
                <input 
                  type="number" 
                  className="glass-input" 
                  min={0} 
                  max={30} 
                  value={borderRadius} 
                  onChange={e => setBorderRadius(e.target.value)} 
                  style={{ width: '100%' }}
                />
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Border Width (px)</label>
                <input 
                  type="number" 
                  className="glass-input" 
                  min={1} 
                  max={10} 
                  value={borderWidth} 
                  onChange={e => setBorderWidth(e.target.value)} 
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Border Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {borderPresets.map(preset => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setBorderColor(preset.value)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: preset.value === 'transparent' ? '#ffffff' : preset.value,
                    backgroundImage: preset.value === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : undefined,
                    backgroundSize: preset.value === 'transparent' ? '8px 8px' : undefined,
                    backgroundPosition: preset.value === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : undefined,
                    border: borderColor === preset.value ? '2px solid var(--accent-color)' : '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer'
                  }}
                  title={preset.name}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="color" 
                value={borderColor.startsWith('#') ? borderColor : '#38bdf8'} 
                onChange={e => setBorderColor(e.target.value)} 
                style={{ width: '32px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
              />
              <input 
                type="text" 
                className="glass-input" 
                value={borderColor} 
                onChange={e => setBorderColor(e.target.value)} 
                style={{ flex: 1, minWidth: 0 }}
              />
            </div>
          </div>

          {/* Lock Position Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderTop: '1px solid var(--panel-border)', borderBottom: '1px solid var(--panel-border)' }}>
            <input 
              type="checkbox" 
              id="lock-node-position" 
              checked={locked} 
              onChange={e => setLocked(e.target.checked)} 
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
            />
            <label htmlFor="lock-node-position" style={{ fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>
              🔒 Lock Position & Size (위치 및 크기 잠금)
            </label>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
            <button 
              type="button" 
              className="glass-button" 
              onClick={handleDelete}
              style={{ borderColor: '#ef4444', color: '#ef4444' }}
            >
              Delete {nodeType === 'annotation' ? 'Note' : 'Zone'}
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="glass-button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="glass-button primary">
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
