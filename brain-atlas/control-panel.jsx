/* Brain Atlas - floating frosted control panel */

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

const LEVEL_COLOR = { Intro: 'var(--c-ventricles)', Core: 'var(--accent)', Advanced: 'var(--c-deep_grey)' };

/* ---------------- Systems (functional views) ---------------- */
function SystemsMode({ activeSystem, onStartSystem }) {
  return (
    <div style={{ padding: '0 10px 10px' }}>
      <p style={{ margin: '0 10px 12px', fontSize: 12, lineHeight: 1.5, color: 'var(--ink-faint)' }}>
        Watch a functional pathway light up on the specimen, stage by stage. Pick a system to step through it.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {window.SYS.SYSTEMS.map(s => {
          const on = activeSystem === s.id;
          const accent = 'var(--c-' + (s.cat || 'cortex') + ')';
          return (
            <button key={s.id} onClick={() => onStartSystem(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
              border: '1px solid ' + (on ? 'transparent' : 'var(--hair)'), background: on ? 'var(--ink)' : 'rgba(255,255,255,0.5)',
              color: on ? '#fff' : 'var(--ink)', transition: 'all .15s',
            }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, flex: '0 0 auto', display: 'grid', placeItems: 'center',
                background: on ? 'rgba(255,255,255,0.14)' : accent + '33' }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: accent, boxShadow: '0 0 8px ' + accent }} />
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em' }}>{s.label}</span>
                  {s.flagship && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: on ? '#fff' : 'var(--accent)', background: on ? 'rgba(255,255,255,0.16)' : 'var(--accent-soft)', padding: '1px 6px', borderRadius: 99 }}>Full</span>}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, lineHeight: 1.4, color: on ? 'rgba(255,255,255,0.7)' : 'var(--ink-faint)', textWrap: 'pretty' }}>{s.blurb}</span>
              </span>
              <span style={{ flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 99, background: on ? 'var(--accent)' : 'transparent', color: on ? '#fff' : 'var(--ink-ghost)' }}>
                <Icon name={on ? 'pause' : 'play'} size={13} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Learn (lesson library) ---------------- */
function LessonCard({ lesson, layout, completed, onOpen }) {
  const sys = window.SYS.SYSTEMS.find(s => s.id === lesson.system);
  const accent = sys ? 'var(--c-' + sys.cat + ')' : 'var(--accent)';
  const steps = sys ? sys.stages.length : 0;
  const lvlColor = LEVEL_COLOR[lesson.level] || 'var(--accent)';

  if (layout === 'list') {
    return (
      <button onClick={onOpen} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '10px 11px', borderRadius: 11, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--hair)', background: 'rgba(255,255,255,0.5)' }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, flex: '0 0 auto', display: 'grid', placeItems: 'center', background: accent + '33' }}>
          {completed ? <Icon name="checkCircle" size={16} style={{ color: '#3aa564' }} /> : <span style={{ width: 9, height: 9, borderRadius: 99, background: accent }} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lesson.title}</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{lesson.minutes} min · {steps} stages</span>
        </span>
        <Icon name="chevRight" size={15} style={{ color: 'var(--ink-ghost)', flex: '0 0 auto' }} />
      </button>
    );
  }
  return (
    <button onClick={onOpen} style={{ display: 'block', width: '100%', padding: '13px 14px 14px', borderRadius: 14, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--hair)', background: 'rgba(255,255,255,0.55)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <span className="eyebrow" style={{ color: accent, letterSpacing: '0.1em' }}>{lesson.kicker}</span>
        <span style={{ flex: 1 }} />
        {lesson.flagship && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 7px', borderRadius: 99 }}>Flagship</span>}
        {completed && <Icon name="checkCircle" size={16} style={{ color: '#3aa564' }} />}
      </div>
      <div style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: '-0.015em', color: 'var(--ink)', lineHeight: 1.18, marginBottom: 5, textWrap: 'pretty' }}>{lesson.title}</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink-soft)', marginBottom: 11, textWrap: 'pretty' }}>{lesson.subtitle}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: lvlColor, background: 'rgba(16,20,32,0.04)', padding: '3px 9px', borderRadius: 99 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: lvlColor }} />{lesson.level}
        </span>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={11} />{lesson.minutes} min</span>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>· {steps} stages</span>
      </div>
    </button>
  );
}

function LearnMode({ completedSet, onOpenLesson }) {
  const [layout, setLayout] = React.useState('cards');
  const LESSONS = window.SYS.LESSONS;
  const done = LESSONS.filter(l => completedSet.has(l.id)).length;
  return (
    <div style={{ padding: '0 12px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span className="eyebrow" style={{ flex: 1 }}>{done} of {LESSONS.length} completed</span>
        <Segmented style={{ width: 70 }} value={layout} onChange={setLayout}
          options={[{ value: 'cards', icon: 'grid', label: '' }, { value: 'list', icon: 'list', label: '' }]} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: layout === 'list' ? 7 : 10 }}>
        {LESSONS.map(l => (
          <LessonCard key={l.id} lesson={l} layout={layout} completed={completedSet.has(l.id)} onOpen={() => onOpenLesson(l.id)} />
        ))}
      </div>
    </div>
  );
}

function ControlPanel(props) {
  const { pos, setPos, collapsed, setCollapsed, mode, setMode } = props;
  const dragRef = React.useRef(null);
  const [layersOpen, setLayersOpen] = React.useState(false);
  const [viewsOpen, setViewsOpen] = React.useState(true);   // collapse presets to free space for results
  const layersShown = layersOpen || !!props.q;   // a search always reveals the matched tree
  // typing in search auto-collapses the cinematic views (results take the space);
  // clearing it reopens them. Manual toggling still works while a query is active.
  const hasSearch = !!props.search;
  React.useEffect(() => { setViewsOpen(!hasSearch); }, [hasSearch]);

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

  const mobile = props.mobile;
  // on mobile the controls live in the bottom sheet; when a structure is selected the
  // selection card takes that same spot, so we hide the controls behind it
  if (mobile && props.selectedId != null) return null;
  const containerStyle = mobile
    ? { position: 'absolute', left: 8, right: 8, bottom: 8, maxHeight: '44vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 20 }
    : { position: 'absolute', left: pos.x, top: pos.y, width: 326,
        height: collapsed ? undefined : 'min(760px, calc(100vh - 32px))', maxHeight: 'calc(100vh - 32px)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 20 };
  return (
    <div className="glass glass-top-hi pop" style={containerStyle}>
      {/* header (hidden on mobile - bottom sheet shows only the cinematic views) */}
      {!mobile && (
      <div onPointerDown={startDrag} className="noselect" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 12px 14px', cursor: 'grab' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--ink)', color: '#fff', flex: '0 0 auto' }}>
          <Icon name="brain" size={17} sw={1.6} />
        </div>
        <div style={{ flex: 1, lineHeight: 1.1, display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)' }}>Brain Atlas</div>
        </div>
        <Icon name="grip" size={16} style={{ color: 'var(--ink-ghost)' }} />
        <IconBtn name={collapsed ? 'chevDown' : 'chevUp'} title={collapsed ? 'Expand' : 'Collapse'} onClick={() => setCollapsed(!collapsed)} />
      </div>
      )}

      {!collapsed && (
        <React.Fragment>
          {/* mode tabs - Explore · Systems · Learn */}
          <div style={{ padding: mobile ? '12px 12px 10px' : '0 12px 12px' }}>
            <Segmented value={mode} onChange={setMode}
              options={[
                { value: 'explore', label: 'Explore', icon: 'compass' },
                { value: 'systems', label: 'Systems', icon: 'route' },
                { value: 'learn', label: 'Learn', icon: 'graduation' },
              ]} />
          </div>

          {(mode === 'systems' || mode === 'learn') && (
            <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
              <div className="scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {mode === 'systems' && <SystemsMode activeSystem={props.activeSystem} onStartSystem={props.onStartSystem} />}
                {mode === 'learn' && <LearnMode completedSet={props.completedSet} onOpenLesson={props.onOpenLesson} />}
              </div>
              <div className="panel-fade" />
            </div>
          )}

          {mode === 'explore' && (
          <React.Fragment>
          {/* search */}
          {!mobile && (
          <div style={{ padding: '0 12px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 11, background: 'var(--field)', border: '1px solid var(--hair)' }}>
              <Icon name="search" size={15} style={{ color: 'var(--ink-faint)', flex: '0 0 auto' }} />
              <input value={props.search} onChange={e => props.setSearch(e.target.value)} placeholder={`Search ${window.BRAIN.nodes.length} structures…`}
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font)', fontSize: 13, color: 'var(--ink)', minWidth: 0 }} />
              {props.search ? (
                <button onClick={() => props.setSearch('')} style={{ border: 'none', background: 'transparent', color: 'var(--ink-faint)', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><Icon name="x" size={14} /></button>
              ) : <kbd className="mono" style={{ fontSize: 9.5, color: 'var(--ink-ghost)', border: '1px solid var(--hair)', borderRadius: 5, padding: '1px 5px' }}>/</kbd>}
            </div>
            {props.search && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-faint)', flex: 1, paddingLeft: 2 }}>{props.matchCount} match{props.matchCount === 1 ? '' : 'es'}</div>
                <div style={{ width: 132 }}>
                  <Segmented value={props.searchSide} onChange={props.setSearchSide}
                    options={[{ value: 'both', label: 'L+R' }, { value: 'left', label: 'L' }, { value: 'right', label: 'R' }]} />
                </div>
              </div>
            )}
          </div>
          )}

          {/* hemisphere */}
          {!mobile && (
          <div style={{ padding: '0 12px 12px' }}>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Hemisphere</div>
            <Segmented value={props.hemisphere} onChange={props.setHemisphere}
              options={[{ value: 'left', label: 'Left' }, { value: 'both', label: 'Both' }, { value: 'right', label: 'Right' }]} />
          </div>
          )}

          {/* presets - collapsible on desktop so search results can take the space */}
          <div style={{ padding: mobile ? '12px 12px' : '0 12px 12px' }}>
            {mobile ? (
              <div className="eyebrow" style={{ marginBottom: 8 }}>Cinematic views</div>
            ) : (
              <button onClick={() => setViewsOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, marginBottom: viewsOpen ? 8 : 0 }}>
                <span className="eyebrow" style={{ flex: 1, textAlign: 'left' }}>Cinematic views</span>
                <Icon name={viewsOpen ? 'chevUp' : 'chevDown'} size={14} style={{ color: 'var(--ink-ghost)' }} />
              </button>
            )}
            {(mobile || viewsOpen) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {props.presets.map(p => {
                const on = props.activePreset === p.id;
                return (
                  <button key={p.id} onClick={() => props.onPreset(p.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 9, minWidth: 0,
                    border: '1px solid ' + (on ? 'transparent' : 'var(--hair)'), cursor: 'pointer', textAlign: 'left',
                    background: on ? 'var(--ink)' : 'rgba(255,255,255,0.5)', color: on ? '#fff' : 'var(--ink-soft)',
                    fontFamily: 'var(--font)', fontSize: 12, fontWeight: 600, transition: 'all .15s',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: p.color || 'var(--accent)', flex: '0 0 auto' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
                  </button>
                );
              })}
            </div>
            )}
          </div>

          {/* cortex opacity */}
          {!mobile && (
          <div style={{ padding: '0 14px 14px' }}>
            <Slider label="Cortex opacity" value={props.cortexOpacity} onChange={props.setCortexOpacity} color="var(--c-cortex)" />
          </div>
          )}

          {/* layers header - collapsed by default so presets stay the spotlight */}
          {!mobile && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 8px', gap: 8 }}>
            <button onClick={() => setLayersOpen(o => !o)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
              <Icon name="layers" size={13} style={{ color: 'var(--ink-faint)' }} />
              <span className="eyebrow">{layersShown ? 'Layers · build your view' : 'View all ' + props.totalCount + ' layers'}</span>
              <Icon name={layersShown ? 'chevUp' : 'chevDown'} size={14} style={{ color: 'var(--ink-ghost)' }} />
            </button>
            {layersShown && <button onClick={props.onShowAll} style={ghostBtn}>All</button>}
            {layersShown && <button onClick={props.onHideAll} style={ghostBtn}>None</button>}
          </div>
          )}

          {/* tree */}
          {!mobile && layersShown && (
            <div className="scroll" style={{ overflowY: 'auto', padding: '0 8px 8px', flex: 1, minHeight: 120 }}>
              <LayersTree {...props} />
            </div>
          )}

          {/* spacer so the footer sits at the bottom (matches Systems/Learn height) */}
          {!mobile && !layersShown && <div style={{ flex: 1, minHeight: 0 }} />}

          {/* footer */}
          {!mobile && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--hair-2)' }}>
            <button onClick={props.onReset} style={footBtn}><Icon name="reset" size={14} /> Reset view</button>
            {props.isolated
              ? <button onClick={props.onClearIsolate} style={{ ...footBtn, background: 'var(--accent)', color: '#fff', border: '1px solid transparent' }}><Icon name="isolate" size={14} /> Exit isolate</button>
              : <button onClick={props.onIsolateMatches} disabled={!props.canIsolate} style={{ ...footBtn, opacity: props.canIsolate ? 1 : 0.4 }}><Icon name="isolate" size={14} /> Isolate</button>}
          </div>
          )}
          </React.Fragment>
          )}
        </React.Fragment>
      )}
    </div>
  );
}

const ghostBtn = { border: '1px solid var(--hair)', background: 'transparent', color: 'var(--ink-faint)', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 7, cursor: 'pointer' };
const footBtn = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid var(--hair)', background: 'rgba(255,255,255,0.5)', color: 'var(--ink-soft)', fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 600, padding: '8px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' };

Object.assign(window, { ControlPanel, Slider });
