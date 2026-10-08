'use client';
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Show, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs';
import { upload } from '@vercel/blob/client';
import JSZip from 'jszip';
import { ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, Copy, FolderOpen, Layers, Move, Plus, RotateCcw, Save, Shirt, Trash2, X } from 'lucide-react';
import { initialDesign, type Design, type Layer, type SavedDesign } from '@/lib/design';
import { assetUrl, download, loadImage, renderPrint } from '@/lib/export';

const colors = { cream: '#eee9dc', black: '#292a28', sage: '#85917d' };
export default function Studio() {
  const { user } = useUser();
  const [design, setDesign] = useState<Design>(initialDesign);
  const [side, setSide] = useState<Layer['side']>('front');
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState<SavedDesign[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; startX: number; startY: number } | null>(null);
  const localFiles = useRef(new Map<string, File>());
  const layer = design.layers.find(l => l.id === selected && l.side === side);
  const sideLayers = design.layers.filter(l => l.side === side);
  const updateLayer = (id: string, patch: Partial<Layer>) => setDesign(d => ({ ...d, layers: d.layers.map(l => l.id === id ? { ...l, ...patch } : l) }));
  async function run(task: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await task(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Something went wrong. Try again.'); }
    finally { setBusy(false); }
  }
  async function addFiles(files: FileList | null) {
    if (!files) return;
    await run(async () => {
      if (design.layers.length + files.length > 20) throw new Error('A design can have up to 20 artwork layers.');
      const additions: Layer[] = [];
      try {
        for (const file of Array.from(files)) {
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose PNG, JPEG, or WebP artwork.');
          if (file.size > 25 * 1024 * 1024) throw new Error('Each asset must be under 25 MB.');
          const source = URL.createObjectURL(file);
          try {
            const image = await loadImage(source);
            if (image.naturalWidth > 20000 || image.naturalHeight > 20000) throw new Error('Artwork must be at most 20,000 pixels per side.');
            const id = crypto.randomUUID(); localFiles.current.set(id, file);
            additions.push({ id, name: file.name, source, side, x: 0.5, y: image.naturalWidth === design.printWidth && image.naturalHeight === design.printHeight ? 0.5 : 0.4, width: image.naturalWidth === design.printWidth && image.naturalHeight === design.printHeight ? 1 : 0.75, aspect: image.naturalWidth / image.naturalHeight, rotation: 0, pixelWidth: image.naturalWidth });
          } catch (error) { URL.revokeObjectURL(source); throw error; }
        }
      } catch (error) { additions.forEach(l => { URL.revokeObjectURL(l.source); localFiles.current.delete(l.id); }); throw error; }
      setDesign(d => ({ ...d, layers: [...d.layers, ...additions] }));
      setSelected(additions.at(-1)?.id); setMessage('Artwork added. Drag it into place.');
    });
    if (fileInput.current) fileInput.current.value = '';
  }
  async function save() {
    await run(async () => {
      if (!user) throw new Error('Sign in above to save your design. You can still export locally.');
      if (!design.layers.length) throw new Error('Add artwork before saving.');
      const layers: Layer[] = [];
      for (const item of design.layers) {
        if (!item.source.startsWith('blob:')) { layers.push(item); continue; }
        const file = localFiles.current.get(item.id);
        if (!file) throw new Error('Original file unavailable. Upload it again.');
        const blob = await upload(`artwork/${user.id}/${item.id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`, file, { access: 'private', handleUploadUrl: '/api/upload' });
        layers.push({ ...item, source: blob.pathname });
      }
      // Keep successfully uploaded paths if the DB request fails, so retries do not re-upload.
      setDesign(d => ({ ...d, layers }));
      const response = await fetch('/api/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...design, layers }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage('Saved to your library. Each save creates a new version.');
    });
  }
  async function exportPackage() {
    await run(async () => {
      if (!design.layers.length) throw new Error('Add artwork before exporting.');
      const zip = new JSZip();
      for (const s of ['front', 'back'] as const) if (design.layers.some(l => l.side === s)) zip.file(`${s}-print.png`, await renderPrint(design, s));
      for (const item of design.layers) {
        const response = await fetch(assetUrl(item.source));
        if (!response.ok) throw new Error(`Could not download ${item.name}`);
        zip.file(`originals/${item.id}-${item.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`, await response.blob());
      }
      zip.file('design.json', JSON.stringify({ ...design, layers: design.layers.map(item => ({ ...item, source: undefined })) }, null, 2));
      zip.file('PRINT-NOTES.txt', `${design.name}\nTransparent PNG, ${design.printWidth} × ${design.printHeight} px at ${design.dpi} DPI.\nPhysical size: ${(design.printWidth / design.dpi * 2.54).toFixed(2)} × ${(design.printHeight / design.dpi * 2.54).toFixed(2)} cm.\nFront/back PNGs contain artwork only. Originals are unmodified.\nArtwork outside the canvas is clipped. Confirm dimensions and color requirements with your printer.\nPNG uses browser RGB color; this is not a CMYK or color-managed proof.\n`);
      download(await zip.generateAsync({ type: 'blob' }), `${design.name.replace(/[^a-zA-Z0-9_-]/g, '-') || 'design'}-print-pack.zip`);
      setMessage('Print pack exported with artwork, originals, and production notes.');
    });
  }
  async function openLibrary() {
    await run(async () => {
      const res = await fetch('/api/designs'); const data = await res.json();
      if (!res.ok) throw new Error(data.error); setSaved(data);
    });
  }
  function reset() {
    if (design.layers.length && !window.confirm('Start a new design? Export or save your current work first.')) return;
    design.layers.forEach(l => { if (l.source.startsWith('blob:')) URL.revokeObjectURL(l.source); });
    localFiles.current.clear(); setDesign(initialDesign); setSelected(undefined); setMessage('');
  }
  const effectiveDpi = layer ? Math.round(layer.pixelWidth / (layer.width * design.printWidth / design.dpi)) : null;
  return <div className="app-shell">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-icon"><Shirt size={20} /></span> PRESS<span className="brand-light"> / studio</span></Link><div className="header-right"><span className="workspace-label">Your ideas. Ready to wear.</span><Show when="signed-out"><SignInButton mode="modal"><button className="quiet">Sign in</button></SignInButton><SignUpButton mode="modal"><button className="small primary">Create account</button></SignUpButton></Show><Show when="signed-in"><UserButton /></Show></div></header>
    <main><div className="page-heading"><div><div className="eyebrow">THE DESIGN WORKSPACE</div><h1>Make it your own.</h1><p>From a blank tee to your next favorite print.</p></div><button className="secondary" onClick={reset} disabled={busy}><Plus size={16} /> New design</button></div>
    <div className="studio-grid"><aside className="panel tools"><div className="panel-title"><span>01</span><h2>Your canvas</h2></div><label className="field">Design name<input value={design.name} maxLength={100} onChange={e => setDesign(d => ({ ...d, name: e.target.value }))} disabled={busy} /></label>
      <div className="field">T-shirt color<div className="swatches">{(Object.keys(colors) as Design['color'][]).map(color => <button key={color} title={color} aria-label={`${color} shirt`} aria-pressed={design.color === color} className={design.color === color ? 'swatch active' : 'swatch'} style={{ background: colors[color] }} onClick={() => setDesign(d => ({ ...d, color }))} disabled={busy}>{design.color === color && <Check size={15} color={color === 'black' ? 'white' : '#252b27'} />}</button>)}<span>{design.color}</span></div></div>
      <div className="divider" /><div className="panel-title"><span>02</span><h2>Add your artwork</h2></div><button className="upload-zone" onClick={() => fileInput.current?.click()} disabled={busy} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) void addFiles(e.dataTransfer.files); }}><span className="upload-icon"><ArrowUpFromLine size={22} /></span><strong>Drop something good.</strong><span>or click to browse your files</span><small>PNG, JPG, WebP · up to 25 MB each</small></button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={e => void addFiles(e.target.files)} />
      <p className="tip">Transparent PNG works best. Add each graphic separately to move it independently.</p><button className="text-button" disabled={busy} onClick={() => void run(async () => { download(await renderPrint(design, side, true), `template-${design.printWidth}x${design.printHeight}-${design.dpi}dpi.png`); setMessage('Blank transparent PNG template downloaded. Keep its canvas dimensions when editing.'); })}><ArrowDownToLine size={15} /> Download blank PNG template</button>
      <details className="template-settings"><summary>Print dimensions <ChevronDown size={14} /></summary><div className="dimensions">{(['printWidth', 'printHeight', 'dpi'] as const).map(key => <label key={key}>{key === 'dpi' ? 'DPI' : key === 'printWidth' ? 'Width (px)' : 'Height (px)'}<input type="number" min={key === 'dpi' ? 72 : 300} max={key === 'dpi' ? 600 : 6000} value={design[key]} disabled={busy} onChange={e => { const value = Number(e.target.value); setDesign(d => ({ ...d, [key]: Math.max(key === 'dpi' ? 72 : 300, Math.min(key === 'dpi' ? 600 : 6000, value)) })); }} /></label>)}</div><p>Default: 12 × 16 inches at 300 DPI. Match your printer’s specification before editing.</p></details>
    </aside>
    <section className="preview-panel"><div className="preview-toolbar"><div className="side-tabs">{(['front', 'back'] as const).map(s => <button key={s} className={side === s ? 'active' : ''} onClick={() => { setSide(s); setSelected(undefined); }} disabled={busy}>{s}</button>)}</div><span className="preview-tag"><span /> LIVE PREVIEW</span></div><div className="preview-stage"><div className="shirt-wrap"><svg viewBox="0 0 500 580" className="shirt" aria-label={`${design.color} T-shirt ${side} preview`}><defs><filter id="shadow"><feDropShadow dx="0" dy="16" stdDeviation="14" floodOpacity=".1" /></filter><linearGradient id="fabric"><stop stopColor={colors[design.color]} /><stop offset=".5" stopColor={colors[design.color]} /><stop offset="1" stopColor={design.color === 'black' ? '#20211f' : design.color === 'sage' ? '#778570' : '#ded8c9'} /></linearGradient></defs><path d="M165 58 L204 42 Q250 70 296 42 L335 58 L440 145 L390 214 L344 184 L354 516 Q250 534 146 516 L156 184 L110 214 L60 145 Z" fill="url(#fabric)" stroke={design.color === 'black' ? '#171916' : '#cbc6b9'} filter="url(#shadow)" /><path d={side === 'front' ? 'M204 42 Q208 107 250 108 Q292 107 296 42' : 'M204 42 Q250 72 296 42'} fill="none" stroke={design.color === 'black' ? '#151714' : '#c5c0b3'} strokeWidth="7" /><path d="M156 184 L164 125 M344 184 L336 125 M150 505 Q250 522 350 505" fill="none" stroke={design.color === 'black' ? '#353730' : '#c6c1b5'} strokeWidth="2" opacity=".6" /></svg>
      <div ref={area} className="print-area" style={{ aspectRatio: `${design.printWidth}/${design.printHeight}`, width: `${Math.min(34, 61.48 * design.printWidth / design.printHeight)}%`, left: `${(100 - Math.min(34, 61.48 * design.printWidth / design.printHeight)) / 2}%` }} onPointerDown={e => { if (e.target === e.currentTarget) setSelected(undefined); }} onPointerMove={e => { if (!drag.current || busy || !area.current) return; const rect = area.current.getBoundingClientRect(); const d = drag.current; updateLayer(d.id, { x: Math.max(-1, Math.min(2, d.x + (e.clientX - d.startX) / rect.width)), y: Math.max(-1, Math.min(2, d.y + (e.clientY - d.startY) / rect.height)) }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        {!sideLayers.length && <div className="empty-print"><Plus size={24} /><span>Your artwork<br />goes here</span></div>}
        {sideLayers.map(item => <div key={item.id} className={`artwork ${selected === item.id ? 'selected' : ''}`} style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, width: `${item.width * 100}%`, aspectRatio: item.aspect, transform: `translate(-50%, -50%) rotate(${item.rotation}deg)` }} onPointerDown={e => { if (busy) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setSelected(item.id); drag.current = { id: item.id, x: item.x, y: item.y, startX: e.clientX, startY: e.clientY }; }}><img src={assetUrl(item.source)} alt={item.name} draggable={false} />{selected === item.id && <><i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" /></>}</div>)}
      </div></div></div><div className="preview-footer"><span><Move size={14} /> Drag artwork to position</span><span>Dashed border = print area</span></div></section>
    <aside className="panel properties"><div className="panel-title"><Layers size={17} /><h2>Artwork layers</h2><span className="count">{sideLayers.length}</span></div>{!sideLayers.length ? <div className="empty-layers"><Layers size={26} /><p>A little blank canvas energy.</p><span>Your uploaded artwork will appear here.</span></div> : <div className="layer-list">{sideLayers.map((item, index) => <button key={item.id} className={selected === item.id ? 'layer-row active' : 'layer-row'} onClick={() => setSelected(item.id)} disabled={busy}><img src={assetUrl(item.source)} alt="" /><span>{item.name}<small>Layer {index + 1}</small></span></button>)}</div>}
      {layer && <div className="controls"><div className="divider" /><h3>Fine-tune placement</h3><label className="range-label">Size <span>{Math.round(layer.width * 100)}%</span><input type="range" min="1" max="200" value={layer.width * 100} onChange={e => updateLayer(layer.id, { width: Number(e.target.value) / 100 })} disabled={busy} /></label><label className="range-label">Rotation <span>{layer.rotation}°</span><input type="range" min="-180" max="180" value={layer.rotation} onChange={e => updateLayer(layer.id, { rotation: Number(e.target.value) })} disabled={busy} /></label><div className="button-pair"><button onClick={() => updateLayer(layer.id, { x: .5, y: .5 })} disabled={busy}><Move size={14} /> Center</button><button onClick={() => updateLayer(layer.id, { rotation: 0, width: .75, x: .5, y: .4 })} disabled={busy}><RotateCcw size={14} /> Reset</button></div><label className="field">Print side<select aria-label="Print side" value={layer.side} onChange={e => { updateLayer(layer.id, { side: e.target.value as Layer['side'] }); setSide(e.target.value as Layer['side']); }} disabled={busy}><option value="front">Front</option><option value="back">Back</option></select></label><p className={effectiveDpi! < 150 ? 'resolution warning' : 'resolution'}>{effectiveDpi} effective DPI{effectiveDpi! < 150 ? ' · may look soft at print size' : ' at current size'}</p><div className="button-pair"><button onClick={() => { if (design.layers.length >= 20) { setMessage('Maximum 20 layers.'); return; } const id = crypto.randomUUID(); const file = localFiles.current.get(layer.id); if (file) localFiles.current.set(id, file); setDesign(d => ({ ...d, layers: [...d.layers, { ...layer, id, x: Math.min(2, layer.x + .05), y: Math.min(2, layer.y + .05) }] })); setSelected(id); }} disabled={busy}><Copy size={14} /> Duplicate</button><button className="danger" disabled={busy} onClick={() => { setDesign(d => ({ ...d, layers: d.layers.filter(l => l.id !== layer.id) })); setSelected(undefined); }}><Trash2 size={14} /> Remove</button></div></div>}
      <div className="handoff"><div className="eyebrow">MADE FOR THE PRINT SHOP</div><h3>Good to go, pixel for pixel.</h3><p>Your export keeps the exact template dimensions. No shirt, no guides — just your print.</p><div className="spec"><span>Print canvas</span><strong>{design.printWidth} × {design.printHeight} px</strong></div><div className="spec"><span>Format</span><strong>Transparent PNG · {design.dpi} DPI</strong></div><div className="spec"><span>Physical size</span><strong>{(design.printWidth / design.dpi * 2.54).toFixed(1)} × {(design.printHeight / design.dpi * 2.54).toFixed(1)} cm</strong></div></div>
    </aside></div>
    <div className="actionbar"><button className="text-button" onClick={() => void openLibrary()} disabled={busy}><FolderOpen size={17} /> My saved designs</button><div><button className="secondary" onClick={() => void save()} disabled={busy || !design.name.trim()}><Save size={16} /> Save design</button><button className="primary" disabled={busy || !design.layers.length} onClick={() => void exportPackage()}><ArrowDownToLine size={17} /> {busy ? 'Working…' : 'Export print pack'}</button></div></div><p className="status" role="status" aria-live="polite">{message || 'Your canvas stays in this tab until you save. Export a print pack anytime.'}</p>
    <footer className="footer"><span>FROM FIRST IDEA TO FINAL THREAD.</span><span>Designed by you. Prepared by Press.</span></footer></main>
    {saved && <div className="modal-backdrop"><section className="library" role="dialog" aria-modal="true" aria-label="Saved designs"><button className="close" onClick={() => setSaved(null)} aria-label="Close library"><X /></button><div className="eyebrow">YOUR WORK</div><h2>Saved designs</h2>{saved.length === 0 && <p>No saved designs yet. Your first one starts here.</p>}{saved.map(item => <button className="saved-row" key={item.id} disabled={busy} onClick={() => { if (design.layers.length && !window.confirm('Open this saved design and replace the current canvas? Save or export current work first.')) return; void run(async () => { const res = await fetch(`/api/designs/${item.id}`); const document = await res.json(); if (!res.ok) throw new Error(document.error); setDesign(document); setSelected(undefined); setSaved(null); setMessage('Design opened.'); }); }}><Shirt size={20} /><span>{item.name}<small>{new Date(item.updated_at).toLocaleString()}</small></span><span>Open →</span></button>)}</section></div>}
  </div>;
}
