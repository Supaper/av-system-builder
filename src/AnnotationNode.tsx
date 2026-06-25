import { NodeResizer } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';

export type AnnotationNodeType = Node<{
  label: string;
  fontSize?: number;
  fontColor?: string;
  bgColor?: string;
  bgOpacity?: number;
  borderColor?: string;
  borderStyle?: string;
  borderRadius?: number;
  textAlign?: 'left' | 'center' | 'right';
  locked?: boolean;
}, 'annotation'>;

export function AnnotationNode({ data, selected }: NodeProps<AnnotationNodeType>) {
  const label = data.label || 'Double click to edit note...';
  const fontSize = data.fontSize || 14;
  const fontColor = data.fontColor || '#ffffff';
  const bgColor = data.bgColor || '#1e293b';
  const bgOpacity = data.bgOpacity !== undefined ? data.bgOpacity : 0.8;
  const borderColor = data.borderColor || '#38bdf8';
  const borderStyle = data.borderStyle || 'dashed';
  const borderRadius = data.borderRadius !== undefined ? data.borderRadius : 8;
  const textAlign = data.textAlign || 'center';

  return (
    <div 
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        boxSizing: 'border-box',
        borderRadius: `${borderRadius}px`,
      }}
    >
      <div 
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: bgColor,
          opacity: bgOpacity,
          border: borderStyle === 'none' ? 'none' : `1.5px ${borderStyle} ${borderColor}`,
          borderRadius: `${borderRadius}px`,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      />
      {selected && !data.locked && (
        <NodeResizer 
          minWidth={60} 
          minHeight={30} 
          handleStyle={{ width: 8, height: 8, background: '#38bdf8', border: '1px solid #fff' }}
          lineStyle={{ borderColor: '#38bdf8' }}
        />
      )}
      <div 
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          boxSizing: 'border-box',
          color: fontColor,
          fontSize: `${fontSize}px`,
          textAlign: textAlign,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontWeight: 500,
        }}
      >
        {label}
      </div>
    </div>
  );
}
