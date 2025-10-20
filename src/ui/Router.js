// ui/Router.js
// Minimal hash-based router with fade transitions and back-stack.
// Usage:
//   const router = Router.init({ rootEl, bus });
//   router.registerScreens({ TITLE, MAIN, SHOP, PROFILE, SETTINGS });
//   router.navigate('TITLE');
//
// Screens are small objects: { mount(rootEl), unmount() }.

const Router = (() => {
  const STATE = {
    current: null,
    stack: [],
    screens: {},
    rootEl: null,
    bus: null,
  };

  // Treat SHOP/PROFILE/SETTINGS as part of the "main" visual theme
  function setBodyScreen(name) {
    try {
      const visual =
        name === 'SHOP' ||
        name === 'PROFILE' ||
        name === 'SETTINGS' ||
        name === 'VAULT' ||
        name === 'JUKEBOX'
          ? 'main'
          : (name || '').toLowerCase();
      document.body.dataset.screen = visual;
    } catch {}
  }

  function applyFade(next, cb) {
    const el = STATE.rootEl;
    if (!el) return cb();
    el.classList.add('fade-out');
    setTimeout(() => {
      cb();
      el.classList.remove('fade-out');
      el.classList.add('fade-in');
      // remove after animation
      setTimeout(() => el.classList.remove('fade-in'), 200);
    }, 140); // short out, then in
  }

  function mountScreen(name) {
    setBodyScreen(name);
    const el = STATE.rootEl;
    const scr = STATE.screens[name];
    if (!el) return;
    // GAME is special: hide overlay container entirely
    if (name === 'GAME') {
      el.classList.add('is-hidden');
      el.innerHTML = ''; // nothing mounted
      return;
    }
    el.classList.remove('is-hidden');
    el.innerHTML = '';
    if (scr && typeof scr.mount === 'function') scr.mount(el);
  }

  function unmountScreen(name) {
    const scr = STATE.screens[name];
    if (scr && typeof scr.unmount === 'function') {
      try {
        scr.unmount();
      } catch {}
    }
  }

  function setHashFor(state) {
    try {
      const map = {
        TITLE: '#/title',
        MAIN: '#/main',
        GAME: '#/game',
        SHOP: '#/shop',
        PROFILE: '#/profile',
        SETTINGS: '#/settings',
        VAULT: '#/vault',
        JUKEBOX: '#/jukebox',
      };
      if (map[state]) location.hash = map[state];
    } catch {}
  }

  function parseHash() {
    const h = (location.hash || '').toLowerCase();
    if (h.startsWith('#/main')) return 'MAIN';
    if (h.startsWith('#/game')) return 'GAME';
    if (h.startsWith('#/shop')) return 'SHOP';
    if (h.startsWith('#/profile')) return 'PROFILE';
    if (h.startsWith('#/settings')) return 'SETTINGS';
    if (h.startsWith('#/vault')) return 'VAULT';
    if (h.startsWith('#/jukebox')) return 'JUKEBOX';
    return 'TITLE';
  }

  const api = {
    init({ rootEl, bus }) {
      STATE.rootEl = rootEl;
      STATE.bus = bus || { emit: () => {} };
      // hash popstate/back handling
      window.addEventListener('hashchange', () => {
        const target = parseHash();
        if (target !== STATE.current) {
          // don't push to stack on hashchange (user nav); just go there
          const from = STATE.current;
          setBodyScreen(target);
          unmountScreen(from);
          STATE.current = target;
          mountScreen(target);
          STATE.bus.emit?.('router:navigate', { to: target, from });
        }
      });
      return this;
    },
    registerScreens(map) {
      STATE.screens = { ...map };
    },
    navigate(to) {
      const from = STATE.current;
      if (from === to) return;
      // First-time mount (no fade, no stack)
      if (!from) {
        STATE.current = to;
        setBodyScreen(to);
        mountScreen(to);
        setHashFor(to);
        STATE.bus.emit?.('router:navigate', { to, from });
        return;
      }
      // push from→stack for normal transitions
      if (from) STATE.stack.push(from);
      STATE.bus.emit?.('router:before', { to, from });
      applyFade(to, () => {
        unmountScreen(from);
        STATE.current = to;
        setBodyScreen(to);
        mountScreen(to);
        setHashFor(to);
        STATE.bus.emit?.('router:navigate', { to, from });
      });
    },
    back() {
      if (!STATE.stack.length) {
        if (STATE.current !== 'MAIN') this.navigate('MAIN');
        return;
      }
      const from = STATE.current;
      const to = STATE.stack.pop() || 'MAIN';
      applyFade(to, () => {
        unmountScreen(from);
        STATE.current = to;
        setBodyScreen(to);
        mountScreen(to);
        setBodyScreen(to);
        setHashFor(to);
        STATE.bus.emit?.('router:back', { from, to });
      });
    },
    getState() {
      return STATE.current;
    },
  };

  return api;
})();

export default Router;
