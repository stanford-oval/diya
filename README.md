# Nightmare

## Getting Started

Install necessary npm dependencies.

```
npm install
```

Build the project.

```
npm run build
```

Initialize Chrome Hot Plugin Server.

```
npm run dev
```

Initialize local Nightmare server.

```
npm run start-server
```

Now install Nightmare browser extension on Google Chrome. Go to `chrome://extensions` via your address bar on Chrome. Set "Developer Mode" to on in the top-right corner of your window. Click "Load Unpacked" and select the `./build` directory.

These actions will lead the "Nightmare Recorder" extension to appear in your extensions. Make sure the extension is enabled.

## Notes 
If you are seeing the following error in your console: 
`Failed to record VoiceHandler.js?b775:503 utterance. 
Error: Network Error 
at create Error (createError.js?2d83:16)
at XMLHttpRequest.handleError (xhr.js?b50d:83)`

this is likely due to a CORS persmission issue! 

The quickest fix you can make is to install the [moesif CORS extension](https://chrome.google.com/webstore/detail/moesif-origin-cors-change/digfbfaphojjndkpccljibejjbppifbc?hl=en-US). See https://medium.com/@dtkatz/3-ways-to-fix-the-cors-error-and-how-access-control-allow-origin-works-d97d55946d9 for more details.  
