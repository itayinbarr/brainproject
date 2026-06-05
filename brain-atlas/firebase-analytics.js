/* ============================================================
   Brain Atlas — Firebase / Google Analytics, gated on consent.
   No analytics SDK loads and NO cookies are set until the visitor
   explicitly accepts (see the consent banner in app.jsx).
   getAnalytics() auto-logs page_view + session_start + engagement
   time, which gives the enter-counts and duration-of-stay metrics.
   ============================================================ */
(function () {
  const KEY = 'ba_cookie_consent';            // 'granted' | 'denied'
  const FB_VER = '10.12.2';

  const firebaseConfig = {
    apiKey: "AIzaSyDLrGZu4RdOUcNK8FGlCCruKbG4sBBH828",
    authDomain: "brain-atlas-7f5fe.firebaseapp.com",
    projectId: "brain-atlas-7f5fe",
    storageBucket: "brain-atlas-7f5fe.firebasestorage.app",
    messagingSenderId: "692869896348",
    appId: "1:692869896348:web:59cb830f051eb695623559",
    measurementId: "G-HM19NK6Z6V"
  };

  let started = false;
  async function init() {
    if (started) return;
    started = true;
    try {
      const [{ initializeApp }, analyticsMod] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-analytics.js`),
      ]);
      const { getAnalytics, isSupported, logEvent } = analyticsMod;
      if (!(await isSupported())) return;       // e.g. cookies disabled / unsupported env
      const app = initializeApp(firebaseConfig);
      const analytics = getAnalytics(app);      // auto: page_view, session_start, engagement
      window.BrainAnalytics.analytics = analytics;
      window.BrainAnalytics.log = (name, params) => { try { logEvent(analytics, name, params || {}); } catch (e) {} };
    } catch (e) {
      console.warn('[analytics] disabled:', e && e.message);
    }
  }

  const consent = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  function grant() { try { localStorage.setItem(KEY, 'granted'); } catch (e) {} init(); }
  function deny() { try { localStorage.setItem(KEY, 'denied'); } catch (e) {} }

  window.BrainAnalytics = { consent, grant, deny, log: () => {} };

  // returning visitor who already accepted -> start straight away
  if (consent() === 'granted') init();
})();
