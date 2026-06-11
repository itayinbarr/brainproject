/* ============================================================
   Brain Project - Firebase / Google Analytics with Consent Mode v2.
   Analytics initialises immediately but with consent DEFAULTED TO
   DENIED, so a visitor who declines still produces anonymous,
   cookieless pings (rough enter counts) - no cookies/identifiers
   are stored. Accepting upgrades analytics_storage to "granted"
   (full analytics with cookies + duration of stay).
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

  const stored = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  let setConsentFn = null;
  let started = false;

  async function start() {
    if (started) return;
    started = true;
    try {
      const [{ initializeApp }, am] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-analytics.js`),
      ]);
      const { getAnalytics, isSupported, logEvent, setConsent } = am;
      if (!(await isSupported())) return;
      setConsentFn = setConsent;

      const app = initializeApp(firebaseConfig);
      // Consent Mode v2 defaults - everything denied until the visitor grants.
      // analytics_storage denied => cookieless pings; granted => full analytics.
      setConsent({
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: stored() === 'granted' ? 'granted' : 'denied',
      });
      const analytics = getAnalytics(app);     // auto: page_view, session_start, engagement
      window.BrainAnalytics.analytics = analytics;
      window.BrainAnalytics.log = (name, params) => { try { logEvent(analytics, name, params || {}); } catch (e) {} };
    } catch (e) {
      console.warn('[analytics] disabled:', e && e.message);
    }
  }

  function applyConsent(granted) {
    if (setConsentFn) { try { setConsentFn({ analytics_storage: granted ? 'granted' : 'denied' }); } catch (e) {} }
  }

  function grant() { try { localStorage.setItem(KEY, 'granted'); } catch (e) {} applyConsent(true); }
  function deny() { try { localStorage.setItem(KEY, 'denied'); } catch (e) {} applyConsent(false); }

  window.BrainAnalytics = { consent: stored, grant, deny, log: () => {} };

  // Always start so Consent Mode can send cookieless pings; cookies only on grant.
  start();
})();
