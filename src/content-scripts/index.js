import EventRecorder from './EventRecorder'
import VoiceHandler from './VoiceHandler'
import $ from "jquery";
import Selection from "@simonwep/selection-js";

// import tippy from 'tippy.js';
// import 'tippy.js/dist/tippy.css';
// window.tippy = tippy

window.$ = $
window.Selection = Selection
window.eventRecorder = new EventRecorder()
window.eventRecorder.boot()
window.nightmareVoiceHandler = new VoiceHandler()
window.nightmareVoiceHandler.start()
