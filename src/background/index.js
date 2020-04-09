// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 2 -*-

import axios from 'axios'
import pptrActions from '../code-generator/pptr-actions'
import ctrl from '../models/extension-control-messages'
import actions from '../models/extension-ui-actions'

const SERVER_URL = 'http://127.0.0.1:3000';

class RecordingController {
  constructor () {
    this._sessionToken = null

    this._boundedMessageHandler = null
    this._boundedNavigationHandler = null
    this._boundedWaitHandler = null
    this._boundedSelectStartHandler = null
    this._boundedSelectStoptHandler = null
    this._boundedMenuHandler = null
    this._boundedKeyCommandHandler = null
    this._badgeState = ''
    this._isPaused = false

    this._currentUrl = false
    this._hasViewPort = false

    this._menuId = 'PUPPETEER_RECORDER_CONTEXT_MENU'
    this._menuOptions = {
      SCREENSHOT: 'SCREENSHOT',
      SCREENSHOT_CLIPPED: 'SCREENSHOT_CLIPPED',
      NAME_VARIABLE: 'NAME_VARIABLE'
    }

    this._allPorts = new Set()
  }

  async boot () {
    console.debug('background - Boot')
    chrome.extension.onConnect.addListener(port => {
      console.debug('background - onConnect', port.name)
      port.onMessage.addListener(msg => {

        if (msg.action && msg.action === actions.START) this.start()
        if (msg.action && msg.action === actions.STOP) this.stop()
        if (msg.action && msg.action === actions.CLEAN_UP) this.cleanUp()
        if (msg.action && msg.action === actions.PAUSE) this.pause()
        if (msg.action && msg.action === actions.UN_PAUSE) this.unPause()

      })

      port.onDisconnect.addListener(() => {
        this._allPorts.delete(port)
      })

      this._allPorts.add(port)
    })

    this._boundedMessageHandler = this.handleMessage.bind(this)
    this._boundedNavigationHandler = this.handleNavigation.bind(this)
    // this._boundedWaitHandler = this.handleWait.bind(this)
    // this._boundedSelectStartHandler = this.handleSelectStart.bind(this)
    // this._boundedSelectStoptHandler = this.handleSelectStop.bind(this)

    chrome.runtime.onMessage.addListener(this._boundedMessageHandler)
    chrome.webNavigation.onCompleted.addListener(this._boundedNavigationHandler)
    // chrome.webNavigation.onBeforeNavigate.addListener(this._boundedWaitHandler)

    axios.post(SERVER_URL + '/recorder/start').then(({ data }) => {
      this._sessionToken = data.token
    })
  }

  _broadcastMessage (msg) {
    for (let port of this._allPorts) {
      port.postMessage(msg)
    }
  }

  start () {
    console.log('-------start recording-------------')
    this.cleanUp()

    this._badgeState = 'rec'

    this._currentUrl = undefined
    this._hasViewPort = false

    chrome.browserAction.setIcon({ path: './images/icon-green.png' })
    chrome.browserAction.setBadgeText({ text: this._badgeState })
    chrome.browserAction.setBadgeBackgroundColor({ color: '#FF0000' })

    /**
     * Right click menu setup
     */

    chrome.contextMenus.removeAll()

    // add the parent and its children

    chrome.contextMenus.create({
      id: this._menuId,
      title: 'Nightmare',
      contexts: ['all']
    })

    chrome.contextMenus.create({
      id: this._menuId + this._menuOptions.SCREENSHOT,
      title: 'Take Screenshot (Ctrl+Shift+A)',
      parentId: this._menuId,
      contexts: ['all']
    })

    chrome.contextMenus.create({
      id: this._menuId + this._menuOptions.SCREENSHOT_CLIPPED,
      title: 'Take Screenshot Clipped (Ctrl+Shift+S)',
      parentId: this._menuId,
      contexts: ['all']
    })

    chrome.contextMenus.create({
      id: this._menuId + this._menuOptions.NAME_VARIABLE,
      title: 'Name Variable',
      parentId: this._menuId,
      contexts: ['all']
    })

    // add the handlers

    this._boundedMenuHandler = this.handleMenuInteraction.bind(this)
    chrome.contextMenus.onClicked.addListener(this._boundedMenuHandler)

    this._boundedKeyCommandHandler = this.handleKeyCommands.bind(this)
    chrome.commands.onCommand.addListener(this._boundedKeyCommandHandler)

    this._sendEvent({ action: 'START_RECORDING' })
    chrome.tabs.query({ active: true }, (tabs) => {
      for (let tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: actions.START })
      }
    })
  }

  destroy () {
    chrome.runtime.onMessage.removeListener(this._boundedMessageHandler)
    chrome.webNavigation.onCompleted.removeListener(this._boundedNavigationHandler)
    chrome.webNavigation.onBeforeNavigate.removeListener(this._boundedWaitHandler)
    chrome.contextMenus.onClicked.removeListener(this._boundedMenuHandler)
  }

  async stop () {
    console.debug('stop recording')
    this._badgeState = ''

    chrome.browserAction.setIcon({ path: './images/icon-black.png' })
    chrome.browserAction.setBadgeText({ text: this._badgeState })
    chrome.browserAction.setBadgeBackgroundColor({color: '#45C8F1'})



    this._sendEvent({ action: 'STOP_RECORDING' })
  }

  pause () {
    console.debug('pause')
    this._badgeState = 'pau'
    chrome.browserAction.setBadgeText({ text: this._badgeState })
    this._isPaused = true
  }

  unPause () {
    console.debug('unpause')
    this._badgeState = 'rec'
    chrome.browserAction.setBadgeText({ text: this._badgeState })
    this._isPaused = false
  }

  cleanUp () {
    console.debug('cleanup')
    chrome.browserAction.setBadgeText({ text: '' })
  }

  recordCurrentUrl (href) {
    if (this._currentUrl !== href) {
      console.debug('recording goto* for:', href)
      this.handleMessage({selector: undefined, value: undefined, action: pptrActions.GOTO, href})
      this._currentUrl = href
    }
  }

  
  recordCurrentViewportSize (value) {
    if (!this._hasViewPort) {
      this.handleMessage({selector: undefined, value, action: pptrActions.VIEWPORT})
      this._hasViewPort = true
    }
  }

  recordNavigation () {
    this.handleMessage({ selector: undefined, value: undefined, action: pptrActions.NAVIGATION })
  }

  recordScreenshot (value) {
    this.handleMessage({ selector: undefined, value, action: pptrActions.SCREENSHOT })
  }

  _sendEvent (event) {
    console.log('_sendEvent', event)

    if (this._isPaused || !this._sessionToken) return

    this._broadcastMessage( event )


    axios.post(SERVER_URL + '/recorder/add-event', {
      token: this._sessionToken,
      event: event
    }).then((response) => {
      if (response.data.params_missing && response.data.params_missing.length > 0) {
        chrome.storage.local.set({ params_missing: response.data.params_missing }, () => {
          console.debug('response.data.params_missing', response.data.params_missing)
          this._broadcastMessage({ 
            action: 'paramsMissing',
            paramsMissing: response.data.params_missing,
          })
        })
      }

      if (response.data.code) {
        chrome.storage.local.set({ thingtalk: response.data.code }, () => {
          console.debug('recording stored')
          this._broadcastMessage({ action: 'codeUpdated' })
        })
      }
    })
  }

  handleMessage (msg, sender) {
    // console.log("handleMessage:", msg)
    // console.log(sender)

    if (msg.action && msg.action === actions.START) this.start()
    if (msg.action && msg.action === actions.STOP) this.stop()

    if (msg.action && msg.action === actions.SELECT_START) this.selectStart()
    if (msg.action && msg.action === actions.SELECT_STOP) this.selectStop()

    if (msg.control) return this.handleControlMessage(msg, sender)

    // to account for clicks etc. we need to record the frameId and url to later target the frame in playback
    msg.frameId = sender ? sender.frameId : null
    msg.frameUrl = sender ? sender.url : null

    this._sendEvent(msg)
  }

  handleControlMessage (msg, sender) {
    if (msg.control === ctrl.EVENT_RECORDER_STARTED) chrome.browserAction.setBadgeText({ text: this._badgeState })
    if (msg.control === ctrl.GET_VIEWPORT_SIZE) this.recordCurrentViewportSize(msg.coordinates)
    if (msg.control === ctrl.GET_CURRENT_URL) this.recordCurrentUrl(msg.href)
    if (msg.control === ctrl.GET_SCREENSHOT) this.recordScreenshot(msg.value)
  }

  handleNavigation ({ frameId }) {
    // console.debug('frameId is:', frameId)
    if (frameId === 0) {
      this.recordNavigation()
    }
  }

  handleMenuInteraction (info, tab) {
    console.debug('context menu clicked')
    console.debug(info.menuItemId)
    console.debug('context menu clicked')

    switch (info.menuItemId) {
      case (this._menuId + this._menuOptions.SCREENSHOT):
        this.toggleScreenShotMode(actions.TOGGLE_SCREENSHOT_MODE)
        break

      case (this._menuId + this._menuOptions.SCREENSHOT_CLIPPED):
        this.toggleScreenShotMode(actions.TOGGLE_SCREENSHOT_CLIPPED_MODE)
        break

      case (this._menuId + this._menuOptions.NAME_VARIABLE):
        this._broadcastMessage({ action: 'variableNamed' })
        break
    }
  }

  handleNameVariable (command) {

  }

  handleKeyCommands (command) {
    switch (command) {
      case actions.TOGGLE_SCREENSHOT_MODE:
        this.toggleScreenShotMode(actions.TOGGLE_SCREENSHOT_MODE)
        break
      case actions.TOGGLE_SCREENSHOT_CLIPPED_MODE:
        this.toggleScreenShotMode(actions.TOGGLE_SCREENSHOT_CLIPPED_MODE)
        break
    }
  }

  toggleScreenShotMode (action) {
    console.debug('toggleScreenShotMode')
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, { action })
    })
  }

  selectStart () {
    console.log('handleSelectStart')
    this._badgeState = 'select'
    chrome.browserAction.setBadgeText({ text: this._badgeState })
  }

  selectStop () {
    console.log('handleSelectStop')
    this._badgeState = ''
    chrome.browserAction.setBadgeText({ text: this._badgeState })
  }

  // handleWait () {
  //   chrome.browserAction.setBadgeText({ text: 'wait' })
  // }
}

console.debug('booting recording controller')
window.recordingController = new RecordingController()
window.recordingController.boot()
