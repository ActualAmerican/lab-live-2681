// src/ui/AppRouter.js
import Router from './Router.js';
import TitleScreen from './TitleScreen.js';
import MainMenu from './MainMenu.js';
import Shop from './Shop.js';
import Profile from './Profile.js';
import Settings from './Settings.js';
import Vault from './Vault.js';
import Jukebox from './Jukebox.js';

/**
 * Initialize the UI router and register screens.
 * Returns the Router instance. Does NOT start/stop gameplay; that remains
 * the responsibility of the caller (main.js) via bus 'router:navigate' handlers.
 *
 * @param {{ bus: any, rootElId?: string }} opts
 */
export default async function initAppRouter({ bus, rootElId = 'router-root' } = {}) {
  const root = document.getElementById(rootElId);
  const r = Router.init({ rootEl: root, bus });

  const title = new TitleScreen({ onContinue: () => r.navigate('MAIN') });
  const main = new MainMenu({
    onPlay: () => r.navigate('GAME'),
    onShop: () => r.navigate('SHOP'),
    onProfile: () => r.navigate('PROFILE'),
    onSettings: () => r.navigate('SETTINGS'),
    onVault: () => r.navigate('VAULT'),
    onJukebox: () => r.navigate('JUKEBOX'),
  });

  // Shop is an async factory that returns { mount, unmount }
  const shop = await Shop({ onBack: () => r.back() });
  const profile = new Profile({ onBack: () => r.back() });
  const settings = new Settings({ onBack: () => r.back() });
  const vault = new Vault({ onBack: () => r.back() });
  const jukebox = new Jukebox({ onBack: () => r.back() });

  r.registerScreens({
    TITLE: title,
    MAIN: main,
    SHOP: shop,
    PROFILE: profile,
    SETTINGS: settings,
    VAULT: vault,
    JUKEBOX: jukebox,
    GAME: {
      // GAME uses canvas; Router hides the overlay container for this route
      mount() {},
      unmount() {},
    },
  });

  // Choose initial route based on hash
  const startHash = (location.hash || '').toLowerCase();
  const initial = startHash.startsWith('#/main')
    ? 'MAIN'
    : startHash.startsWith('#/game')
    ? 'GAME'
    : 'TITLE';

  r.navigate(initial);
  return r;
}
