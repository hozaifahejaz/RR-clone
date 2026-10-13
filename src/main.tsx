import { render } from 'preact';
import '@fontsource/lilita-one/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './ui/style.css';
import { World } from './render/world';
import { App } from './ui/App';
import { loadProfile } from './meta/save';
import { renderIcons } from './ui/icons';
import { registerSW } from 'virtual:pwa-register';

async function boot() {
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const overlay = document.getElementById('overlay') as HTMLElement;
  const root = document.getElementById('root') as HTMLElement;
  const profile = await loadProfile();
  renderIcons();
  const world = new World(canvas, profile.settings.quality);
  render(<App world={world} overlay={overlay} initial={profile} />, root);
  document.getElementById('loading')?.remove();
  try {
    registerSW({ immediate: true });
  } catch {
    /* no service worker in dev */
  }
}

void boot();
