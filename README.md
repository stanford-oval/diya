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
node ./server/server.js
```

Now install Nightmare browser extension on Google Chrome. Go to `chrome://extensions` via your address bar on Chrome. Set "Developer Mode" to on in the top-right corner of your window. Click "Load Unpacked" and select the `./build` directory.

These actions will lead the "Nightmare Recorder" extension to appear in your extensions. Make sure the extension is enabled.
