import { getAssetQuery } from './assets.js';

const q = getAssetQuery();

function loadStylesheet(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${href}${q}`;
  document.head.appendChild(link);
}

loadStylesheet('css/style.css');
loadStylesheet('css/mobile.css');

const audio = document.createElement('script');
audio.src = `js/audio.js${q}`;
document.head.appendChild(audio);

await import(`./main.js${q}`);
