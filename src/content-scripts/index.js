import MicroModal from 'micromodal';
import EventRecorder from './EventRecorder';
import VoiceHandler from './VoiceHandler';
import $ from 'jquery';
import Selection from '@simonwep/selection-js';

// import tippy from 'tippy.js';
// import 'tippy.js/dist/tippy.css';
// window.tippy = tippy

window.$ = $;
window.Selection = Selection;
window.eventRecorder = new EventRecorder();
window.eventRecorder.boot();
window.nightmareVoiceHandler = new VoiceHandler();
window.nightmareVoiceHandler.start();

// Modal logic
document.body.innerHTML =
    document.body.innerHTML +
    `
  <div class="modal micromodal-slide" id="result-modal" aria-hidden="true">
    <div class="modal__overlay" tabindex="-1" data-micromodal-close>
      <div class="modal__container" role="dialog" aria-modal="true" aria-labelledby="result-modal-title">
        <header class="modal__header">
          <h2 class="modal__title" id="result-modal-title">
            Nightmare Result
          </h2>
          <button class="modal__close" aria-label="Close modal" data-micromodal-close></button>
        </header>
        <main class="modal__content" id="result-modal-content">
        </main>
        <footer class="modal__footer">
          <button class="modal__btn" data-micromodal-close aria-label="Close this dialog window">Close</button>
        </footer>
      </div>
    </div>
  </div>
`;
MicroModal.init();
