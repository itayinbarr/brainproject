/* Brain Atlas — floating frosted control panel */

function Slider({ value, min = 0, max = 1, step = 0.01, onChange, color, label, suffix }) {
  const ref = React.useRef(null);
  const pct = ((value - min) / (max - min)) * 100;
  const set = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    let t = (clientX - r.left) / r.width; t = Math.max(0, Math.min(1, t));
    let v = min + t * (max - min);
    v = Math.round(v / step) * step;
    onChange(Math.max(min, Math.min(max, v)));
  };
  const down = (e) => { e.preventDefault(); set(e.clientX); const mv = (ev) => set(ev.clientX); const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); };
  return (
    <div>
      {label && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{label}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{suffix != null ? suffix : Math.round(value * 100) + '%'}</span>
      </div>}
      <div ref={ref} onPointerDown={down} style={{ position: 'relative', height: 22, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 5, borderRadius: 99, background: 'rgba(16,20,32,0.10)' }} />
        <div style={{ position: 'absolute', left: 0, width: pct + '%', height: 5, borderRadius: 99, background: color || 'var(--accent)' }} />
        <div style={{ position: 'absolute', left: 'calc(' + pct + '% - 9px)', width: 18, height: 18, borderRadius: 99, background: '#fff', boxShadow: '0 1px 3px rgba(10,14,28,0.3), 0 0 0 1px rgba(10,14,28,0.06)', border: '3px solid ' + (color || 'var(--accent)') }} />
      </div>
    </div>
  );
}

function ControlPanel(props) {
  const { pos, setPos, collapsed, setCollapsed } = props;
  const dragRef = React.useRef(null);

  const startDrag = (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    const sx = e.clientX, sy = e.clientY, ox = pos.x, oy = pos.y;
    const mv = (ev) => {
      const nx = Math.max(8, Math.min(window.innerWidth - 120, ox + ev.clientX - sx));
      const ny = Math.max(8, Math.min(window.innerHeight - 80, oy + ev.clientY - sy));
      setPos({ x: nx, y: ny });
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };

  return (
    <div className="glass glass-top-hi pop" style={{
      position: 'absolute', left: pos.x, top: pos.y, width: 326, maxHeight: 'calc(100vh - 32px)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 20,
    }}>
      {/* header */}
      <div onPointerDown={startDrag} className="noselect" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 12px 14px', cursor: 'grab' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--ink)', color: '#fff', flex: '0 0 auto' }}>
          <Icon name="brain" size={17} sw={1.6} />
        </div>
        <div style={{ flex: 1, lineHeight: 1.1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)' }}>Brain Atlas</div>
          <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-faint)', marginTop: 2, letterSpacing: '0.04em' }}>{props.totalCount} STRUCTURES · Z-ANATOMY</div>
        </div>
        <Icon name="grip" size={16} style={{ color: 'var(--ink-ghost)' }} />
        <IconBtn name={collapsed ? 'chevDown' : 'chevUp'} title={collapsed ? 'Expand' : 'Collapse'} onClick={() => setCollapsed(!collapsed)} />
      </div>

      {!collapsed && (
        <React.Fragment>
          {/* search */}
          <div style={{ padding: '0 12px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 11, background: 'var(--field)', border: '1px solid var(--hair)' }}>
              <Icon name="search" size={15} style={{ color: 'var(--ink-faint)', flex: '0 0 auto' }} />
              <input value={props.search} onChange={e => props.setSearch(e.target.value)} placeholder="Search 344 structures…"
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font)', fontSize: 13, color: 'var(--ink)', minWidth: 0 }} />
              {props.search ? (
                <button onClick={() => props.setSearch('')} style={{ border: 'none', background: 'transparent', color: 'var(--ink-faint)', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name="x" size={14} /></button>
              ) : <kbd className="mono" style={{ fontSize: 9.5, color: 'var(--ink-ghost)', border: '1px solid var(--hair)', borderRadius: 5, padding: '1px 5px' }}>/</kbd>}
            </div>
            {props.search && <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 7, paddingLeft: 2 }}>{props.matchCount} match{props.matchCount === 1 ? '' : 'es'} · others dimmed in 3D</div>}
          </div>

          {/* hemisphere */}
          <div style={{ padding: '0 12px 12px' }}>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Hemisphere</div>
            <Segmented value={props.hemisphere} onChange={props.setHemisphere}
              options={[{ value: 'left', label: 'Left' }, { value: 'both', label: 'Both' }, { value: 'right', label: 'Right' }]} />
          </div>

          {/* presets */}
          <div style={{ padding: '0 12px 12px' }}>
            <div className="eyebrow" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}><Icon name="sparkles" size={12} /> Cinematic presets</div>
            <div className="scroll" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, margin: '0 -2px', paddingLeft: 2, paddingRight: 2 }}>
              {props.presets.map(p => {
                const on = props.activePreset === p.id;
                return (
                  <button key={p.id} onClick={() => props.onPreset(p.id)} style={{
                    flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 9,
                    border: '1px solid ' + (on ? 'transparent' : 'var(--hair)'), cursor: 'pointer', whiteSpace: 'nowrap',
                    background: on ? 'var(--ink)' : 'rgba(255,255,255,0.5)', color: on ? '#fff' : 'var(--ink-soft)',
                    fontFamily: 'var(--font)', fontSize: 12, fontWeight: 600, transition: 'all .15s',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: p.color || 'var(--accent)' }} />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* cortex opacity */}
          <div style={{ padding: '0 14px 14px' }}>
            <Slider label="Cortex opacity" value={props.cortexOpacity} onChange={props.setCortexOpacity} color="var(--c-cortex)" />
          </div>

          {/* layers header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 8px', gap: 8 }}>
            <Icon name="layers" size={13} style={{ color: 'var(--ink-faint)' }} />
            <span className="eyebrow" style={{ flex: 1 }}>Layers · build your view</span>
            <button onClick={props.onShowAll} style={ghostBtn}>All</button>
            <button onClick={props.onHideAll} style={ghostBtn}>None</button>
          </div>

          {/* tree */}
          <div className="scroll" style={{ overflowY: 'auto', padding: '0 8px 8px', flex: 1, minHeight: 120 }}>
            <LayersTree {...props} />
          </div>

          {/* footer */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--hair-2)' }}>
            <button onClick={props.onReset} style={footBtn}><Icon name="reset" size={14} /> Reset view</button>
            {props.isolated
              ? <button onClick={props.onClearIsolate} style={{ ...footBtn, background: 'var(--accent)', color: '#fff', borderColor: 'transparent' }}><Icon name="isolate" size={14} /> Exit isolate</button>
              : <button onClick={props.onIsolateMatches} disabled={!props.canIsolate} style={{ ...footBtn, opacity: props.canIsolate ? 1 : 0.4 }}><Icon name="isolate" size={14} /> Isolate</button>}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

const ghostBtn = { border: '1px solid var(--hair)', background: 'transparent', color: 'var(--ink-faint)', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 7, cursor: 'pointer' };
const footBtn = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid var(--hair)', background: 'rgba(255,255,255,0.5)', color: 'var(--ink-soft)', fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 600, padding: '8px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' };

Object.assign(window, { ControlPanel, Slider });
