/* Brain Atlas — vertical depth scrubber rail (peel inward) */

function DepthRail({ layers, stop, setStop, expanded, setExpanded }) {
  const N = layers.length;
  const trackRef = React.useRef(null);
  const setFromY = (clientY) => {
    const r = trackRef.current.getBoundingClientRect();
    let t = (clientY - r.top) / r.height; t = Math.max(0, Math.min(1, t));
    setStop(Math.round(t * (N - 1)));
  };
  const down = (e) => { e.preventDefault(); setFromY(e.clientY); const mv = (ev) => setFromY(ev.clientY); const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); };

  const W = expanded ? 214 : 60;

  return (
    <div className="glass" onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}
      style={{
        position: 'absolute', right: 16, top: '58%', transform: 'translateY(-50%)', width: W,
        padding: '10px 10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        zIndex: 18, transition: 'width .22s cubic-bezier(.2,.9,.3,1)', overflow: 'hidden',
      }}>
      {/* up / shallower */}
      <button onClick={() => setStop(Math.max(0, stop - 1))} title="Reveal outer layer" style={stepBtn}>
        <Icon name="chevUp" size={16} />
      </button>

      <div style={{ display: 'flex', gap: 9, flex: 1, padding: '6px 2px' }}>
        {/* the track */}
        <div ref={trackRef} onPointerDown={down} style={{ position: 'relative', width: 26, cursor: 'pointer', flex: '0 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 0' }}>
          {/* spine */}
          <div style={{ position: 'absolute', left: '50%', top: 6, bottom: 6, width: 3, transform: 'translateX(-50%)', borderRadius: 99, background: 'rgba(16,20,32,0.10)' }} />
          {/* peeled (above cut) */}
          <div style={{ position: 'absolute', left: '50%', top: 6, height: 'calc(' + (stop / (N - 1)) * 100 + '% - 12px)', width: 3, transform: 'translateX(-50%)', borderRadius: 99, background: 'repeating-linear-gradient(180deg, rgba(16,20,32,0.18) 0 3px, transparent 3px 7px)' }} />
          {layers.map((l, i) => {
            const active = i >= stop;
            const cut = i === stop;
            return (
              <div key={l.cat} style={{ position: 'relative', display: 'grid', placeItems: 'center', zIndex: 1 }}>
                <span style={{
                  width: cut ? 16 : 9, height: cut ? 16 : 9, borderRadius: 99, transition: 'all .18s',
                  background: active ? l.color : 'transparent',
                  border: active ? 'none' : '1.5px solid rgba(16,20,32,0.18)',
                  boxShadow: cut ? '0 0 0 4px rgba(255,255,255,0.85), 0 1px 4px rgba(10,14,28,0.3)' : 'none',
                  opacity: active ? 1 : 0.5,
                }} />
              </div>
            );
          })}
        </div>

        {/* labels (expanded) */}
        {expanded && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '2px 0' }}>
            {layers.map((l, i) => {
              const active = i >= stop;
              return (
                <button key={l.cat} onClick={() => setStop(i)} style={{
                  display: 'flex', alignItems: 'center', height: 18, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left',
                  fontFamily: 'var(--font)', fontSize: 11, fontWeight: i === stop ? 700 : 500,
                  color: active ? (i === stop ? 'var(--ink)' : 'var(--ink-soft)') : 'var(--ink-ghost)',
                  textDecoration: active ? 'none' : 'line-through', textDecorationColor: 'var(--hair)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{l.short}</button>
              );
            })}
          </div>
        )}
      </div>

      {/* down / deeper */}
      <button onClick={() => setStop(Math.min(N - 1, stop + 1))} title="Peel to deeper layer" style={stepBtn}>
        <Icon name="chevDown" size={16} />
      </button>

      {expanded && (
        <div className="eyebrow" style={{ textAlign: 'center', marginTop: 4, fontSize: 9 }}>Peel depth</div>
      )}
    </div>
  );
}

const stepBtn = { width: '100%', height: 28, display: 'grid', placeItems: 'center', border: 'none', background: 'rgba(16,20,32,0.045)', borderRadius: 8, color: 'var(--ink-soft)', cursor: 'pointer', flex: '0 0 auto' };

Object.assign(window, { DepthRail });
