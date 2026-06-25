import { NodeResizer } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';

export type ShapeNodeType = Node<{
  shapeType?: 'rectangle' | 'circle' | 'rounded-rectangle';
  label?: string;
  fontSize?: number;
  fontColor?: string;
  bgColor?: string;
  bgOpacity?: number;
  borderColor?: string;
  borderStyle?: string;
  borderWidth?: number;
  locked?: boolean;
}, 'shape'>;

export function ShapeNode({ data, selected }: NodeProps<ShapeNodeType>) {
  const shapeType = data.shapeType || 'rectangle';
  const label = data.label || '';
  const fontSize = data.fontSize || 14;
  const fontColor = data.fontColor || '#94a3b8';
  const bgColor = data.bgColor || '#1e293b';
  const bgOpacity = data.bgOpacity !== undefined ? data.bgOpacity : 0.3;
  const borderColor = data.borderColor || '#475569';
  const borderStyle = data.borderStyle || 'solid';
  const borderWidth = data.borderWidth !== undefined ? data.borderWidth : 2;

  let borderRadiusStyle = '0px';
  if (shapeType === 'rounded-rectangle') {
    borderRadiusStyle = '12px';
  } else if (shapeType === 'circle') {
    borderRadiusStyle = '50%';
  }

  return (
    <div 
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        boxSizing: 'border-box',
        borderRadius: borderRadiusStyle,
        overflow: 'hidden',
      }}
    >
      <div 
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: bgColor,
          opacity: bgOpacity,
          border: borderStyle === 'none' ? 'none' : `${borderWidth}px ${borderStyle} ${borderColor}`,
          borderRadius: borderRadiusStyle,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      />
      {selected && !data.locked && (
        <NodeResizer 
          minWidth={80} 
          minHeight={80} 
          handleStyle={{ width: 8, height: 8, background: '#10b981', border: '1px solid #fff' }}
          lineStyle={{ borderColor: '#10b981' }}
        />
      )}
      {label && (
        <div 
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '12px',
            fontSize: `${fontSize}px`,
            color: fontColor,
            fontWeight: 'bold',
            textAlign: 'center',
            userSelect: 'none',
            pointerEvents: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
