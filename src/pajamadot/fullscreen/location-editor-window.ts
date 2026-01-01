/**
 * Location Editor Window
 * Opens the location editor in a separate browser window with AIGC generation
 */

declare const editor: any;
declare const config: any;

let locationEditorWindow: Window | null = null;
let currentLocationAssetId: number | null = null;

editor.once('load', () => {
    editor.method('pajamadot:location:window:open', (assetId: number) => {
        const projectId = config.project?.id;
        const windowName = `locationeditor:${projectId}:${assetId}`;

        if (locationEditorWindow && !locationEditorWindow.closed) {
            locationEditorWindow.focus();
            if (currentLocationAssetId !== assetId) {
                currentLocationAssetId = assetId;
                locationEditorWindow.postMessage({
                    type: 'pajamadot:location:loadAsset',
                    assetId: assetId
                }, '*');
            }
            return;
        }

        currentLocationAssetId = assetId;
        const asset = editor.call('assets:get', assetId);
        const assetName = asset ? asset.get('name') : 'Location Editor';
        const windowContent = createLocationWindowContent(assetId, assetName, projectId);

        locationEditorWindow = window.open('', windowName, 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no');

        if (locationEditorWindow) {
            locationEditorWindow.document.write(windowContent);
            locationEditorWindow.document.close();
            locationEditorWindow.onbeforeunload = () => {
                locationEditorWindow = null;
                currentLocationAssetId = null;
            };
            window.addEventListener('message', handleLocationWindowMessage);
        }
    });

    editor.method('pajamadot:location:window:close', () => {
        if (locationEditorWindow && !locationEditorWindow.closed) {
            locationEditorWindow.close();
        }
        locationEditorWindow = null;
        currentLocationAssetId = null;
    });

    console.log('[PajamaDot] Location editor window handler registered');
});

function handleLocationWindowMessage(event: MessageEvent) {
    if (!event.data || typeof event.data !== 'object') return;

    switch (event.data.type) {
        case 'pajamadot:location:ready':
            console.log('[PajamaDot] Location editor window ready');
            break;
        case 'pajamadot:location:save':
            if (event.data.assetId && event.data.content) {
                saveLocationData(event.data.assetId, event.data.content);
            }
            break;
        case 'pajamadot:location:requestData':
            sendLocationData(event.data.assetId);
            break;
        case 'pajamadot:location:getToken':
            sendLocationTokenToWindow();
            break;
    }
}

async function saveLocationData(assetId: number, content: string) {
    try {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return;
        const originalFilename = asset.get('file.filename') || `${asset.get('name')}.yaml`;
        const file = new File([content], originalFilename, { type: 'text/plain' });

        await new Promise<void>((resolve, reject) => {
            editor.call('assets:uploadFile', { asset, file }, (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });

        if (locationEditorWindow && !locationEditorWindow.closed) {
            locationEditorWindow.postMessage({ type: 'pajamadot:location:saved', success: true }, '*');
        }
    } catch (err) {
        if (locationEditorWindow && !locationEditorWindow.closed) {
            locationEditorWindow.postMessage({ type: 'pajamadot:location:saved', success: false, error: String(err) }, '*');
        }
    }
}

async function sendLocationData(assetId: number) {
    try {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return;
        const fileUrl = asset.get('file.url');
        if (!fileUrl) return;
        const response = await fetch(fileUrl);
        const content = await response.text();

        if (locationEditorWindow && !locationEditorWindow.closed) {
            locationEditorWindow.postMessage({
                type: 'pajamadot:location:assetData',
                assetId: assetId,
                name: asset.get('name'),
                content: content
            }, '*');
        }
    } catch (err) {
        console.error('[PajamaDot] Failed to load location data:', err);
    }
}

function sendLocationTokenToWindow() {
    // Use native localStorage directly - PlayCanvas editor.call('localStorage:get') tries to
    // JSON.parse values, which fails for plain string tokens. The settings panel uses native
    // localStorage, so we do the same for consistency.
    let token = '';
    let baseUrl = 'https://generation.pajamadot.com';

    try {
        token = localStorage.getItem('pajamadot_api_token') || '';
        const b = localStorage.getItem('pajamadot_api_base_url');
        if (b) baseUrl = b;
    } catch (e) {
        console.error('[PajamaDot] Failed to get token:', e);
    }

    if (locationEditorWindow && !locationEditorWindow.closed) {
        locationEditorWindow.postMessage({
            type: 'pajamadot:location:token',
            token: token,
            baseUrl: baseUrl
        }, '*');
    }
}

function createLocationWindowContent(targetAssetId: number, assetName: string, projectId: string): string {
    const escapedName = assetName.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    return `<!DOCTYPE html>
<html>
<head>
    <title>${escapedName} - Location Editor</title>
    <script src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js"><\/script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg-color: #0a0a0f;
            --bg-darker: #050508;
            --bg-lighter: #12121a;
            --bg-panel: #1a1a2e;
            --primary: #6366f1;
            --primary-hover: #4f46e5;
            --secondary: #10b981;
            --text: #e2e8f0;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --border: #1e293b;
            --success: #22c55e;
            --error: #ef4444;
            --warning: #f59e0b;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-color);
            color: var(--text);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .header {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            background: var(--bg-darker);
            border-bottom: 1px solid var(--border);
            gap: 12px;
        }
        .header h1 { font-size: 14px; font-weight: 600; flex: 1; display: flex; align-items: center; gap: 8px; }
        .header .icon { width: 24px; height: 24px; background: linear-gradient(135deg, var(--secondary), var(--primary)); border-radius: 6px; }
        .header .status { font-size: 11px; padding: 4px 10px; background: var(--bg-lighter); border-radius: 12px; }
        .header .status.saved { color: var(--success); background: rgba(34, 197, 94, 0.1); }
        .header .status.saving { color: var(--primary); }
        .header .status.error { color: var(--error); }
        .btn { padding: 8px 16px; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background: var(--bg-lighter); color: var(--text); border: 1px solid var(--border); }
        .btn-secondary:hover { background: var(--border); }
        .content { flex: 1; display: grid; grid-template-columns: 1fr 320px; gap: 1px; background: var(--border); overflow: hidden; }
        .panel { background: var(--bg-color); display: flex; flex-direction: column; overflow: hidden; }
        .panel-header { padding: 16px; background: var(--bg-darker); border-bottom: 1px solid var(--border); }
        .panel-header h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
        .panel-content { flex: 1; padding: 16px; overflow-y: auto; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 10px 12px; background: var(--bg-lighter); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px; font-family: inherit; }
        .form-group textarea { min-height: 100px; resize: vertical; }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline: none; border-color: var(--primary); }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .preview-container { width: 100%; aspect-ratio: 16/9; max-height: 200px; background: var(--bg-panel); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 16px; }
        .preview-container img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .preview-placeholder { color: var(--text-muted); font-size: 12px; }
        .credits-display { font-size: 11px; color: var(--text-muted); margin-top: 8px; }
        .generation-status { font-size: 12px; margin: 8px 0; padding: 8px 12px; border-radius: 6px; background: var(--bg-lighter); }
        .generation-status.success { color: var(--success); background: rgba(34, 197, 94, 0.1); }
        .generation-status.error { color: var(--error); background: rgba(239, 68, 68, 0.1); }
        .generation-status.pending { color: var(--warning); background: rgba(245, 158, 11, 0.1); }
        .btn-row { display: flex; gap: 8px; margin-bottom: 12px; }
        .btn-row .btn { flex: 1; }
    </style>
</head>
<body>
    <div class="header">
        <h1><div class="icon"></div><span id="title">${escapedName}</span></h1>
        <span id="status" class="status">Loading...</span>
        <button class="btn btn-secondary" id="btnRefresh">Refresh</button>
        <button class="btn btn-primary" id="btnSave">Save</button>
    </div>
    <div class="content">
        <div class="panel">
            <div class="panel-header"><h2>Location Info & Environment</h2></div>
            <div class="panel-content">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="locName" placeholder="Location name">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="locDesc" placeholder="Describe the location, its features and atmosphere..."></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Time of Day</label>
                        <select id="selTime">
                            <option value="dawn">Dawn</option>
                            <option value="morning">Morning</option>
                            <option value="noon">Noon</option>
                            <option value="sunset">Sunset</option>
                            <option value="dusk">Dusk</option>
                            <option value="night">Night</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Weather</label>
                        <select id="selWeather">
                            <option value="clear">Clear</option>
                            <option value="cloudy">Cloudy</option>
                            <option value="rain">Rain</option>
                            <option value="snow">Snow</option>
                            <option value="fog">Fog</option>
                            <option value="storm">Storm</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Mood</label>
                        <select id="selMood">
                            <option value="peaceful">Peaceful</option>
                            <option value="tense">Tense</option>
                            <option value="mysterious">Mysterious</option>
                            <option value="romantic">Romantic</option>
                            <option value="melancholic">Melancholic</option>
                            <option value="cheerful">Cheerful</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Location Type</label>
                        <select id="selType">
                            <option value="indoor">Indoor</option>
                            <option value="outdoor">Outdoor</option>
                            <option value="urban">Urban</option>
                            <option value="nature">Nature</option>
                            <option value="fantasy">Fantasy</option>
                            <option value="sci-fi">Sci-Fi</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Art Style</label>
                    <select id="selStyle">
                        <option value="anime">Anime</option>
                        <option value="realistic">Realistic</option>
                        <option value="painted">Painted</option>
                        <option value="pixel">Pixel Art</option>
                        <option value="watercolor">Watercolor</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="panel">
            <div class="panel-header"><h2>AI Generation</h2></div>
            <div class="panel-content">
                <div class="preview-container" id="previewContainer">
                    <span class="preview-placeholder">No background generated</span>
                </div>
                <div class="form-group">
                    <label>Generation Prompt</label>
                    <textarea id="promptInput" placeholder="Describe the scene for AI generation..." style="min-height:80px;"></textarea>
                </div>
                <div class="btn-row">
                    <button class="btn btn-secondary" id="btnForge">Forge Prompt</button>
                    <button class="btn btn-secondary" id="btnEnhance">Enhance (+1)</button>
                </div>
                <div class="form-group">
                    <label>Quality</label>
                    <select id="selQuality">
                        <option value="fast">Fast (8 credits)</option>
                        <option value="standard" selected>Standard (10 credits)</option>
                        <option value="high">High (15 credits)</option>
                    </select>
                </div>
                <div id="genStatus" class="generation-status" style="display:none;"></div>
                <button class="btn btn-primary" id="btnGenerate" style="width:100%;">Generate Background</button>
                <div class="credits-display" id="creditsDisplay">Credits: --</div>
            </div>
        </div>
    </div>
    <script>
    (function() {
        'use strict';
        var ASSET_ID = ${targetAssetId};
        var locationData = null;
        var hasChanges = false;
        var apiToken = '';
        var apiBaseUrl = 'https://generation.pajamadot.com';

        var statusEl = document.getElementById('status');
        var titleEl = document.getElementById('title');
        var locName = document.getElementById('locName');
        var locDesc = document.getElementById('locDesc');
        var selTime = document.getElementById('selTime');
        var selWeather = document.getElementById('selWeather');
        var selMood = document.getElementById('selMood');
        var selType = document.getElementById('selType');
        var selStyle = document.getElementById('selStyle');
        var selQuality = document.getElementById('selQuality');
        var promptInput = document.getElementById('promptInput');
        var previewContainer = document.getElementById('previewContainer');
        var genStatus = document.getElementById('genStatus');
        var creditsDisplay = document.getElementById('creditsDisplay');
        var btnGenerate = document.getElementById('btnGenerate');

        document.getElementById('btnRefresh').addEventListener('click', refreshData);
        document.getElementById('btnSave').addEventListener('click', saveData);
        document.getElementById('btnForge').addEventListener('click', forgePrompt);
        document.getElementById('btnEnhance').addEventListener('click', enhancePrompt);
        document.getElementById('btnGenerate').addEventListener('click', generateBackground);

        [locName, locDesc, selTime, selWeather, selMood, selType, selStyle, promptInput].forEach(function(el) {
            el.addEventListener('change', function() { markChanged(); updateDataFromForm(); });
        });

        function parseYaml(content) { try { return jsyaml.load(content); } catch (e) { return null; } }
        function serializeYaml(data) { return jsyaml.dump(data); }

        function populateForm() {
            if (!locationData) return;
            locName.value = locationData.name || '';
            locDesc.value = locationData.description || '';
            var v = locationData.visuals || {};
            selTime.value = v.timeOfDay || 'noon';
            selWeather.value = v.weather || 'clear';
            selMood.value = v.mood || 'peaceful';
            selType.value = v.locationType || 'outdoor';
            selStyle.value = v.style || 'anime';
            promptInput.value = locationData.generationPrompt || '';
        }

        function updateDataFromForm() {
            if (!locationData) locationData = {};
            locationData.name = locName.value;
            locationData.description = locDesc.value;
            if (!locationData.visuals) locationData.visuals = {};
            locationData.visuals.timeOfDay = selTime.value;
            locationData.visuals.weather = selWeather.value;
            locationData.visuals.mood = selMood.value;
            locationData.visuals.locationType = selType.value;
            locationData.visuals.style = selStyle.value;
            locationData.mood = selMood.value;
            locationData.generationPrompt = promptInput.value;
        }

        function setStatus(text, cls) { statusEl.textContent = text; statusEl.className = 'status ' + cls; }
        function setGenStatus(text, cls) { genStatus.style.display = text ? 'block' : 'none'; genStatus.textContent = text; genStatus.className = 'generation-status ' + cls; }
        function markChanged() { hasChanges = true; setStatus('Unsaved changes', ''); }

        function refreshData() {
            setStatus('Loading...', '');
            window.opener.postMessage({ type: 'pajamadot:location:requestData', assetId: ASSET_ID }, '*');
            window.opener.postMessage({ type: 'pajamadot:location:getToken' }, '*');
        }

        function saveData() {
            updateDataFromForm();
            setStatus('Saving...', 'saving');
            window.opener.postMessage({ type: 'pajamadot:location:save', assetId: ASSET_ID, content: serializeYaml(locationData) }, '*');
        }

        async function loadCredits() {
            if (!apiToken) { creditsDisplay.textContent = 'No API token'; btnGenerate.disabled = true; return; }
            try {
                var res = await fetch(apiBaseUrl + '/credits/balance', { headers: { 'Authorization': 'Bearer ' + apiToken } });
                var data = await res.json();
                creditsDisplay.textContent = 'Credits: ' + data.balance;
                btnGenerate.disabled = data.balance < 8;
            } catch(e) { creditsDisplay.textContent = 'Could not load credits'; }
        }

        async function forgePrompt() {
            if (!apiToken) { setGenStatus('Configure API token first', 'error'); return; }
            updateDataFromForm();
            setGenStatus('Forging prompt...', 'pending');
            try {
                var res = await fetch(apiBaseUrl + '/text/forge-prompt', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + apiToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'location', data: locationData })
                });
                var data = await res.json();
                promptInput.value = data.prompt;
                locationData.generationPrompt = data.prompt;
                setGenStatus('Prompt forged!', 'success');
                markChanged();
            } catch(e) { setGenStatus('Error: ' + e.message, 'error'); }
        }

        async function enhancePrompt() {
            if (!apiToken) { setGenStatus('Configure API token first', 'error'); return; }
            if (!promptInput.value.trim()) { setGenStatus('Enter a prompt first', 'error'); return; }
            setGenStatus('Enhancing prompt...', 'pending');
            try {
                var res = await fetch(apiBaseUrl + '/text/enhance', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + apiToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: promptInput.value, type: 'location' })
                });
                var data = await res.json();
                promptInput.value = data.prompt;
                setGenStatus('Prompt enhanced!', 'success');
                markChanged();
                loadCredits();
            } catch(e) { setGenStatus('Error: ' + e.message, 'error'); }
        }

        async function generateBackground() {
            if (!apiToken) { setGenStatus('Configure API token first', 'error'); return; }
            if (!promptInput.value.trim()) { setGenStatus('Enter a prompt first', 'error'); return; }
            setGenStatus('Generating background...', 'pending');
            btnGenerate.disabled = true;
            try {
                var res = await fetch(apiBaseUrl + '/image/generate-scene', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + apiToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: promptInput.value,
                        quality: selQuality.value,
                        timeOfDay: selTime.value,
                        weather: selWeather.value,
                        style: selStyle.value
                    })
                });
                var data = await res.json();
                if (data.success && data.imageUrl) {
                    previewContainer.innerHTML = '<img src="' + data.imageUrl + '" alt="Generated background">';
                    setGenStatus('Background generated!', 'success');
                    loadCredits();
                } else {
                    setGenStatus(data.error || 'Generation failed', 'error');
                }
            } catch(e) { setGenStatus('Error: ' + e.message, 'error'); }
            btnGenerate.disabled = false;
        }

        window.addEventListener('message', function(event) {
            if (!event.data) return;
            switch (event.data.type) {
                case 'pajamadot:location:assetData':
                    locationData = parseYaml(event.data.content) || { name: 'New Location' };
                    titleEl.textContent = event.data.name;
                    document.title = event.data.name + ' - Location Editor';
                    populateForm();
                    setStatus('Loaded', 'saved');
                    break;
                case 'pajamadot:location:saved':
                    setStatus(event.data.success ? 'Saved' : 'Save failed', event.data.success ? 'saved' : 'error');
                    if (event.data.success) hasChanges = false;
                    break;
                case 'pajamadot:location:token':
                    apiToken = event.data.token || '';
                    apiBaseUrl = event.data.baseUrl || 'https://generation.pajamadot.com';
                    loadCredits();
                    break;
            }
        });

        window.onbeforeunload = function() { if (hasChanges) return 'You have unsaved changes.'; };
        document.addEventListener('keydown', function(e) { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveData(); } });

        window.opener.postMessage({ type: 'pajamadot:location:ready' }, '*');
        refreshData();
    })();
    <\/script>
</body>
</html>`;
}
