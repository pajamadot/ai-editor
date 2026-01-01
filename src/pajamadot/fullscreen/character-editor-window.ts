/**
 * Character Editor Window
 * Opens the character editor in a separate browser window with AIGC generation
 */

declare const editor: any;
declare const config: any;

let characterEditorWindow: Window | null = null;
let currentCharacterAssetId: number | null = null;

editor.once('load', () => {
    /**
     * Open character editor in a new window
     */
    editor.method('pajamadot:character:window:open', (assetId: number) => {
        const projectId = config.project?.id;
        const windowName = `charactereditor:${projectId}:${assetId}`;

        // Check if window is already open
        if (characterEditorWindow && !characterEditorWindow.closed) {
            characterEditorWindow.focus();
            if (currentCharacterAssetId !== assetId) {
                currentCharacterAssetId = assetId;
                characterEditorWindow.postMessage({
                    type: 'pajamadot:character:loadAsset',
                    assetId: assetId
                }, '*');
            }
            return;
        }

        currentCharacterAssetId = assetId;

        const asset = editor.call('assets:get', assetId);
        const assetName = asset ? asset.get('name') : 'Character Editor';

        const windowContent = createCharacterWindowContent(assetId, assetName, projectId);

        characterEditorWindow = window.open('', windowName, 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no');

        if (characterEditorWindow) {
            characterEditorWindow.document.write(windowContent);
            characterEditorWindow.document.close();

            characterEditorWindow.onbeforeunload = () => {
                characterEditorWindow = null;
                currentCharacterAssetId = null;
            };

            window.addEventListener('message', handleCharacterWindowMessage);
        }
    });

    editor.method('pajamadot:character:window:close', () => {
        if (characterEditorWindow && !characterEditorWindow.closed) {
            characterEditorWindow.close();
        }
        characterEditorWindow = null;
        currentCharacterAssetId = null;
    });

    console.log('[PajamaDot] Character editor window handler registered');
});

function handleCharacterWindowMessage(event: MessageEvent) {
    if (!event.data || typeof event.data !== 'object') return;

    switch (event.data.type) {
        case 'pajamadot:character:ready':
            console.log('[PajamaDot] Character editor window ready');
            break;

        case 'pajamadot:character:save':
            if (event.data.assetId && event.data.content) {
                saveCharacterData(event.data.assetId, event.data.content);
            }
            break;

        case 'pajamadot:character:requestData':
            sendCharacterData(event.data.assetId);
            break;

        case 'pajamadot:character:getToken':
            sendTokenToWindow();
            break;
    }
}

async function saveCharacterData(assetId: number, content: string) {
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

        if (characterEditorWindow && !characterEditorWindow.closed) {
            characterEditorWindow.postMessage({ type: 'pajamadot:character:saved', success: true }, '*');
        }

        console.log('[PajamaDot] Character saved successfully');
    } catch (err) {
        console.error('[PajamaDot] Failed to save character:', err);
        if (characterEditorWindow && !characterEditorWindow.closed) {
            characterEditorWindow.postMessage({ type: 'pajamadot:character:saved', success: false, error: String(err) }, '*');
        }
    }
}

async function sendCharacterData(assetId: number) {
    try {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return;

        const fileUrl = asset.get('file.url');
        if (!fileUrl) return;

        const response = await fetch(fileUrl);
        const content = await response.text();

        if (characterEditorWindow && !characterEditorWindow.closed) {
            characterEditorWindow.postMessage({
                type: 'pajamadot:character:assetData',
                assetId: assetId,
                name: asset.get('name'),
                content: content
            }, '*');
        }
    } catch (err) {
        console.error('[PajamaDot] Failed to load character data:', err);
    }
}

function sendTokenToWindow() {
    const token = editor.call('localStorage:get', 'pajamadot:api_token') || '';
    const baseUrl = editor.call('localStorage:get', 'pajamadot:api_base_url') || 'https://generation.pajamadot.com';

    if (characterEditorWindow && !characterEditorWindow.closed) {
        characterEditorWindow.postMessage({
            type: 'pajamadot:character:token',
            token: token,
            baseUrl: baseUrl
        }, '*');
    }
}

function createCharacterWindowContent(targetAssetId: number, assetName: string, projectId: string): string {
    const escapedName = assetName.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    return `<!DOCTYPE html>
<html>
<head>
    <title>${escapedName} - Character Editor</title>
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
            --secondary: #ec4899;
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
        .header h1 {
            font-size: 14px;
            font-weight: 600;
            flex: 1;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .header .icon {
            width: 24px;
            height: 24px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            border-radius: 6px;
        }
        .header .status {
            font-size: 11px;
            padding: 4px 10px;
            background: var(--bg-lighter);
            border-radius: 12px;
        }
        .header .status.saved { color: var(--success); background: rgba(34, 197, 94, 0.1); }
        .header .status.saving { color: var(--primary); background: rgba(99, 102, 241, 0.1); }
        .header .status.error { color: var(--error); background: rgba(239, 68, 68, 0.1); }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background: var(--bg-lighter); color: var(--text); border: 1px solid var(--border); }
        .btn-secondary:hover { background: var(--border); }
        .content {
            flex: 1;
            display: grid;
            grid-template-columns: 1fr 300px 320px;
            gap: 1px;
            background: var(--border);
            overflow: hidden;
        }
        .panel {
            background: var(--bg-color);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .panel-header {
            padding: 16px;
            background: var(--bg-darker);
            border-bottom: 1px solid var(--border);
        }
        .panel-header h2 {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-muted);
        }
        .panel-content {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
        }
        .form-group { margin-bottom: 16px; }
        .form-group label {
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-muted);
            margin-bottom: 6px;
        }
        .form-group input, .form-group textarea, .form-group select {
            width: 100%;
            padding: 10px 12px;
            background: var(--bg-lighter);
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text);
            font-size: 13px;
            font-family: inherit;
        }
        .form-group textarea { min-height: 100px; resize: vertical; }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
            outline: none;
            border-color: var(--primary);
        }
        .slider-group {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }
        .slider-label { font-size: 12px; color: var(--text-secondary); width: 80px; }
        .slider-group input[type="range"] {
            flex: 1;
            -webkit-appearance: none;
            background: var(--bg-lighter);
            height: 6px;
            border-radius: 3px;
        }
        .slider-group input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 16px;
            height: 16px;
            background: var(--primary);
            border-radius: 50%;
            cursor: pointer;
        }
        .preview-container {
            width: 100%;
            aspect-ratio: 1;
            max-height: 250px;
            background: var(--bg-panel);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            margin-bottom: 16px;
        }
        .preview-container img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .preview-placeholder { color: var(--text-muted); font-size: 12px; }
        .credits-display {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 8px;
        }
        .generation-status {
            font-size: 12px;
            margin: 8px 0;
            padding: 8px 12px;
            border-radius: 6px;
            background: var(--bg-lighter);
        }
        .generation-status.success { color: var(--success); background: rgba(34, 197, 94, 0.1); }
        .generation-status.error { color: var(--error); background: rgba(239, 68, 68, 0.1); }
        .generation-status.pending { color: var(--warning); background: rgba(245, 158, 11, 0.1); }
        .btn-row { display: flex; gap: 8px; margin-bottom: 12px; }
        .btn-row .btn { flex: 1; }
    </style>
</head>
<body>
    <div class="header">
        <h1>
            <div class="icon"></div>
            <span id="title">${escapedName}</span>
        </h1>
        <span id="status" class="status">Loading...</span>
        <button class="btn btn-secondary" id="btnRefresh">Refresh</button>
        <button class="btn btn-primary" id="btnSave">Save</button>
    </div>
    <div class="content">
        <div class="panel">
            <div class="panel-header"><h2>Character Info</h2></div>
            <div class="panel-content">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="charName" placeholder="Character name">
                </div>
                <div class="form-group">
                    <label>Age</label>
                    <input type="text" id="charAge" placeholder="e.g., 25, Young Adult">
                </div>
                <div class="form-group">
                    <label>Biography</label>
                    <textarea id="charBio" placeholder="Character backstory and description..."></textarea>
                </div>
                <div class="form-group">
                    <label>Costume / Appearance</label>
                    <textarea id="charCostume" placeholder="Describe clothing, armor, accessories..." style="min-height:60px;"></textarea>
                </div>
            </div>
        </div>
        <div class="panel">
            <div class="panel-header"><h2>Personality & Visuals</h2></div>
            <div class="panel-content">
                <div class="form-group">
                    <label>Personality (MBTI Sliders)</label>
                    <div class="slider-group">
                        <span class="slider-label">I ↔ E</span>
                        <input type="range" id="sliderEI" min="0" max="100" value="50">
                    </div>
                    <div class="slider-group">
                        <span class="slider-label">S ↔ N</span>
                        <input type="range" id="sliderSN" min="0" max="100" value="50">
                    </div>
                    <div class="slider-group">
                        <span class="slider-label">T ↔ F</span>
                        <input type="range" id="sliderTF" min="0" max="100" value="50">
                    </div>
                    <div class="slider-group">
                        <span class="slider-label">J ↔ P</span>
                        <input type="range" id="sliderJP" min="0" max="100" value="50">
                    </div>
                </div>
                <div class="form-group">
                    <label>Pose</label>
                    <select id="selPose">
                        <option value="portrait">Portrait (Head)</option>
                        <option value="standing">Standing (Full Body)</option>
                        <option value="sitting">Sitting</option>
                        <option value="action">Action Pose</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Expression</label>
                    <select id="selExpression">
                        <option value="neutral">Neutral</option>
                        <option value="happy">Happy</option>
                        <option value="sad">Sad</option>
                        <option value="angry">Angry</option>
                        <option value="surprised">Surprised</option>
                        <option value="thoughtful">Thoughtful</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Art Style</label>
                    <select id="selStyle">
                        <option value="anime">Anime</option>
                        <option value="realistic">Realistic</option>
                        <option value="painted">Painted</option>
                        <option value="pixel">Pixel Art</option>
                        <option value="comic">Comic</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="panel">
            <div class="panel-header"><h2>AI Generation</h2></div>
            <div class="panel-content">
                <div class="preview-container" id="previewContainer">
                    <span class="preview-placeholder">No portrait generated</span>
                </div>
                <div class="form-group">
                    <label>Generation Prompt</label>
                    <textarea id="promptInput" placeholder="Describe the character for AI generation..." style="min-height:80px;"></textarea>
                </div>
                <div class="btn-row">
                    <button class="btn btn-secondary" id="btnForge">Forge Prompt</button>
                    <button class="btn btn-secondary" id="btnEnhance">Enhance (+1)</button>
                </div>
                <div id="genStatus" class="generation-status" style="display:none;"></div>
                <button class="btn btn-primary" id="btnGenerate" style="width:100%;">Generate Portrait (10 credits)</button>
                <div class="credits-display" id="creditsDisplay">Credits: --</div>
            </div>
        </div>
    </div>
    <script>
    (function() {
        'use strict';
        var ASSET_ID = ${targetAssetId};
        var characterData = null;
        var hasChanges = false;
        var apiToken = '';
        var apiBaseUrl = 'https://generation.pajamadot.com';

        var statusEl = document.getElementById('status');
        var titleEl = document.getElementById('title');

        // Form elements
        var charName = document.getElementById('charName');
        var charAge = document.getElementById('charAge');
        var charBio = document.getElementById('charBio');
        var charCostume = document.getElementById('charCostume');
        var sliderEI = document.getElementById('sliderEI');
        var sliderSN = document.getElementById('sliderSN');
        var sliderTF = document.getElementById('sliderTF');
        var sliderJP = document.getElementById('sliderJP');
        var selPose = document.getElementById('selPose');
        var selExpression = document.getElementById('selExpression');
        var selStyle = document.getElementById('selStyle');
        var promptInput = document.getElementById('promptInput');
        var previewContainer = document.getElementById('previewContainer');
        var genStatus = document.getElementById('genStatus');
        var creditsDisplay = document.getElementById('creditsDisplay');
        var btnGenerate = document.getElementById('btnGenerate');

        // Buttons
        document.getElementById('btnRefresh').addEventListener('click', refreshData);
        document.getElementById('btnSave').addEventListener('click', saveData);
        document.getElementById('btnForge').addEventListener('click', forgePrompt);
        document.getElementById('btnEnhance').addEventListener('click', enhancePrompt);
        document.getElementById('btnGenerate').addEventListener('click', generatePortrait);

        // Auto-save on change
        [charName, charAge, charBio, charCostume, sliderEI, sliderSN, sliderTF, sliderJP, selPose, selExpression, selStyle, promptInput].forEach(function(el) {
            el.addEventListener('change', function() { markChanged(); updateDataFromForm(); });
        });

        function parseYaml(content) {
            try { return jsyaml.load(content); }
            catch (e) { console.error('YAML parse error:', e); return null; }
        }

        function serializeYaml(data) { return jsyaml.dump(data); }

        function populateForm() {
            if (!characterData) return;
            charName.value = characterData.name || '';
            charAge.value = characterData.age || '';
            charBio.value = characterData.biography || '';
            charCostume.value = (characterData.visuals && characterData.visuals.costume) || '';

            var personality = characterData.personality || {};
            var mbti = personality.mbtiSliders || {};
            sliderEI.value = mbti.ei || 50;
            sliderSN.value = mbti.sn || 50;
            sliderTF.value = mbti.tf || 50;
            sliderJP.value = mbti.jp || 50;

            var visuals = characterData.visuals || {};
            selPose.value = visuals.pose || 'portrait';
            selExpression.value = visuals.expression || 'neutral';
            selStyle.value = visuals.style || 'anime';

            promptInput.value = characterData.generationPrompt || '';
        }

        function updateDataFromForm() {
            if (!characterData) characterData = {};
            characterData.name = charName.value;
            characterData.age = charAge.value;
            characterData.biography = charBio.value;

            if (!characterData.personality) characterData.personality = {};
            if (!characterData.personality.mbtiSliders) characterData.personality.mbtiSliders = {};
            characterData.personality.mbtiSliders.ei = parseInt(sliderEI.value);
            characterData.personality.mbtiSliders.sn = parseInt(sliderSN.value);
            characterData.personality.mbtiSliders.tf = parseInt(sliderTF.value);
            characterData.personality.mbtiSliders.jp = parseInt(sliderJP.value);

            if (!characterData.visuals) characterData.visuals = {};
            characterData.visuals.pose = selPose.value;
            characterData.visuals.expression = selExpression.value;
            characterData.visuals.style = selStyle.value;
            characterData.visuals.costume = charCostume.value;

            characterData.generationPrompt = promptInput.value;
        }

        function setStatus(text, cls) {
            statusEl.textContent = text;
            statusEl.className = 'status ' + cls;
        }

        function setGenStatus(text, cls) {
            genStatus.style.display = text ? 'block' : 'none';
            genStatus.textContent = text;
            genStatus.className = 'generation-status ' + cls;
        }

        function markChanged() {
            hasChanges = true;
            setStatus('Unsaved changes', '');
        }

        function refreshData() {
            setStatus('Loading...', '');
            window.opener.postMessage({ type: 'pajamadot:character:requestData', assetId: ASSET_ID }, '*');
            window.opener.postMessage({ type: 'pajamadot:character:getToken' }, '*');
        }

        function saveData() {
            updateDataFromForm();
            var content = serializeYaml(characterData);
            setStatus('Saving...', 'saving');
            window.opener.postMessage({
                type: 'pajamadot:character:save',
                assetId: ASSET_ID,
                content: content
            }, '*');
        }

        async function loadCredits() {
            if (!apiToken) {
                creditsDisplay.textContent = 'No API token';
                btnGenerate.disabled = true;
                return;
            }
            try {
                var res = await fetch(apiBaseUrl + '/credits/balance', {
                    headers: { 'Authorization': 'Bearer ' + apiToken }
                });
                var data = await res.json();
                creditsDisplay.textContent = 'Credits: ' + data.balance;
                btnGenerate.disabled = data.balance < 10;
            } catch(e) {
                creditsDisplay.textContent = 'Could not load credits';
            }
        }

        async function forgePrompt() {
            if (!apiToken) { setGenStatus('Configure API token first', 'error'); return; }
            updateDataFromForm();
            setGenStatus('Forging prompt...', 'pending');
            try {
                var res = await fetch(apiBaseUrl + '/text/forge-prompt', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + apiToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'character', data: characterData })
                });
                var data = await res.json();
                promptInput.value = data.prompt;
                characterData.generationPrompt = data.prompt;
                setGenStatus('Prompt forged!', 'success');
                markChanged();
            } catch(e) {
                setGenStatus('Error: ' + e.message, 'error');
            }
        }

        async function enhancePrompt() {
            if (!apiToken) { setGenStatus('Configure API token first', 'error'); return; }
            if (!promptInput.value.trim()) { setGenStatus('Enter a prompt first', 'error'); return; }
            setGenStatus('Enhancing prompt...', 'pending');
            try {
                var res = await fetch(apiBaseUrl + '/text/enhance', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + apiToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: promptInput.value, type: 'character' })
                });
                var data = await res.json();
                promptInput.value = data.prompt;
                characterData.generationPrompt = data.prompt;
                setGenStatus('Prompt enhanced!', 'success');
                markChanged();
                loadCredits();
            } catch(e) {
                setGenStatus('Error: ' + e.message, 'error');
            }
        }

        async function generatePortrait() {
            if (!apiToken) { setGenStatus('Configure API token first', 'error'); return; }
            if (!promptInput.value.trim()) { setGenStatus('Enter a prompt first', 'error'); return; }
            setGenStatus('Generating portrait...', 'pending');
            btnGenerate.disabled = true;
            try {
                var res = await fetch(apiBaseUrl + '/image/generate-character', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + apiToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: promptInput.value, removeBackground: true, aspectRatio: '1:1' })
                });
                var data = await res.json();
                if (data.success && data.imageUrl) {
                    previewContainer.innerHTML = '<img src="' + data.imageUrl + '" alt="Generated portrait">';
                    setGenStatus('Portrait generated!', 'success');
                    loadCredits();
                } else {
                    setGenStatus(data.error || 'Generation failed', 'error');
                }
            } catch(e) {
                setGenStatus('Error: ' + e.message, 'error');
            }
            btnGenerate.disabled = false;
        }

        window.addEventListener('message', function(event) {
            if (!event.data || typeof event.data !== 'object') return;
            switch (event.data.type) {
                case 'pajamadot:character:assetData':
                    characterData = parseYaml(event.data.content);
                    if (!characterData) characterData = { name: 'New Character' };
                    titleEl.textContent = event.data.name;
                    document.title = event.data.name + ' - Character Editor';
                    populateForm();
                    setStatus('Loaded', 'saved');
                    break;
                case 'pajamadot:character:saved':
                    if (event.data.success) {
                        hasChanges = false;
                        setStatus('Saved', 'saved');
                    } else {
                        setStatus('Save failed', 'error');
                    }
                    break;
                case 'pajamadot:character:token':
                    apiToken = event.data.token || '';
                    apiBaseUrl = event.data.baseUrl || 'https://generation.pajamadot.com';
                    loadCredits();
                    break;
            }
        });

        window.onbeforeunload = function() {
            if (hasChanges) return 'You have unsaved changes.';
        };

        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveData();
            }
        });

        window.opener.postMessage({ type: 'pajamadot:character:ready' }, '*');
        refreshData();
    })();
    <\/script>
</body>
</html>`;
}
