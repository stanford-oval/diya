import EventRecorder from './EventRecorder'
import VoiceHandler from './VoiceHandler'
window.eventRecorder = new EventRecorder()
window.eventRecorder.boot()
window.nightmareVoiceHandler = new VoiceHandler()
window.nightmareVoiceHandler.start()
