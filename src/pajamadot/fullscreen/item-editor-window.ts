/**
 * Item Editor Window
 * Opens the item editor in a separate browser window
 */

declare const editor: any;
declare const config: any;

let itemEditorWindow: Window | null = null;
let currentItemAssetId: number | null = null;

editor.once('load', () => {
    editor.method('pajamadot:item:window:open', (assetId: number) => {
        const projectId = config.project?.id;
        const windowName = `itemeditor:${projectId}:${assetId}`;

        if (itemEditorWindow && !itemEditorWindow.closed) {
            itemEditorWindow.focus();
            if (currentItemAssetId !== assetId) {
                currentItemAssetId = assetId;
                itemEditorWindow.postMessage({
                    type: 'pajamadot:item:loadAsset',
                    assetId: assetId
                }, '*');
            }
            return;
        }

        currentItemAssetId = assetId;
        const asset = editor.call('assets:get', assetId);
        const assetName = asset ? asset.get('name') : 'Item Editor';
        const windowContent = createItemWindowContent(assetId, assetName, projectId);

        itemEditorWindow = window.open('', windowName, 'width=600,height=500,menubar=no,toolbar=no,location=no,status=no');

        if (itemEditorWindow) {
            itemEditorWindow.document.write(windowContent);
            itemEditorWindow.document.close();
            itemEditorWindow.onbeforeunload = () => {
                itemEditorWindow = null;
                currentItemAssetId = null;
            };
            window.addEventListener('message', handleItemWindowMessage);
        }
    });

    editor.method('pajamadot:item:window:close', () => {
        if (itemEditorWindow && !itemEditorWindow.closed) {
            itemEditorWindow.close();
        }
        itemEditorWindow = null;
        currentItemAssetId = null;
    });

    console.log('[PajamaDot] Item editor window handler registered');
});

function handleItemWindowMessage(event: MessageEvent) {
    if (!event.data || typeof event.data !== 'object') return;

    switch (event.data.type) {
        case 'pajamadot:item:ready':
            console.log('[PajamaDot] Item editor window ready');
            break;
        case 'pajamadot:item:save':
            if (event.data.assetId && event.data.content) {
                saveItemData(event.data.assetId, event.data.content);
            }
            break;
        case 'pajamadot:item:requestData':
            sendItemData(event.data.assetId);
            break;
    }
}

async function saveItemData(assetId: number, content: string) {
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

        if (itemEditorWindow && !itemEditorWindow.closed) {
            itemEditorWindow.postMessage({ type: 'pajamadot:item:saved', success: true }, '*');
        }
    } catch (err) {
        if (itemEditorWindow && !itemEditorWindow.closed) {
            itemEditorWindow.postMessage({ type: 'pajamadot:item:saved', success: false, error: String(err) }, '*');
        }
    }
}

async function sendItemData(assetId: number) {
    try {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return;
        const fileUrl = asset.get('file.url');
        if (!fileUrl) return;
        const response = await fetch(fileUrl);
        const content = await response.text();

        if (itemEditorWindow && !itemEditorWindow.closed) {
            itemEditorWindow.postMessage({
                type: 'pajamadot:item:assetData',
                assetId: assetId,
                name: asset.get('name'),
                content: content
            }, '*');
        }
    } catch (err) {
        console.error('[PajamaDot] Failed to load item data:', err);
    }
}

function createItemWindowContent(targetAssetId: number, assetName: string, projectId: string): string {
    const escapedName = assetName.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    return `<!DOCTYPE html>
<html>
<head>
    <title>${escapedName} - Item Editor</title>
    <script src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js"><\/script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg-color: #0a0a0f;
            --bg-darker: #050508;
            --bg-lighter: #12121a;
            --primary: #f59e0b;
            --primary-hover: #d97706;
            --text: #e2e8f0;
            --text-muted: #64748b;
            --border: #1e293b;
            --success: #22c55e;
            --error: #ef4444;
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
        .header .icon { width: 24px; height: 24px; background: var(--primary); border-radius: 6px; }
        .header .status { font-size: 11px; padding: 4px 10px; background: var(--bg-lighter); border-radius: 12px; }
        .header .status.saved { color: var(--success); background: rgba(34, 197, 94, 0.1); }
        .header .status.error { color: var(--error); }
        .btn { padding: 8px 16px; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-secondary { background: var(--bg-lighter); color: var(--text); border: 1px solid var(--border); }
        .content { flex: 1; padding: 24px; overflow-y: auto; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 10px 12px; background: var(--bg-lighter); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px; font-family: inherit; }
        .form-group textarea { min-height: 80px; resize: vertical; }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline: none; border-color: var(--primary); }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .checkbox-group { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .checkbox-group input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--primary); }
        .checkbox-group label { font-size: 13px; color: var(--text); text-transform: none; letter-spacing: normal; margin: 0; }
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
        <div class="form-group">
            <label>Name</label>
            <input type="text" id="itemName" placeholder="Item name">
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea id="itemDesc" placeholder="Item description..."></textarea>
        </div>
        <div class="form-group">
            <label>Item Type</label>
            <select id="itemType">
                <option value="misc">Miscellaneous</option>
                <option value="key">Key Item</option>
                <option value="consumable">Consumable</option>
                <option value="equipment">Equipment</option>
                <option value="quest">Quest Item</option>
                <option value="collectible">Collectible</option>
            </select>
        </div>
        <div class="form-group">
            <label>Properties</label>
            <div class="checkbox-group">
                <input type="checkbox" id="itemUsable">
                <label for="itemUsable">Usable</label>
            </div>
            <div class="checkbox-group">
                <input type="checkbox" id="itemStackable">
                <label for="itemStackable">Stackable</label>
            </div>
        </div>
    </div>
    <script>
    (function() {
        'use strict';
        var ASSET_ID = ${targetAssetId};
        var itemData = null;
        var hasChanges = false;

        var statusEl = document.getElementById('status');
        var titleEl = document.getElementById('title');
        var itemName = document.getElementById('itemName');
        var itemDesc = document.getElementById('itemDesc');
        var itemType = document.getElementById('itemType');
        var itemUsable = document.getElementById('itemUsable');
        var itemStackable = document.getElementById('itemStackable');

        document.getElementById('btnRefresh').addEventListener('click', refreshData);
        document.getElementById('btnSave').addEventListener('click', saveData);

        [itemName, itemDesc, itemType, itemUsable, itemStackable].forEach(function(el) {
            el.addEventListener('change', function() { markChanged(); updateDataFromForm(); });
        });

        function parseYaml(content) { try { return jsyaml.load(content); } catch (e) { return null; } }
        function serializeYaml(data) { return jsyaml.dump(data); }

        function populateForm() {
            if (!itemData) return;
            itemName.value = itemData.name || '';
            itemDesc.value = itemData.description || '';
            itemType.value = itemData.itemType || 'misc';
            itemUsable.checked = itemData.usable || false;
            itemStackable.checked = itemData.stackable || false;
        }

        function updateDataFromForm() {
            if (!itemData) itemData = {};
            itemData.name = itemName.value;
            itemData.description = itemDesc.value;
            itemData.itemType = itemType.value;
            itemData.usable = itemUsable.checked;
            itemData.stackable = itemStackable.checked;
        }

        function setStatus(text, cls) { statusEl.textContent = text; statusEl.className = 'status ' + cls; }
        function markChanged() { hasChanges = true; setStatus('Unsaved changes', ''); }

        function refreshData() {
            setStatus('Loading...', '');
            window.opener.postMessage({ type: 'pajamadot:item:requestData', assetId: ASSET_ID }, '*');
        }

        function saveData() {
            updateDataFromForm();
            setStatus('Saving...', '');
            window.opener.postMessage({ type: 'pajamadot:item:save', assetId: ASSET_ID, content: serializeYaml(itemData) }, '*');
        }

        window.addEventListener('message', function(event) {
            if (!event.data) return;
            switch (event.data.type) {
                case 'pajamadot:item:assetData':
                    itemData = parseYaml(event.data.content) || { name: 'New Item' };
                    titleEl.textContent = event.data.name;
                    document.title = event.data.name + ' - Item Editor';
                    populateForm();
                    setStatus('Loaded', 'saved');
                    break;
                case 'pajamadot:item:saved':
                    setStatus(event.data.success ? 'Saved' : 'Save failed', event.data.success ? 'saved' : 'error');
                    if (event.data.success) hasChanges = false;
                    break;
            }
        });

        window.onbeforeunload = function() { if (hasChanges) return 'You have unsaved changes.'; };
        document.addEventListener('keydown', function(e) { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveData(); } });

        window.opener.postMessage({ type: 'pajamadot:item:ready' }, '*');
        refreshData();
    })();
    <\/script>
</body>
</html>`;
}
