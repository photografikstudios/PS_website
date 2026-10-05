// Architecture project photos open in place. Films retain their inline players.
import { createLightbox } from './lightbox.js';

const root = document.querySelector('[data-project-lightbox]');
if (root) {
  const items = JSON.parse(root.querySelector('[data-gallery-items]').textContent);
  const viewer = createLightbox(root.querySelector('dialog.lightbox'), items, { where: 'architecture_project' });
  const order = items.map((_, i) => i);
  root.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-project-photo]');
    if (button && root.contains(button)) viewer.open(Number(button.dataset.projectPhoto), order, button);
  });
}
