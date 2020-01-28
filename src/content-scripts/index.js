import EventRecorder from './EventRecorder'
import VoiceHandler from './VoiceHandler'
import $ from "jquery";

window.$ = $
window.eventRecorder = new EventRecorder()
window.eventRecorder.boot()
window.nightmareVoiceHandler = new VoiceHandler()
window.nightmareVoiceHandler.start()
