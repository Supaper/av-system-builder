import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, Clipboard, Database, AlertCircle } from 'lucide-react';
import type { EquipmentCategory, Port, PortType } from './store';

export interface RawEquipment {
  category: EquipmentCategory;
  name: string;
  model: string;
  inputs: Port[];
  outputs: Port[];
  bidirectional: Port[];
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (imported: RawEquipment[], mergeMode: 'append' | 'overwrite') => void;
}

export function BulkImportModal({ isOpen, onClose, onImport }: BulkImportModalProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'sheets' | 'file'>('paste');
  const [pastedText, setPastedText] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [mergeMode, setMergeMode] = useState<'append' | 'overwrite'>('append');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewData, setPreviewData] = useState<RawEquipment[]>([]);

  if (!isOpen) return null;

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map(cell => cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
  };

  const convertGoogleSheetsUrl = (url: string): string | null => {
    const regExp = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regExp);
    if (!match) return null;
    const sheetId = match[1];
    
    let gid = '0';
    const gidMatch = url.match(/gid=([0-9]+)/);
    if (gidMatch) {
      gid = gidMatch[1];
    }
    
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  };

  const parsePorts = (portStr: string, defaultType: string, direction: 'in' | 'out' | 'both'): Port[] => {
    const str = portStr.trim();
    if (!str) return [];

    const ports: Port[] = [];
    const prefix = direction === 'in' ? 'In' : direction === 'out' ? 'Out' : 'Port';

    if (/^\d+$/.test(str)) {
      const count = parseInt(str);
      for (let i = 1; i <= count; i++) {
        ports.push({
          id: `${direction}-${defaultType}-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          label: `${prefix} ${i}`,
          type: defaultType as PortType,
          direction
        });
      }
      return ports;
    }

    if (str.includes(':') || str.includes(',')) {
      const items = str.split(',').map(s => s.trim());
      const typeCounts: Record<string, number> = {};
      
      items.forEach(item => {
        const parts = item.split(':').map(s => s.trim());
        if (parts.length === 2) {
          const type = parts[0].toLowerCase();
          const count = parseInt(parts[1]) || 0;
          if (count > 0) {
            typeCounts[type] = (typeCounts[type] || 0) + count;
          }
        } else if (parts.length === 1 && /^\d+$/.test(parts[0])) {
          const count = parseInt(parts[0]) || 0;
          typeCounts[defaultType] = (typeCounts[defaultType] || 0) + count;
        }
      });

      let portIndex = 1;
      Object.entries(typeCounts).forEach(([type, count]) => {
        for (let i = 1; i <= count; i++) {
          ports.push({
            id: `${direction}-${type}-${portIndex}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            label: `${prefix} ${portIndex}`,
            type: (['video', 'audio', 'control', 'network'].includes(type) ? type : defaultType) as PortType,
            direction
          });
          portIndex++;
        }
      });

      if (ports.length > 0) return ports;
    }

    if (str.includes(';')) {
      const items = str.split(';').map(s => s.trim());
      items.forEach((item, index) => {
        if (!item) return;
        const match = item.match(/(.+?)\s*\((video|audio|control|network)\)/i);
        let label = item;
        let type = defaultType;
        if (match) {
          label = match[1].trim();
          type = match[2].toLowerCase();
        }
        ports.push({
          id: `${direction}-${type}-${index + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          label,
          type: type as PortType,
          direction
        });
      });
      return ports;
    }

    ports.push({
      id: `${direction}-${defaultType}-1-${Date.now()}`,
      label: str,
      type: defaultType as PortType,
      direction
    });

    return ports;
  };

  const processImportData = (rows: string[][], headers: string[]) => {
    setErrorMsg('');
    if (rows.length === 0) {
      setErrorMsg('No data rows found.');
      return;
    }

    const headerMap: Record<string, number> = {};
    headers.forEach((h, idx) => {
      const clean = h.trim().toLowerCase();
      if (clean.includes('category') || clean.includes('카테고리') || clean.includes('분류')) {
        headerMap['category'] = idx;
      } else if (clean.includes('name') || clean.includes('이름') || clean.includes('장비명')) {
        headerMap['name'] = idx;
      } else if (clean.includes('model') || clean.includes('모델') || clean.includes('모델명')) {
        headerMap['model'] = idx;
      } else if (clean.includes('inputs') || clean.includes('입력')) {
        headerMap['inputs'] = idx;
      } else if (clean.includes('outputs') || clean.includes('출력')) {
        headerMap['outputs'] = idx;
      } else if (clean.includes('bidirectional') || clean.includes('양방향') || clean.includes('bidi')) {
        headerMap['bidirectional'] = idx;
      }
    });

    if (headerMap['category'] === undefined || headerMap['name'] === undefined) {
      setErrorMsg('Required columns (Category, Name) could not be identified from the headers.');
      return;
    }

    const parsed: RawEquipment[] = [];
    rows.forEach((row) => {
      if (row.filter(c => c.trim()).length === 0) return; // Skip empty row

      let category = (row[headerMap['category']] || '').trim().toLowerCase();
      if (category.includes('비디오') || category.includes('영상')) category = 'video';
      if (category.includes('오디오') || category.includes('음향')) category = 'audio';
      if (category.includes('제어') || category.includes('컨트롤')) category = 'control';
      if (category.includes('네트워크') || category.includes('통신')) category = 'network';

      const validCategories = ['video', 'audio', 'control', 'network'];
      const finalCategory = (validCategories.includes(category) ? category : 'video') as EquipmentCategory;

      const name = (row[headerMap['name']] || '').trim();
      const model = headerMap['model'] !== undefined ? (row[headerMap['model']] || '').trim() : '';
      
      if (!name) return; // Name is required

      const inputsStr = headerMap['inputs'] !== undefined ? (row[headerMap['inputs']] || '').trim() : '';
      const outputsStr = headerMap['outputs'] !== undefined ? (row[headerMap['outputs']] || '').trim() : '';
      const bidiStr = headerMap['bidirectional'] !== undefined ? (row[headerMap['bidirectional']] || '').trim() : '';

      const inputs = parsePorts(inputsStr, finalCategory, 'in');
      const outputs = parsePorts(outputsStr, finalCategory, 'out');
      const bidirectional = parsePorts(bidiStr, finalCategory, 'both');

      parsed.push({
        category: finalCategory,
        name,
        model: model || 'Generic',
        inputs,
        outputs,
        bidirectional
      });
    });

    if (parsed.length === 0) {
      setErrorMsg('No valid equipment records could be parsed.');
    } else {
      setPreviewData(parsed);
    }
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) {
      setErrorMsg('Please paste some tab-separated or comma-separated values.');
      return;
    }

    const lines = pastedText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) {
      setErrorMsg('Data must contain at least a header row and one data row.');
      return;
    }

    const firstLine = lines[0];
    const isTab = firstLine.includes('\t');

    const headers = isTab ? firstLine.split('\t') : parseCSVLine(firstLine);
    const rows = lines.slice(1).map(l => isTab ? l.split('\t') : parseCSVLine(l));

    processImportData(rows, headers);
  };

  const handleSheetsFetch = async () => {
    if (!sheetUrl.trim()) {
      setErrorMsg('Please enter a Google Sheets URL.');
      return;
    }

    const csvUrl = convertGoogleSheetsUrl(sheetUrl);
    if (!csvUrl) {
      setErrorMsg('Invalid Google Sheets URL format. Please paste a standard Google Sheets sharing link.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch spreadsheet. Make sure sharing is set to "Anyone with the link can view".');
      }
      const csvText = await response.text();
      const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      if (lines.length < 2) {
        throw new Error('Spreadsheet does not contain enough data (header and at least one row required).');
      }

      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1).map(l => parseCSVLine(l));
      processImportData(rows, headers);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while fetching the Google Sheet.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        if (lines.length < 2) {
          setErrorMsg('File must contain at least a header row and one data row.');
          return;
        }

        const isTab = file.name.endsWith('.tsv') || lines[0].includes('\t');
        const headers = isTab ? lines[0].split('\t') : parseCSVLine(lines[0]);
        const rows = lines.slice(1).map(l => isTab ? l.split('\t') : parseCSVLine(l));

        processImportData(rows, headers);
      } catch (err) {
        setErrorMsg('Failed to read and parse CSV/TSV file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (previewData.length === 0) return;
    onImport(previewData, mergeMode);
    setPreviewData([]);
    setPastedText('');
    setSheetUrl('');
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="modal-content glass-panel modal-panel" style={{ width: '600px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px', borderRadius: '12px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={20} className="text-accent" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>Bulk Import Equipment Database</h3>
          </div>
          <button className="close-button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={20} />
          </button>
        </div>

        {/* Preview Panel (If Data is Parsed) */}
        {previewData.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflow: 'hidden' }}>
            <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b98155', color: '#10b981' }}>
              Successfully parsed <strong>{previewData.length}</strong> equipment items!
            </div>
            
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Preview parsed items:</span>
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--panel-border)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {previewData.slice(0, 10).map((eq, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, marginRight: '6px', color: 'var(--text-primary)' }}>{eq.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>({eq.model})</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem' }}>
                    <span className={`badge category-${eq.category}`} style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem' }}>{eq.category}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>In: {eq.inputs.length} | Out: {eq.outputs.length} | Bi: {eq.bidirectional?.length || 0}</span>
                  </div>
                </div>
              ))}
              {previewData.length > 10 && (
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '4px 0' }}>
                  And {previewData.length - 10} more items...
                </div>
              )}
            </div>

            {/* Merge Mode Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--panel-border)', paddingTop: '12px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Merge Mode:</span>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <input type="radio" checked={mergeMode === 'append'} onChange={() => setMergeMode('append')} />
                  Append (Add to current library)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <input type="radio" checked={mergeMode === 'overwrite'} onChange={() => setMergeMode('overwrite')} />
                  Overwrite (Replace current library)
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="glass-button" onClick={() => setPreviewData([])}>Back</button>
              <button className="glass-button primary" onClick={handleConfirmImport}>Confirm & Import</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflow: 'hidden' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--panel-border)', gap: '4px' }}>
              <button 
                onClick={() => { setActiveTab('paste'); setErrorMsg(''); }}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', borderBottom: activeTab === 'paste' ? '2px solid #3b82f6' : 'none', color: activeTab === 'paste' ? '#3b82f6' : 'inherit', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Clipboard size={14} /> Paste from Excel / Sheets
              </button>
              <button 
                onClick={() => { setActiveTab('sheets'); setErrorMsg(''); }}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', borderBottom: activeTab === 'sheets' ? '2px solid #3b82f6' : 'none', color: activeTab === 'sheets' ? '#3b82f6' : 'inherit', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <FileSpreadsheet size={14} /> Google Sheets URL
              </button>
              <button 
                onClick={() => { setActiveTab('file'); setErrorMsg(''); }}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: 'none', borderBottom: activeTab === 'file' ? '2px solid #3b82f6' : 'none', color: activeTab === 'file' ? '#3b82f6' : 'inherit', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Upload size={14} /> Upload CSV/TSV File
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef444455', color: '#ef4444' }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Tab Contents */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {activeTab === 'paste' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Copy cells from Excel or Google Sheets (including headers) and paste them here:
                  </span>
                  <textarea
                    className="glass-input"
                    placeholder="Category&#9;Name&#9;Model&#9;Inputs&#9;Outputs&#9;Bidirectional&#10;video&#9;PTZ CAM&#9;TR315&#9;0&#9;video:1&#9;0&#10;audio&#9;DSP&#9;BLU-50&#9;audio:4&#9;audio:4&#9;control:1"
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    style={{ width: '100%', height: '180px', fontFamily: 'monospace', fontSize: '0.75rem', padding: '12px', whiteSpace: 'pre', overflowX: 'auto' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="glass-button primary" onClick={handlePasteSubmit}>Parse Data</button>
                  </div>
                </div>
              )}

              {activeTab === 'sheets' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Ensure your Google Sheet is shared as <strong>"Anyone with the link can view"</strong>. Paste the sharing link below:
                  </span>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    style={{ width: '100%', padding: '10px', fontSize: '0.75rem' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="glass-button primary" onClick={handleSheetsFetch} disabled={loading}>
                      {loading ? 'Fetching...' : 'Fetch & Parse'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'file' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '24px', border: '2px dashed var(--panel-border)', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'rgba(255,255,255,0.01)' }} onClick={() => document.getElementById('bulk-file-input')?.click()}>
                  <Upload size={32} className="text-secondary" style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Click to choose a CSV or TSV file</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Supports .csv, .tsv, .txt files</span>
                  <input
                    id="bulk-file-input"
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              )}
            </div>

            {/* Formatting Help */}
            <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>💡 File Columns Formatting Rules:</span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li><strong>Category:</strong> <code>video</code>, <code>audio</code>, <code>control</code>, or <code>network</code> (Korean categories like '영상' or '음향' are also recognized).</li>
                <li><strong>Name & Model:</strong> Text fields. (Name is required).</li>
                <li><strong>Ports (Inputs, Outputs, Bidirectional):</strong>
                  <ul style={{ paddingLeft: '12px', listStyleType: 'circle', marginTop: '2px' }}>
                    <li>A simple number (e.g. <code>4</code>) will generate 4 ports of the default type.</li>
                    <li>Port types (e.g. <code>video:2, audio:4</code>) will generate specified counts per port type.</li>
                    <li>Semicolon-separated names (e.g. <code>In 1 (video); In 2 (audio)</code>) will generate custom port names and types.</li>
                  </ul>
                </li>
              </ul>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
