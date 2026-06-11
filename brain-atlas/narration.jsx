/* Brain Project - cinematic narration card + stepper (Systems & Learn).
   Docked bottom-centre over the real 3D specimen. The structures named in
   each stage glow on the actual brain; the chips select the true mesh. */

function sysAccent(sys) { return 'var(--c-' + (sys.cat || 'cortex') + ')'; }

/* lets the cinematic card be dragged anywhere by its header.
   pos === null keeps the default docked position; once dragged we pin to px. */
function useDragCard(disabled) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState(null);
  const onPointerDown = (e) => {
    if (disabled) return;
    if (e.target.closest('button') || e.target.closest('input')) return;
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, ox = r.left, oy = r.top, w = r.width, h = r.height;
    setPos({ x: ox, y: oy });
    const mv = (ev) => {
      const nx = Math.max(8, Math.min(window.innerWidth - w - 8, ox + ev.clientX - sx));
      const ny = Math.max(8, Math.min(window.innerHeight - 44, oy + ev.clientY - sy));
      setPos({ x: nx, y: ny });
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  // once moved, pin to fixed px (overrides the centred / docked defaults)
  const override = pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto', transform: 'none' } : null;
  return { ref, override, onPointerDown, dragging: !!pos };
}

function StageChips({ stage, onSelectNode }) {
  const NODES = window.SYS.NODES;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
      {stage.nodes.map(k => {
        const n = NODES[k]; if (!n) return null;
        const id = window.SYS.repId(k);
        const color = 'var(--c-' + n.cat + ')';
        return (
          <button key={k} onClick={() => id != null && onSelectNode && onSelectNode(id)} title={id != null ? 'Inspect ' + n.label : n.label + ' (no individual mesh in this atlas)'} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 8,
            cursor: id != null ? 'pointer' : 'default', opacity: id != null ? 1 : 0.6,
            border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: 'var(--on-stage)',
            fontFamily: 'var(--font)', fontSize: 11.5, fontWeight: 600,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: color, boxShadow: '0 0 6px ' + color }} />
            {n.label}
          </button>
        );
      })}
    </div>
  );
}

/* dot-line that doubles as a draggable scrubber */
function Stepper({ count, idx, setIdx }) {
  const ref = React.useRef(null);
  const scrub = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    let t = (clientX - r.left) / r.width; t = Math.max(0, Math.min(1, t));
    setIdx(Math.round(t * (count - 1)));
  };
  const down = (e) => { e.preventDefault(); scrub(e.clientX); const mv = (ev) => scrub(ev.clientX); const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); };
  const pct = count > 1 ? (idx / (count - 1)) * 100 : 0;
  return (
    <div ref={ref} onPointerDown={down} style={{ position: 'relative', flex: 1, height: 22, display: 'flex', alignItems: 'center', cursor: 'pointer', minWidth: 80 }}>
      <div style={{ position: 'absolute', left: 4, right: 4, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.16)' }} />
      <div style={{ position: 'absolute', left: 4, width: 'calc(' + pct + '% - 8px)', maxWidth: 'calc(100% - 8px)', height: 4, borderRadius: 99, background: 'var(--accent)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
        {Array.from({ length: count }).map((_, i) => {
          const done = i <= idx;
          return <button key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }} style={{
            width: i === idx ? 11 : 8, height: i === idx ? 11 : 8, borderRadius: 99, padding: 0, border: 'none', cursor: 'pointer',
            background: done ? 'var(--accent)' : 'rgba(255,255,255,0.30)', boxShadow: i === idx ? '0 0 0 3px var(--accent-soft)' : 'none',
            transition: 'all .15s',
          }} />;
        })}
      </div>
    </div>
  );
}

function ControlBar({ count, idx, setIdx, playing, setPlaying, isLesson, onFinish }) {
  const atEnd = idx >= count - 1;
  const rbtn = (name, onClick, disabled, primary) => (
    <button onClick={onClick} disabled={disabled} title={name} style={{
      width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 10, flex: '0 0 auto',
      border: '1px solid ' + (primary ? 'transparent' : 'rgba(255,255,255,0.16)'),
      background: primary ? 'var(--accent)' : 'rgba(255,255,255,0.07)', color: primary ? '#fff' : 'var(--on-stage)',
      opacity: disabled ? 0.32 : 1, cursor: disabled ? 'default' : 'pointer', transition: 'all .14s',
    }}><Icon name={name} size={16} /></button>
  );
  const next = () => { if (atEnd) { if (isLesson && onFinish) onFinish(); } else setIdx(idx + 1); };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
      {rbtn('skipBack', () => setIdx(0), idx === 0)}
      {rbtn('chevLeft', () => setIdx(Math.max(0, idx - 1)), idx === 0)}
      {rbtn(playing ? 'pause' : 'play', () => setPlaying(p => !p), false, true)}
      <Stepper count={count} idx={idx} setIdx={setIdx} />
      <span className="mono" style={{ fontSize: 11.5, color: 'var(--on-stage-soft)', flex: '0 0 auto', minWidth: 44, textAlign: 'right' }}>
        {String(idx + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
      </span>
      {isLesson && atEnd
        ? <button onClick={next} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, cursor: 'pointer', flex: '0 0 auto' }}>Check understanding <Icon name="arrowRight" size={15} /></button>
        : rbtn('chevRight', next, atEnd && !isLesson)}
    </div>
  );
}

function NarrationCard(props) {
  const { sys, idx, setIdx, playing, setPlaying, onClose, onSelectNode, isLesson, onFinish, lessonTitle, mobile } = props;
  const stage = sys.stages[idx];
  const count = sys.stages.length;
  const accent = sysAccent(sys);
  const drag = useDragCard(mobile);

  // autoplay
  React.useEffect(() => {
    if (!playing) return;
    if (idx >= count - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setIdx(idx + 1), 5200);
    return () => clearTimeout(t);
  }, [playing, idx, count]);

  // arrow-key stepping
  React.useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') { setIdx(Math.min(count - 1, idx + 1)); }
      else if (e.key === 'ArrowLeft') { setIdx(Math.max(0, idx - 1)); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [idx, count]);

  const header = (
    <div className="noselect" onPointerDown={drag.onPointerDown}
      style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: mobile ? 'default' : 'grab' }}>
      <span style={{ width: 9, height: 9, borderRadius: 99, background: accent, boxShadow: '0 0 8px ' + accent, flex: '0 0 auto' }} />
      <span className="eyebrow eyebrow-light" style={{ flex: 1 }}>{isLesson ? 'Lesson · ' + (lessonTitle || sys.label) : 'System · ' + sys.label}</span>
      {!mobile && <Icon name="grip" size={15} style={{ color: 'var(--on-stage-soft)' }} />}
      <IconBtn name="x" title="Close" onClick={onClose} dim={28} size={15} dark />
    </div>
  );

  const cardStyle = mobile
    ? { position: 'absolute', left: 8, right: 8, bottom: 8, zIndex: 40, padding: '14px 15px 16px' }
    : { position: 'absolute', left: '50%', bottom: 22, transform: 'translateX(-50%)', width: 'min(660px, calc(100vw - 48px))', zIndex: 40, padding: '16px 20px 18px', ...(drag.override || {}) };

  return (
    <div ref={drag.ref} className={'glass-dark' + (drag.dragging ? '' : ' fade')} style={cardStyle}>
      {header}
      <div key={idx}>
        <h3 style={{ margin: '0 0 8px', fontSize: mobile ? 17 : 20, fontWeight: 800, letterSpacing: '-0.018em', color: 'var(--on-stage)', lineHeight: 1.16, textWrap: 'pretty' }}>{stage.title}</h3>
        <p style={{ margin: 0, fontSize: mobile ? 13 : 14, lineHeight: 1.58, color: 'var(--on-stage-soft)', textWrap: 'pretty' }}>{stage.body}</p>
        {!mobile && <StageChips stage={stage} onSelectNode={onSelectNode} />}
      </div>
      <ControlBar count={count} idx={idx} setIdx={setIdx} playing={playing} setPlaying={setPlaying} isLesson={isLesson} onFinish={onFinish} />
    </div>
  );
}

Object.assign(window, { NarrationCard });
