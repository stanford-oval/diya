# DIYA: The DIY Assistant

This repository contains the DIYA, a new voice assistant that lets the user
define custom skills using a combination of voice commands and programming
by demonstration on the web.

DIYA was described in the paper [DIY Assistant: A Multi-Modal End-User Programmable Virtual Assistant](https://almond-static.stanford.edu/papers/diya-pldi21.pdf),
conditionally accepted to PLDI 2021.

**NOTE**: this system is a prototype and a work-in-progress. It is not fully-featured or usable yet.

## Setting up DIYA

### Step 1: Installing dependencies

Run:
```
npm install
```

**NOTE**: the build is known to work on Linux and on Mac OS. It is known **not** to
work on a native Windows installation, due to the lack of standard Unix tools.
You might be able to build on WSL though.

### Step 2: Select the websites you want to enable DIYA on.

Currently, not all websites are enabled, to avoid interfering with normal
browsing activities. You must edit `src/manifest.json` and add any new website
you want to enable. Make sure you include `/*` at the end.

**NOTE**: you must ensure no more than one tab with DIYA is enabled at any given time.

### Step 3: Build the project

Run:
```
npm run build
```

### Step 4: Run DIYA background process

The DIYA background process is a modified [almond-server](https://github.com/stanford-oval/almond-server).
You will run it with:

```
npm run start-server
```

On Mac OS or Windows, you might be asked for a network permission to open port 3000.

You must ensure that the background process is running while using DIYA.

You can terminate the background process with Ctrl-C.

### Step 5: Install the browser extension in Google Chrome

Go to `chrome://extensions` via your address bar on Chrome. Set "Developer Mode" to on in the top-right corner of your window. Click "Load Unpacked" and select the `./build` directory.

These actions will lead the "Nightmare Recorder" extension to appear in your extensions. Make sure the extension is enabled.

**NOTE**: You must reload the extension (using the "reload" button) every time you restart the background process.

## Using DIYA

On a page where DIYA is enabled, you will see a turquoise bar at the top, initially saying "[start]".
The bar will be updated as you give commands to DIYA.

To record a skill, first open the page where you want to record the skill, then say `start recording`,
followed by the name of the function. Then record the actions of the skill.
You can invoke other skills while recording by saying `run` followed by the name of the skill.
Finally, say `stop recording` to finish recording the skill and save it.

### Full Example

_Recording a skill that will let you query the price of an item on Walmart_

- Copy (Ctrl-C) the first item you want to query, as part of the demonstration.
- Go to walmart.com
- Say `start recording price`
- Paste (Ctrl-V) in the search bar
- Click the search button
- Select the price of the first search result
- Say `return this value`
- Say `stop recording`

You can now call the `price` skill in any other page where DIYA is enabled, by selecting
the name of a product, and saying `run price with this`. The price will be shown in a popup when done.

For additional examples and the full set of available commands, please refer to our paper.

## Common Issues

- Voice output will not be played by the extension until you click on the page at least once.

- Paste operations might not be recognized as such if you use the right click menu instead of Ctrl-V.

- There might be permission issues in the developer console while using the extension,
  of the form "Failed to record utterance". Those are harmless and can be ignored.
 
