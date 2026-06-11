/* Brain Project - lesson player chrome: intro, quiz (incl. "find this
   structure" on the real 3D brain) and completion. Plays over the stage. */

function lessonSys(lesson) { return window.SYS.SYSTEMS.find(s => s.id === lesson.system); }

/* ---------------- Lesson intro ---------------- */
function LessonIntro({ lesson, onBegin, onClose, mobile }) {
  const sys = lessonSys(lesson);
  const accent = sys ? 'var(--c-' + sys.cat + ')' : 'var(--accent)';
  const steps = sys ? sys.stages.length : 0;
  const cardStyle = mobile
    ? { position: 'absolute', left: 8, right: 8, bottom: 8, zIndex: 42, padding: '18px 18px 20px' }
    : { position: 'absolute', left: '50%', bottom: 22, transform: 'translateX(-50%)', width: 'min(560px, calc(100vw - 48px))', zIndex: 42, padding: '20px 22px 22px' };
  return (
    <div className="glass-dark fade" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, flex: '0 0 auto', display: 'grid', placeItems: 'center', background: accent + '33' }}>
          <Icon name="graduation" size={16} style={{ color: accent }} />
        </span>
        <span className="eyebrow eyebrow-light" style={{ flex: 1 }}>{lesson.kicker}</span>
        <IconBtn name="x" title="Close" onClick={onClose} dim={28} size={15} dark />
      </div>
      <h2 style={{ margin: '0 0 7px', fontSize: mobile ? 21 : 25, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--on-stage)', lineHeight: 1.12, textWrap: 'pretty' }}>{lesson.title}</h2>
      <p style={{ margin: '0 0 16px', fontSize: 14.5, lineHeight: 1.55, color: 'var(--on-stage-soft)', textWrap: 'pretty' }}>{lesson.intro}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--on-stage)' }}><Icon name="layers" size={14} style={{ color: 'var(--on-stage-soft)' }} />{steps} stages</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--on-stage)' }}><Icon name="clock" size={14} style={{ color: 'var(--on-stage-soft)' }} />{lesson.minutes} min</span>
        {lesson.quiz && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--on-stage)' }}><Icon name="helpCircle" size={14} style={{ color: 'var(--on-stage-soft)' }} />{lesson.quiz.length}-question check</span>}
      </div>
      <button onClick={onBegin} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>
        <Icon name="play" size={16} /> Begin lesson
      </button>
    </div>
  );
}

/* ---------------- Lesson quiz ---------------- */
function LessonQuiz({ lesson, qIdx, setQIdx, answers, setAnswers, onFinish, pickFromStage, mobile }) {
  const q = lesson.quiz[qIdx];
  const given = answers[qIdx];
  const answered = given !== undefined;
  const correct = given === q.answer;

  const answer = (val) => { if (answered) return; setAnswers({ ...answers, [qIdx]: val }); };
  // expose a stage-pick handler for "find" questions so a click on the brain answers
  React.useEffect(() => { pickFromStage.current = (q.type === 'find' && !answered) ? answer : null; return () => { pickFromStage.current = null; }; }, [qIdx, answered]);

  const last = qIdx >= lesson.quiz.length - 1;
  const cardStyle = mobile
    ? { position: 'absolute', left: 8, right: 8, bottom: 8, zIndex: 42, padding: '16px 16px 18px' }
    : { position: 'absolute', left: '50%', bottom: 22, transform: 'translateX(-50%)', width: 'min(620px, calc(100vw - 48px))', zIndex: 42, padding: '18px 20px 20px' };
  return (
    <div className="glass-dark fade" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Icon name="helpCircle" size={16} style={{ color: 'var(--accent)' }} />
        <span className="eyebrow eyebrow-light" style={{ flex: 1 }}>Check understanding · {qIdx + 1} of {lesson.quiz.length}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--on-stage-soft)' }}>{lesson.title}</span>
      </div>
      <h3 style={{ margin: '0 0 4px', fontSize: mobile ? 16 : 18, fontWeight: 800, letterSpacing: '-0.015em', color: 'var(--on-stage)', lineHeight: 1.25, textWrap: 'pretty' }}>{q.q}</h3>
      {q.type === 'find' && !answered && (
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="target" size={13} /> Click the glowing structure on the brain, or choose below.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {q.options.map((opt, i) => {
          const val = q.type === 'mc' ? i : opt;
          const isAnswer = q.type === 'mc' ? i === q.answer : opt === q.answer;
          const isGiven = given === val;
          let bg = 'rgba(255,255,255,0.05)', bd = 'rgba(255,255,255,0.14)', col = 'var(--on-stage)';
          if (answered) {
            if (isAnswer) { bg = 'rgba(95,208,138,0.16)'; bd = '#5fd08a'; col = '#bdeccd'; }
            else if (isGiven) { bg = 'rgba(240,80,104,0.14)'; bd = '#f0788c'; col = '#f6c2cb'; }
            else { col = 'var(--on-stage-soft)'; }
          }
          const label = q.type === 'find' ? ((window.SYS.NODES[opt] && window.SYS.NODES[opt].label) || opt) : opt;
          return (
            <button key={i} onClick={() => answer(val)} disabled={answered} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 11, textAlign: 'left',
              border: '1px solid ' + bd, background: bg, color: col, cursor: answered ? 'default' : 'pointer',
              fontFamily: 'var(--font)', fontSize: 13.5, fontWeight: 600, transition: 'all .15s',
            }}>
              <span style={{ flex: 1 }}>{label}</span>
              {answered && isAnswer && <Icon name="check" size={16} style={{ color: '#5fd08a' }} />}
              {answered && isGiven && !isAnswer && <Icon name="x" size={16} style={{ color: '#f0788c' }} />}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="fade" style={{ marginTop: 13, padding: '11px 13px', borderRadius: 11, background: correct ? 'rgba(95,208,138,0.10)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (correct ? 'rgba(95,208,138,0.3)' : 'rgba(255,255,255,0.12)') }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: correct ? '#7ddca0' : 'var(--on-stage)', marginBottom: 4 }}>{correct ? 'Correct' : 'Not quite'}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--on-stage-soft)', textWrap: 'pretty' }}>{q.explain}</div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={() => last ? onFinish() : setQIdx(qIdx + 1)} disabled={!answered} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 11, border: 'none',
          background: answered ? 'var(--accent)' : 'rgba(255,255,255,0.08)', color: answered ? '#fff' : 'var(--on-stage-soft)',
          fontFamily: 'var(--font)', fontSize: 13.5, fontWeight: 700, cursor: answered ? 'pointer' : 'default',
        }}>{last ? 'Finish lesson' : 'Next question'} <Icon name="arrowRight" size={15} /></button>
      </div>
    </div>
  );
}

/* ---------------- Lesson completion ---------------- */
function LessonComplete({ lesson, score, total, onReplay, onClose, onShare, mobile }) {
  const cardStyle = mobile
    ? { position: 'absolute', left: 8, right: 8, bottom: 8, zIndex: 42, padding: '20px 18px', textAlign: 'center' }
    : { position: 'absolute', left: '50%', bottom: 22, transform: 'translateX(-50%)', width: 'min(540px, calc(100vw - 48px))', zIndex: 42, padding: '22px 22px 22px', textAlign: 'center' };
  return (
    <div className="glass-dark fade" style={cardStyle}>
      <div style={{ width: 56, height: 56, borderRadius: 99, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'rgba(95,208,138,0.16)', border: '1px solid rgba(95,208,138,0.4)' }}>
        <Icon name="checkCircle" size={30} style={{ color: '#5fd08a' }} />
      </div>
      <div className="eyebrow eyebrow-light" style={{ marginBottom: 8 }}>Lesson complete</div>
      <h2 style={{ margin: '0 0 6px', fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--on-stage)', lineHeight: 1.15 }}>{lesson.title}</h2>
      {lesson.quiz && <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--on-stage-soft)' }}>You scored <b style={{ color: 'var(--on-stage)' }}>{score} / {total}</b> on the check.</p>}
      {!lesson.quiz && <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--on-stage-soft)' }}>Nicely done, that pathway is yours now.</p>}
      <div style={{ display: 'flex', gap: 9, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={onShare} style={completeBtn(false)}><Icon name="share" size={15} /> Share</button>
        <button onClick={onReplay} style={completeBtn(false)}><Icon name="rotate" size={15} /> Replay</button>
        <button onClick={onClose} style={completeBtn(true)}><Icon name="book" size={15} /> More lessons</button>
      </div>
    </div>
  );
}

function completeBtn(primary) {
  return {
    display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 11,
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.16)',
    background: primary ? 'var(--accent)' : 'rgba(255,255,255,0.07)', color: primary ? '#fff' : 'var(--on-stage)',
    fontFamily: 'var(--font)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
  };
}

Object.assign(window, { LessonIntro, LessonQuiz, LessonComplete });
