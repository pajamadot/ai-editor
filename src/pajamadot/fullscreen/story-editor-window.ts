/**
 * Story Editor Window
 * Opens the story editor in a separate browser window like the code editor
 * Features a visual node graph editor with drag-and-drop support
 */

declare const editor: any;
declare const config: any;

let storyEditorWindow: Window | null = null;
let currentAssetId: number | null = null;

editor.once('load', () => {
    /**
     * Open story editor in a new window
     */
    editor.method('pajamadot:window:open', (assetId: number) => {
        const projectId = config.project?.id;
        const windowName = `storyeditor:${projectId}`;

        // Check if window is already open
        if (storyEditorWindow && !storyEditorWindow.closed) {
            // Window exists, focus it and update asset
            storyEditorWindow.focus();
            if (currentAssetId !== assetId) {
                currentAssetId = assetId;
                // Send message to update the asset
                storyEditorWindow.postMessage({
                    type: 'pajamadot:loadAsset',
                    assetId: assetId
                }, '*');
            }
            return;
        }

        currentAssetId = assetId;

        // Get asset data
        const asset = editor.call('assets:get', assetId);
        const assetName = asset ? asset.get('name') : 'Story Editor';

        // Create the window content
        const windowContent = createWindowContent(assetId, assetName, projectId);

        // Open new window
        storyEditorWindow = window.open('', windowName, 'width=1400,height=900,menubar=no,toolbar=no,location=no,status=no');

        if (storyEditorWindow) {
            storyEditorWindow.document.write(windowContent);
            storyEditorWindow.document.close();

            // Handle window close
            storyEditorWindow.onbeforeunload = () => {
                storyEditorWindow = null;
                currentAssetId = null;
            };

            // Listen for messages from the story editor window
            window.addEventListener('message', handleWindowMessage);
        }
    });

    /**
     * Close the story editor window
     */
    editor.method('pajamadot:window:close', () => {
        if (storyEditorWindow && !storyEditorWindow.closed) {
            storyEditorWindow.close();
        }
        storyEditorWindow = null;
        currentAssetId = null;
    });

    /**
     * Check if story editor window is open
     */
    editor.method('pajamadot:window:isOpen', () => {
        return storyEditorWindow !== null && !storyEditorWindow.closed;
    });

    console.log('[PajamaDot] Story editor window handler registered');
});

/**
 * Handle messages from the story editor window
 */
function handleWindowMessage(event: MessageEvent) {
    if (!event.data || typeof event.data !== 'object') return;

    switch (event.data.type) {
        case 'pajamadot:ready':
            // Story editor window is ready
            console.log('[PajamaDot] Story editor window ready');
            break;

        case 'pajamadot:save':
            // Save request from story editor
            if (event.data.assetId && event.data.content) {
                saveStoryData(event.data.assetId, event.data.content);
            }
            break;

        case 'pajamadot:requestData':
            // Story editor requesting asset data
            sendAssetData(event.data.assetId);
            break;
    }
}

/**
 * Save story data to the asset
 */
async function saveStoryData(assetId: number, content: string) {
    try {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return;

        // Use original filename from asset to avoid extension mismatch errors
        const originalFilename = asset.get('file.filename') || `${asset.get('name')}.yaml`;
        const file = new File([content], originalFilename, { type: 'text/plain' });

        await new Promise<void>((resolve, reject) => {
            editor.call('assets:uploadFile', { asset, file }, (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Send success message to story editor window
        if (storyEditorWindow && !storyEditorWindow.closed) {
            storyEditorWindow.postMessage({ type: 'pajamadot:saved', success: true }, '*');
        }

        console.log('[PajamaDot] Story saved successfully');
    } catch (err) {
        console.error('[PajamaDot] Failed to save story:', err);
        if (storyEditorWindow && !storyEditorWindow.closed) {
            storyEditorWindow.postMessage({ type: 'pajamadot:saved', success: false, error: String(err) }, '*');
        }
    }
}

/**
 * Send asset data to the story editor window
 */
async function sendAssetData(assetId: number) {
    try {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return;

        const fileUrl = asset.get('file.url');
        if (!fileUrl) return;

        const response = await fetch(fileUrl);
        const content = await response.text();

        if (storyEditorWindow && !storyEditorWindow.closed) {
            storyEditorWindow.postMessage({
                type: 'pajamadot:assetData',
                assetId: assetId,
                name: asset.get('name'),
                content: content
            }, '*');
        }
    } catch (err) {
        console.error('[PajamaDot] Failed to load asset data:', err);
    }
}

/**
 * Create the HTML content for the story editor window with visual graph editor
 */
function createWindowContent(targetAssetId: number, assetName: string, projectId: string): string {
    // Escape the asset name for HTML
    const escapedName = assetName.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    return `<!DOCTYPE html>
<html>
<head>
    <title>${escapedName} - Story Editor</title>
    <script src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js"><\/script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
            --bg-color: #0a0a0f;
            --bg-darker: #050508;
            --bg-lighter: #12121a;
            --bg-node: #1a1a2e;
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
            overflow: hidden;
        }

        .header {
            display: flex;
            align-items: center;
            padding: 10px 16px;
            background: var(--bg-darker);
            border-bottom: 1px solid var(--border);
            gap: 12px;
            z-index: 100;
        }

        .header h1 {
            font-size: 14px;
            font-weight: 600;
            flex: 1;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .header h1 .icon {
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            border-radius: 4px;
        }

        .header .status {
            font-size: 11px;
            color: var(--text-secondary);
            padding: 4px 10px;
            background: var(--bg-lighter);
            border-radius: 12px;
        }

        .header .status.saved { color: var(--success); background: rgba(34, 197, 94, 0.1); }
        .header .status.saving { color: var(--primary); background: rgba(99, 102, 241, 0.1); }
        .header .status.error { color: var(--error); background: rgba(239, 68, 68, 0.1); }

        .btn {
            padding: 6px 14px;
            border: none;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .btn-primary {
            background: var(--primary);
            color: white;
        }

        .btn-primary:hover {
            background: var(--primary-hover);
            transform: translateY(-1px);
        }

        .btn-secondary {
            background: var(--bg-lighter);
            color: var(--text);
            border: 1px solid var(--border);
        }

        .btn-secondary:hover {
            background: var(--border);
        }

        .content {
            flex: 1;
            display: flex;
            overflow: hidden;
        }

        .sidebar-left {
            width: 56px;
            background: var(--bg-darker);
            border-right: 1px solid var(--border);
            padding: 12px 8px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .tool-btn {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .tool-btn:hover {
            background: var(--bg-lighter);
            color: var(--text);
        }

        .tool-btn.active {
            background: var(--primary);
            color: white;
        }

        .tool-btn svg {
            width: 20px;
            height: 20px;
        }

        .tool-divider {
            height: 1px;
            background: var(--border);
            margin: 4px 0;
        }

        .graph-container {
            flex: 1;
            position: relative;
            overflow: hidden;
            background:
                radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.03) 0%, transparent 50%),
                var(--bg-color);
        }

        .graph-canvas {
            position: absolute;
            width: 100%;
            height: 100%;
            cursor: grab;
        }

        .graph-canvas:active {
            cursor: grabbing;
        }

        .graph-canvas.connecting {
            cursor: crosshair;
        }

        .graph-grid {
            position: absolute;
            width: 200%;
            height: 200%;
            top: -50%;
            left: -50%;
            background-image:
                linear-gradient(var(--border) 1px, transparent 1px),
                linear-gradient(90deg, var(--border) 1px, transparent 1px);
            background-size: 40px 40px;
            opacity: 0.3;
            pointer-events: none;
        }

        .graph-edges {
            position: absolute;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: visible;
        }

        .edge {
            fill: none;
            stroke: var(--text-muted);
            stroke-width: 2;
            pointer-events: stroke;
            cursor: pointer;
        }

        .edge:hover {
            stroke: var(--primary);
            stroke-width: 3;
        }

        .edge.selected {
            stroke: var(--primary);
            stroke-width: 3;
        }

        .edge-choice {
            stroke: var(--secondary);
        }

        .edge-temp {
            stroke: var(--primary);
            stroke-dasharray: 8 4;
            opacity: 0.6;
        }

        .graph-nodes {
            position: absolute;
            width: 100%;
            height: 100%;
        }

        .node {
            position: absolute;
            min-width: 240px;
            background: var(--bg-node);
            border: 2px solid var(--border);
            border-radius: 16px;
            cursor: move;
            transition: box-shadow 0.2s, border-color 0.2s;
            overflow: hidden;
        }

        .node:hover {
            border-color: rgba(99, 102, 241, 0.5);
            box-shadow: 0 0 30px rgba(99, 102, 241, 0.1);
        }

        .node.selected {
            border-color: var(--primary);
            box-shadow: 0 0 40px rgba(99, 102, 241, 0.2);
        }

        .node.dragging {
            opacity: 0.9;
            z-index: 1000;
        }

        .node-header {
            padding: 12px 16px;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(236, 72, 153, 0.05));
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .node-type-badge {
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 3px 8px;
            border-radius: 4px;
            background: var(--primary);
            color: white;
        }

        .node-type-badge.start { background: var(--success); }
        .node-type-badge.end { background: var(--error); }
        .node-type-badge.choice { background: var(--secondary); }

        .node-title {
            flex: 1;
            font-size: 13px;
            font-weight: 600;
            color: var(--text);
        }

        .node-content {
            padding: 12px 16px;
        }

        .node-dialogue {
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
            max-height: 80px;
            overflow: hidden;
        }

        .node-choices {
            padding: 0 16px 12px;
        }

        .node-choice {
            font-size: 11px;
            padding: 8px 12px;
            margin-top: 6px;
            background: rgba(236, 72, 153, 0.1);
            border: 1px solid rgba(236, 72, 153, 0.2);
            border-radius: 8px;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .node-characters {
            padding: 8px 16px;
            border-top: 1px solid var(--border);
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .character-badge {
            font-size: 10px;
            padding: 4px 8px;
            background: var(--bg-lighter);
            border-radius: 12px;
            color: var(--text-secondary);
        }

        .handle {
            position: absolute;
            width: 14px;
            height: 14px;
            background: var(--bg-darker);
            border: 3px solid var(--text-muted);
            border-radius: 50%;
            cursor: crosshair;
            transition: all 0.2s;
            z-index: 10;
        }

        .handle:hover {
            transform: scale(1.3);
            border-color: var(--primary);
            background: var(--primary);
        }

        .handle-input {
            left: -7px;
            top: 50%;
            transform: translateY(-50%);
        }

        .handle-output {
            right: -7px;
            top: 50%;
            transform: translateY(-50%);
        }

        .handle-choice {
            right: -7px;
            border-color: var(--secondary);
        }

        .handle-choice:hover {
            border-color: var(--secondary);
            background: var(--secondary);
        }

        .sidebar-right {
            width: 320px;
            background: var(--bg-darker);
            border-left: 1px solid var(--border);
            display: flex;
            flex-direction: column;
        }

        .inspector-header {
            padding: 16px;
            border-bottom: 1px solid var(--border);
        }

        .inspector-header h3 {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-muted);
            margin-bottom: 4px;
        }

        .inspector-header h2 {
            font-size: 14px;
            font-weight: 600;
        }

        .inspector-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }

        .inspector-section {
            margin-bottom: 20px;
        }

        .inspector-section label {
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-muted);
            margin-bottom: 8px;
        }

        .inspector-section input,
        .inspector-section textarea,
        .inspector-section select {
            width: 100%;
            padding: 10px 12px;
            background: var(--bg-lighter);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text);
            font-size: 13px;
            font-family: inherit;
        }

        .inspector-section textarea {
            min-height: 100px;
            resize: vertical;
        }

        .inspector-section input:focus,
        .inspector-section textarea:focus,
        .inspector-section select:focus {
            outline: none;
            border-color: var(--primary);
        }

        .inspector-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-muted);
            text-align: center;
            padding: 40px;
        }

        .inspector-empty svg {
            width: 48px;
            height: 48px;
            margin-bottom: 16px;
            opacity: 0.3;
        }

        .view-tabs {
            display: flex;
            background: var(--bg-darker);
            border-bottom: 1px solid var(--border);
        }

        .view-tab {
            flex: 1;
            padding: 10px;
            background: transparent;
            border: none;
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            border-bottom: 2px solid transparent;
        }

        .view-tab:hover {
            color: var(--text-secondary);
        }

        .view-tab.active {
            color: var(--primary);
            border-bottom-color: var(--primary);
        }

        .context-menu {
            position: fixed;
            background: var(--bg-lighter);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 6px;
            min-width: 180px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: none;
        }

        .context-menu.show {
            display: block;
        }

        .context-menu-item {
            padding: 8px 12px;
            font-size: 12px;
            color: var(--text);
            cursor: pointer;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .context-menu-item:hover {
            background: var(--primary);
        }

        .context-menu-item.danger {
            color: var(--error);
        }

        .context-menu-item.danger:hover {
            background: var(--error);
            color: white;
        }

        .context-menu-divider {
            height: 1px;
            background: var(--border);
            margin: 6px 0;
        }

        .zoom-controls {
            position: absolute;
            bottom: 16px;
            left: 16px;
            display: flex;
            gap: 4px;
            background: var(--bg-darker);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 4px;
        }

        .zoom-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            cursor: pointer;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }

        .zoom-btn:hover {
            background: var(--bg-lighter);
            color: var(--text);
        }

        .zoom-level {
            padding: 0 12px;
            display: flex;
            align-items: center;
            font-size: 11px;
            color: var(--text-muted);
        }

        .yaml-panel {
            display: none;
            flex: 1;
            flex-direction: column;
        }

        .yaml-panel.active {
            display: flex;
        }

        .yaml-editor {
            flex: 1;
            background: var(--bg-darker);
            border: none;
            padding: 16px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
            line-height: 1.6;
            color: var(--text);
            resize: none;
        }

        .yaml-editor:focus {
            outline: none;
        }

        .graph-panel {
            display: none;
            flex: 1;
        }

        .graph-panel.active {
            display: flex;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>
            <div class="icon"></div>
            <span id="title">${escapedName}</span>
        </h1>
        <span id="status" class="status">Loading...</span>
        <div class="view-tabs">
            <button class="view-tab active" data-view="graph">Visual</button>
            <button class="view-tab" data-view="yaml">YAML</button>
        </div>
        <button class="btn btn-secondary" id="btnRefresh">Refresh</button>
        <button class="btn btn-primary" id="btnSave">Save</button>
    </div>

    <div class="content">
        <div class="sidebar-left">
            <button class="tool-btn active" title="Select" data-tool="select">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
                </svg>
            </button>
            <button class="tool-btn" title="Pan" data-tool="pan">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
                </svg>
            </button>
            <div class="tool-divider"></div>
            <button class="tool-btn" title="Add Scene Node" id="btnAddScene">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
            </button>
            <button class="tool-btn" title="Add Start Node" id="btnAddStart">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="9"/>
                    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/>
                </svg>
            </button>
            <button class="tool-btn" title="Add End Node" id="btnAddEnd">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="9"/>
                    <rect x="9" y="9" width="6" height="6" fill="currentColor"/>
                </svg>
            </button>
            <div class="tool-divider"></div>
            <button class="tool-btn" title="Fit View" id="btnFitView">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
            </button>
        </div>

        <div class="graph-panel active" id="graphPanel">
            <div class="graph-container" id="graphContainer">
                <div class="graph-canvas" id="graphCanvas">
                    <div class="graph-grid" id="graphGrid"></div>
                    <svg class="graph-edges" id="graphEdges"></svg>
                    <div class="graph-nodes" id="graphNodes"></div>
                </div>
                <div class="zoom-controls">
                    <button class="zoom-btn" id="btnZoomOut">−</button>
                    <span class="zoom-level" id="zoomLevel">100%</span>
                    <button class="zoom-btn" id="btnZoomIn">+</button>
                </div>
            </div>

            <div class="sidebar-right">
                <div class="inspector-header">
                    <h3>Inspector</h3>
                    <h2 id="inspectorTitle">Select a node</h2>
                </div>
                <div class="inspector-content" id="inspectorContent">
                    <div class="inspector-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <path d="M12 8v8M8 12h8"/>
                        </svg>
                        <p>Select a node to edit its properties</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="yaml-panel" id="yamlPanel">
            <textarea id="yamlEditor" class="yaml-editor" placeholder="Story data will appear here..."></textarea>
        </div>
    </div>

    <div class="context-menu" id="contextMenu">
        <div class="context-menu-item" id="ctxAddScene">Add Scene Node</div>
        <div class="context-menu-item" id="ctxAddStart">Add Start Node</div>
        <div class="context-menu-item" id="ctxAddEnd">Add End Node</div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" id="ctxDelete" style="display:none">Delete</div>
    </div>

    <script>
    (function() {
        'use strict';

        var ASSET_ID = ${targetAssetId};
        var storyData = null;
        var currentContent = '';
        var hasChanges = false;
        var selectedNodeId = null;
        var selectedEdgeId = null;

        var panX = 0, panY = 0;
        var zoom = 1;
        var isPanning = false;
        var panStartX = 0, panStartY = 0;
        var isDragging = false;
        var dragNode = null;
        var dragStartX = 0, dragStartY = 0;
        var nodeStartX = 0, nodeStartY = 0;
        var isConnecting = false;
        var connectFromNode = null;
        var connectFromChoice = null;
        var contextMenuPos = { x: 200, y: 200 };

        var statusEl = document.getElementById('status');
        var titleEl = document.getElementById('title');
        var yamlEditor = document.getElementById('yamlEditor');
        var graphContainer = document.getElementById('graphContainer');
        var graphCanvas = document.getElementById('graphCanvas');
        var graphGrid = document.getElementById('graphGrid');
        var graphNodes = document.getElementById('graphNodes');
        var graphEdges = document.getElementById('graphEdges');
        var contextMenu = document.getElementById('contextMenu');
        var inspectorContent = document.getElementById('inspectorContent');
        var inspectorTitle = document.getElementById('inspectorTitle');
        var zoomLevelEl = document.getElementById('zoomLevel');

        // View tabs
        document.querySelectorAll('.view-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var view = tab.dataset.view;
                document.querySelectorAll('.view-tab').forEach(function(t) { t.classList.remove('active'); });
                tab.classList.add('active');
                document.getElementById('graphPanel').classList.toggle('active', view === 'graph');
                document.getElementById('yamlPanel').classList.toggle('active', view === 'yaml');
                if (view === 'yaml' && storyData) {
                    yamlEditor.value = jsyaml.dump(storyData);
                }
            });
        });

        // Button handlers
        document.getElementById('btnRefresh').addEventListener('click', refreshData);
        document.getElementById('btnSave').addEventListener('click', saveData);
        document.getElementById('btnAddScene').addEventListener('click', function() { addNode('scene'); });
        document.getElementById('btnAddStart').addEventListener('click', function() { addNode('start'); });
        document.getElementById('btnAddEnd').addEventListener('click', function() { addNode('end'); });
        document.getElementById('btnFitView').addEventListener('click', fitView);
        document.getElementById('btnZoomIn').addEventListener('click', zoomIn);
        document.getElementById('btnZoomOut').addEventListener('click', zoomOut);

        // Context menu handlers
        document.getElementById('ctxAddScene').addEventListener('click', function() { addNode('scene'); });
        document.getElementById('ctxAddStart').addEventListener('click', function() { addNode('start'); });
        document.getElementById('ctxAddEnd').addEventListener('click', function() { addNode('end'); });
        document.getElementById('ctxDelete').addEventListener('click', deleteSelected);

        function parseYaml(content) {
            try {
                return jsyaml.load(content);
            } catch (e) {
                console.error('YAML parse error:', e);
                return null;
            }
        }

        function serializeYaml(data) {
            return jsyaml.dump(data);
        }

        function renderGraph() {
            if (!storyData) return;
            graphNodes.innerHTML = '';
            graphEdges.innerHTML = '';
            var nodes = storyData.nodes || {};
            var edges = storyData.edges || {};
            Object.keys(nodes).forEach(function(id) {
                renderNode(id, nodes[id]);
            });
            Object.keys(edges).forEach(function(id) {
                renderEdge(id, edges[id]);
            });
            updateTransform();
        }

        // Helper to get node position (supports both formats)
        function getNodePos(node) {
            if (node.position) return node.position;
            return { x: node.posX || 100, y: node.posY || 100 };
        }

        // Helper to get node data (supports both formats)
        function getNodeData(node) {
            return node.data || node;
        }

        function renderNode(id, node) {
            var el = document.createElement('div');
            el.className = 'node' + (id === selectedNodeId ? ' selected' : '');
            el.dataset.nodeId = id;
            var pos = getNodePos(node);
            el.style.left = pos.x + 'px';
            el.style.top = pos.y + 'px';

            var nodeData = getNodeData(node);
            var typeClass = node.type || nodeData.nodeType || 'scene';
            var typeLabel = typeClass.toUpperCase();
            var contentHtml = '';

            if (typeClass === 'scene') {
                // Support both formats: node.data.dialogue or node.dialogues
                var dialogues = nodeData.dialogue || nodeData.dialogues || [];
                var choices = nodeData.choices || [];
                var characters = nodeData.scene_characters || nodeData.characters || [];

                contentHtml = '<div class="node-content">';
                if (dialogues.length > 0) {
                    contentHtml += '<div class="node-dialogue">';
                    dialogues.slice(0, 2).forEach(function(d) {
                        var text = (d.text || '...').substring(0, 100);
                        contentHtml += '<p>' + escapeHtml(text) + '</p>';
                    });
                    if (dialogues.length > 2) {
                        contentHtml += '<p style="opacity:0.5">+' + (dialogues.length - 2) + ' more...</p>';
                    }
                    contentHtml += '</div>';
                } else {
                    contentHtml += '<div class="node-dialogue" style="font-style:italic;opacity:0.5">No dialogue</div>';
                }
                contentHtml += '</div>';

                if (choices.length > 0) {
                    contentHtml += '<div class="node-choices">';
                    choices.forEach(function(choice, idx) {
                        contentHtml += '<div class="node-choice" data-choice-idx="' + idx + '">' +
                            escapeHtml(choice.text || 'Choice ' + (idx + 1)) +
                            '<div class="handle handle-choice" data-choice-id="' + choice.id + '" style="position:relative;right:-8px;"></div>' +
                            '</div>';
                    });
                    contentHtml += '</div>';
                }

                if (characters.length > 0) {
                    contentHtml += '<div class="node-characters">';
                    characters.forEach(function(c) {
                        // Support both formats: character_id (web app) or characterId (legacy)
                        var charId = c.character_id || c.characterId || 'Unknown';
                        contentHtml += '<span class="character-badge">' + escapeHtml(charId) + '</span>';
                    });
                    contentHtml += '</div>';
                }
            }

            // Support both: node.data.label or node.name
            var nodeLabel = nodeData.label || node.name || 'Untitled';

            el.innerHTML = '<div class="handle handle-input"></div>' +
                '<div class="node-header">' +
                '<span class="node-type-badge ' + typeClass + '">' + typeLabel + '</span>' +
                '<span class="node-title">' + escapeHtml(nodeLabel) + '</span>' +
                '</div>' +
                contentHtml +
                '<div class="handle handle-output"></div>';

            el.addEventListener('mousedown', function(e) { onNodeMouseDown(e, id); });
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                selectNode(id);
            });

            var outputHandle = el.querySelector('.handle-output');
            if (outputHandle) {
                outputHandle.addEventListener('mousedown', function(e) { startConnection(e, id, null); });
            }

            el.querySelectorAll('.handle-choice').forEach(function(h) {
                h.addEventListener('mousedown', function(e) { startConnection(e, id, h.dataset.choiceId); });
            });

            graphNodes.appendChild(el);
        }

        function escapeHtml(text) {
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function renderEdge(id, edge) {
            // Support both formats: source/target (React Flow) or from/to (legacy)
            var sourceId = edge.source || edge.from;
            var targetId = edge.target || edge.to;

            var fromNode = storyData.nodes[sourceId];
            var toNode = storyData.nodes[targetId];
            if (!fromNode || !toNode) return;

            var fromEl = document.querySelector('[data-node-id="' + sourceId + '"]');
            var toEl = document.querySelector('[data-node-id="' + targetId + '"]');
            if (!fromEl || !toEl) return;

            var fromPos = getNodePos(fromNode);
            var toPos = getNodePos(toNode);
            var fromRect = { x: fromPos.x, y: fromPos.y, w: fromEl.offsetWidth, h: fromEl.offsetHeight };
            var toRect = { x: toPos.x, y: toPos.y, w: toEl.offsetWidth, h: toEl.offsetHeight };

            var startX = fromRect.x + fromRect.w;
            var startY = fromRect.y + fromRect.h / 2;

            // Support both formats: edge.choiceId (legacy) or edge.data.choiceId (React Flow)
            var choiceId = edge.choiceId || (edge.data && edge.data.choiceId);
            if (choiceId) {
                var choiceHandle = fromEl.querySelector('[data-choice-id="' + choiceId + '"]');
                if (choiceHandle) {
                    var choiceRect = choiceHandle.getBoundingClientRect();
                    var nodeRect = fromEl.getBoundingClientRect();
                    startY = fromRect.y + (choiceRect.top - nodeRect.top) + choiceHandle.offsetHeight / 2;
                }
            }

            var endX = toRect.x;
            var endY = toRect.y + toRect.h / 2;
            var dx = Math.abs(endX - startX);
            var cp1x = startX + dx * 0.5;
            var cp2x = endX - dx * 0.5;

            var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M ' + startX + ' ' + startY + ' C ' + cp1x + ' ' + startY + ', ' + cp2x + ' ' + endY + ', ' + endX + ' ' + endY);
            // Support both formats for choice detection
            var isChoice = edge.choiceId || (edge.data && edge.data.choiceId) || edge.type === 'choice';
            path.setAttribute('class', 'edge' + (isChoice ? ' edge-choice' : '') + (id === selectedEdgeId ? ' selected' : ''));
            path.dataset.edgeId = id;
            path.style.pointerEvents = 'stroke';

            path.addEventListener('click', function(e) {
                e.stopPropagation();
                selectEdge(id);
            });

            graphEdges.appendChild(path);
        }

        function updateTransform() {
            graphCanvas.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + zoom + ')';
            graphGrid.style.transform = 'translate(' + (panX % 40) + 'px, ' + (panY % 40) + 'px)';
            zoomLevelEl.textContent = Math.round(zoom * 100) + '%';
        }

        function onNodeMouseDown(e, nodeId) {
            if (e.target.classList.contains('handle')) return;
            isDragging = true;
            dragNode = nodeId;
            var node = storyData.nodes[nodeId];
            var pos = getNodePos(node);
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            nodeStartX = pos.x;
            nodeStartY = pos.y;
            var nodeEl = document.querySelector('[data-node-id="' + nodeId + '"]');
            if (nodeEl) nodeEl.classList.add('dragging');
            e.preventDefault();
        }

        function startConnection(e, nodeId, choiceId) {
            e.stopPropagation();
            e.preventDefault();
            isConnecting = true;
            connectFromNode = nodeId;
            connectFromChoice = choiceId;
            graphCanvas.classList.add('connecting');

            var tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tempPath.setAttribute('class', 'edge edge-temp');
            tempPath.id = 'tempEdge';
            graphEdges.appendChild(tempPath);
        }

        function updateTempEdge(e) {
            var tempPath = document.getElementById('tempEdge');
            if (!tempPath || !connectFromNode) return;

            var fromNode = storyData.nodes[connectFromNode];
            var fromEl = document.querySelector('[data-node-id="' + connectFromNode + '"]');
            if (!fromNode || !fromEl) return;

            var fromPos = getNodePos(fromNode);
            var startX = fromPos.x + fromEl.offsetWidth;
            var startY = fromPos.y + fromEl.offsetHeight / 2;

            if (connectFromChoice) {
                var choiceHandle = fromEl.querySelector('[data-choice-id="' + connectFromChoice + '"]');
                if (choiceHandle) {
                    var choiceRect = choiceHandle.getBoundingClientRect();
                    var nodeRect = fromEl.getBoundingClientRect();
                    startY = fromPos.y + (choiceRect.top - nodeRect.top) + choiceHandle.offsetHeight / 2;
                }
            }

            var rect = graphContainer.getBoundingClientRect();
            var endX = (e.clientX - rect.left - panX) / zoom;
            var endY = (e.clientY - rect.top - panY) / zoom;
            var dx = Math.abs(endX - startX);
            var cp1x = startX + dx * 0.5;
            var cp2x = endX - dx * 0.5;

            tempPath.setAttribute('d', 'M ' + startX + ' ' + startY + ' C ' + cp1x + ' ' + startY + ', ' + cp2x + ' ' + endY + ', ' + endX + ' ' + endY);
        }

        function endConnection(targetNodeId) {
            if (!connectFromNode || connectFromNode === targetNodeId) {
                cancelConnection();
                return;
            }

            var edgeId = 'edge_' + Date.now();
            if (!storyData.edges) storyData.edges = {};

            // Use React Flow edge format (source/target instead of from/to)
            storyData.edges[edgeId] = {
                id: edgeId,
                source: connectFromNode,
                target: targetNodeId,
                type: connectFromChoice ? 'choice' : 'default',
                data: connectFromChoice ? { choiceId: connectFromChoice } : undefined
            };

            if (connectFromChoice) {
                var fromNode = storyData.nodes[connectFromNode];
                var fromNodeData = getNodeData(fromNode);
                var choices = fromNodeData.choices || [];
                if (choices.length > 0) {
                    var choice = choices.find(function(c) { return c.id === connectFromChoice; });
                    if (choice) {
                        choice.targetNodeId = targetNodeId;
                    }
                }
            }

            markChanged();
            cancelConnection();
            renderGraph();
        }

        function cancelConnection() {
            var tempPath = document.getElementById('tempEdge');
            if (tempPath) tempPath.remove();
            isConnecting = false;
            connectFromNode = null;
            connectFromChoice = null;
            graphCanvas.classList.remove('connecting');
        }

        function selectNode(nodeId) {
            selectedNodeId = nodeId;
            selectedEdgeId = null;
            renderGraph();
            updateInspector();
        }

        function selectEdge(edgeId) {
            selectedEdgeId = edgeId;
            selectedNodeId = null;
            renderGraph();
            updateInspector();
        }

        function clearSelection() {
            selectedNodeId = null;
            selectedEdgeId = null;
            renderGraph();
            updateInspector();
        }

        function updateInspector() {
            if (selectedNodeId) {
                var node = storyData.nodes[selectedNodeId];
                var nodeData = getNodeData(node);
                // Support both formats: node.data.label or node.name
                var nodeName = nodeData.label || node.name || 'Untitled Node';
                // Support both formats: node.type or node.nodeType
                var nodeType = node.type || nodeData.nodeType || 'scene';
                inspectorTitle.textContent = nodeName;

                var html = '<div class="inspector-section">' +
                    '<label>Node Name</label>' +
                    '<input type="text" id="nodeName" value="' + escapeHtml(nodeName) + '">' +
                    '</div>' +
                    '<div class="inspector-section">' +
                    '<label>Node Type</label>' +
                    '<select id="nodeType">' +
                    '<option value="scene"' + (nodeType === 'scene' ? ' selected' : '') + '>Scene</option>' +
                    '<option value="start"' + (nodeType === 'start' ? ' selected' : '') + '>Start</option>' +
                    '<option value="end"' + (nodeType === 'end' ? ' selected' : '') + '>End</option>' +
                    '<option value="condition"' + (nodeType === 'condition' ? ' selected' : '') + '>Condition</option>' +
                    '</select>' +
                    '</div>';

                if (nodeType === 'scene') {
                    html += '<div class="inspector-section">' +
                        '<label>Add Dialogue Line</label>' +
                        '<button class="btn btn-secondary" style="width:100%" id="btnAddDialogue">+ Add Dialogue</button>' +
                        '</div>' +
                        '<div class="inspector-section">' +
                        '<label>Add Choice</label>' +
                        '<button class="btn btn-secondary" style="width:100%" id="btnAddChoice">+ Add Choice</button>' +
                        '</div>' +
                        '<div class="inspector-section">' +
                        '<label>Dialogues</label>' +
                        '<div id="dialoguesList"></div>' +
                        '</div>';
                }

                html += '<div class="inspector-section">' +
                    '<button class="btn btn-secondary" style="width:100%;color:var(--error);" id="btnDeleteNode">Delete Node</button>' +
                    '</div>';

                inspectorContent.innerHTML = html;

                document.getElementById('nodeName').addEventListener('change', function(e) {
                    updateNodeProperty('label', e.target.value);
                });
                document.getElementById('nodeType').addEventListener('change', function(e) {
                    updateNodeProperty('type', e.target.value);
                });

                if (nodeType === 'scene') {
                    document.getElementById('btnAddDialogue').addEventListener('click', addDialogueLine);
                    document.getElementById('btnAddChoice').addEventListener('click', addChoice);

                    // Support both formats: node.data.dialogue or node.dialogues
                    var dialogues = nodeData.dialogue || nodeData.dialogues || [];
                    var dialoguesList = document.getElementById('dialoguesList');
                    if (dialoguesList && dialogues.length > 0) {
                        dialogues.forEach(function(d, idx) {
                            var div = document.createElement('div');
                            div.style.cssText = 'margin-bottom:8px;padding:8px;background:var(--bg-lighter);border-radius:6px;';
                            var textarea = document.createElement('textarea');
                            textarea.style.cssText = 'width:100%;min-height:60px;margin-bottom:4px;background:var(--bg-darker);border:1px solid var(--border);border-radius:4px;padding:8px;color:var(--text);font-size:12px;resize:vertical;';
                            textarea.value = d.text || '';
                            textarea.addEventListener('change', function() { updateDialogue(idx, 'text', textarea.value); });
                            var btn = document.createElement('button');
                            btn.className = 'btn btn-secondary';
                            btn.style.cssText = 'padding:4px 8px;font-size:10px;';
                            btn.textContent = 'Remove';
                            btn.addEventListener('click', function() { removeDialogue(idx); });
                            div.appendChild(textarea);
                            div.appendChild(btn);
                            dialoguesList.appendChild(div);
                        });
                    }
                }

                document.getElementById('btnDeleteNode').addEventListener('click', deleteSelected);

            } else if (selectedEdgeId) {
                var edge = storyData.edges[selectedEdgeId];
                inspectorTitle.textContent = 'Edge';

                // Support both formats: source/target or from/to
                var sourceId = edge.source || edge.from;
                var targetId = edge.target || edge.to;
                var sourceNode = storyData.nodes[sourceId] || {};
                var targetNode = storyData.nodes[targetId] || {};
                var sourceLabel = getNodeData(sourceNode).label || sourceNode.name || sourceId;
                var targetLabel = getNodeData(targetNode).label || targetNode.name || targetId;
                var edgeType = edge.type || edge.edgeType || 'default';

                inspectorContent.innerHTML = '<div class="inspector-section">' +
                    '<label>From Node</label>' +
                    '<input type="text" value="' + escapeHtml(sourceLabel) + '" disabled>' +
                    '</div>' +
                    '<div class="inspector-section">' +
                    '<label>To Node</label>' +
                    '<input type="text" value="' + escapeHtml(targetLabel) + '" disabled>' +
                    '</div>' +
                    '<div class="inspector-section">' +
                    '<label>Edge Type</label>' +
                    '<input type="text" value="' + edgeType + '" disabled>' +
                    '</div>' +
                    '<div class="inspector-section">' +
                    '<button class="btn btn-secondary" style="width:100%;color:var(--error);" id="btnDeleteEdge">Delete Edge</button>' +
                    '</div>';

                document.getElementById('btnDeleteEdge').addEventListener('click', deleteSelected);

            } else {
                inspectorTitle.textContent = 'Select a node';
                inspectorContent.innerHTML = '<div class="inspector-empty">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
                    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
                    '<path d="M12 8v8M8 12h8"/>' +
                    '</svg>' +
                    '<p>Select a node to edit its properties</p>' +
                    '</div>';
            }
        }

        function updateNodeProperty(prop, value) {
            if (!selectedNodeId || !storyData.nodes[selectedNodeId]) return;
            var node = storyData.nodes[selectedNodeId];

            // Store in React Flow format
            if (prop === 'label' || prop === 'text' || prop === 'endingType') {
                // These go in node.data
                if (!node.data) node.data = {};
                node.data[prop] = value;
                // Clean up legacy format
                delete node.name;
            } else if (prop === 'type') {
                // Type goes on node directly in React Flow
                node.type = value;
                // Clean up legacy format
                delete node.nodeType;
            } else {
                // Other properties go on node.data
                if (!node.data) node.data = {};
                node.data[prop] = value;
            }

            markChanged();
            renderGraph();
        }

        function addDialogueLine() {
            if (!selectedNodeId) return;
            var node = storyData.nodes[selectedNodeId];
            // Use React Flow format: dialogue in node.data
            if (!node.data) node.data = {};
            if (!node.data.dialogue) node.data.dialogue = [];
            // Use web app dialogue format
            node.data.dialogue.push({
                id: 'd_' + Date.now(),
                text: '',
                character_id: null
            });
            // Clean up legacy format
            delete node.dialogues;
            markChanged();
            updateInspector();
            renderGraph();
        }

        function updateDialogue(idx, prop, value) {
            if (!selectedNodeId) return;
            var node = storyData.nodes[selectedNodeId];
            var nodeData = getNodeData(node);
            var dialogues = nodeData.dialogue || nodeData.dialogues;
            if (dialogues && dialogues[idx]) {
                dialogues[idx][prop] = value;
                markChanged();
                renderGraph();
            }
        }

        function removeDialogue(idx) {
            if (!selectedNodeId) return;
            var node = storyData.nodes[selectedNodeId];
            var nodeData = getNodeData(node);
            var dialogues = nodeData.dialogue || nodeData.dialogues;
            if (dialogues) {
                dialogues.splice(idx, 1);
                markChanged();
                updateInspector();
                renderGraph();
            }
        }

        function addChoice() {
            if (!selectedNodeId) return;
            var node = storyData.nodes[selectedNodeId];
            // Use React Flow format: choices in node.data
            if (!node.data) node.data = {};
            if (!node.data.choices) node.data.choices = [];
            node.data.choices.push({
                id: 'c_' + Date.now(),
                text: 'New Choice'
            });
            // Clean up legacy format if present
            delete node.choices;
            markChanged();
            updateInspector();
            renderGraph();
        }

        function addNode(type) {
            hideContextMenu();
            if (!storyData) storyData = { version: 1, nodes: {}, edges: {} };
            if (!storyData.nodes) storyData.nodes = {};

            var nodeId = type + '_' + Date.now();
            // Create node in React Flow compatible format
            var label = 'New Node';
            if (type === 'start') label = 'Start';
            else if (type === 'end') label = 'End';
            else if (type === 'scene') label = 'New Scene';

            var node = {
                id: nodeId,
                type: type, // 'start', 'scene', or 'end'
                position: { x: contextMenuPos.x, y: contextMenuPos.y },
                data: {
                    label: label,
                    text: ''
                }
            };

            if (type === 'scene') {
                node.data.dialogue = [];
                node.data.choices = [];
                node.data.scene_characters = [];
            }

            if (type === 'end') {
                node.data.endingType = 'neutral';
            }

            storyData.nodes[nodeId] = node;
            markChanged();
            renderGraph();
            selectNode(nodeId);
        }

        function deleteSelected() {
            hideContextMenu();

            if (selectedNodeId) {
                if (storyData.edges) {
                    Object.keys(storyData.edges).forEach(function(edgeId) {
                        var edge = storyData.edges[edgeId];
                        // Support both formats
                        var sourceId = edge.source || edge.from;
                        var targetId = edge.target || edge.to;
                        if (sourceId === selectedNodeId || targetId === selectedNodeId) {
                            delete storyData.edges[edgeId];
                        }
                    });
                }
                delete storyData.nodes[selectedNodeId];
                selectedNodeId = null;
            } else if (selectedEdgeId) {
                delete storyData.edges[selectedEdgeId];
                selectedEdgeId = null;
            }

            markChanged();
            renderGraph();
            updateInspector();
        }

        function showContextMenu(e) {
            e.preventDefault();
            var rect = graphContainer.getBoundingClientRect();
            contextMenuPos.x = (e.clientX - rect.left - panX) / zoom;
            contextMenuPos.y = (e.clientY - rect.top - panY) / zoom;

            contextMenu.style.left = e.clientX + 'px';
            contextMenu.style.top = e.clientY + 'px';
            contextMenu.classList.add('show');

            document.getElementById('ctxDelete').style.display =
                (selectedNodeId || selectedEdgeId) ? 'flex' : 'none';
        }

        function hideContextMenu() {
            contextMenu.classList.remove('show');
        }

        function zoomIn() {
            zoom = Math.min(2, zoom + 0.1);
            updateTransform();
        }

        function zoomOut() {
            zoom = Math.max(0.25, zoom - 0.1);
            updateTransform();
        }

        function fitView() {
            if (!storyData || !storyData.nodes) return;

            var nodes = Object.values(storyData.nodes);
            if (nodes.length === 0) return;

            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            nodes.forEach(function(node) {
                var pos = getNodePos(node);
                minX = Math.min(minX, pos.x);
                minY = Math.min(minY, pos.y);
                maxX = Math.max(maxX, pos.x + 240);
                maxY = Math.max(maxY, pos.y + 200);
            });

            var rect = graphContainer.getBoundingClientRect();
            var padding = 50;
            var scaleX = (rect.width - padding * 2) / (maxX - minX + 100);
            var scaleY = (rect.height - padding * 2) / (maxY - minY + 100);
            zoom = Math.min(1, Math.max(0.25, Math.min(scaleX, scaleY)));

            panX = -minX * zoom + padding;
            panY = -minY * zoom + padding;

            updateTransform();
        }

        function setStatus(text, className) {
            statusEl.textContent = text;
            statusEl.className = 'status ' + className;
        }

        function markChanged() {
            hasChanges = true;
            setStatus('Unsaved changes', '');
        }

        function refreshData() {
            setStatus('Loading...', '');
            window.opener.postMessage({ type: 'pajamadot:requestData', assetId: ASSET_ID }, '*');
        }

        function saveData() {
            var activeTab = document.querySelector('.view-tab.active');
            if (activeTab && activeTab.dataset.view === 'yaml') {
                var parsed = parseYaml(yamlEditor.value);
                if (parsed) {
                    storyData = parsed;
                } else {
                    setStatus('Invalid YAML', 'error');
                    return;
                }
            }

            var content = serializeYaml(storyData);
            setStatus('Saving...', 'saving');
            window.opener.postMessage({
                type: 'pajamadot:save',
                assetId: ASSET_ID,
                content: content
            }, '*');
        }

        // Mouse events
        graphContainer.addEventListener('mousedown', function(e) {
            if (e.target === graphContainer || e.target === graphCanvas || e.target.classList.contains('graph-grid')) {
                isPanning = true;
                panStartX = e.clientX - panX;
                panStartY = e.clientY - panY;
            }
        });

        graphContainer.addEventListener('mousemove', function(e) {
            if (isPanning) {
                panX = e.clientX - panStartX;
                panY = e.clientY - panStartY;
                updateTransform();
            } else if (isDragging && dragNode) {
                var node = storyData.nodes[dragNode];
                var newX = nodeStartX + (e.clientX - dragStartX) / zoom;
                var newY = nodeStartY + (e.clientY - dragStartY) / zoom;
                // Store in React Flow format (position: {x, y})
                if (!node.position) node.position = {};
                node.position.x = newX;
                node.position.y = newY;
                // Also remove legacy format if present
                delete node.posX;
                delete node.posY;
                renderGraph();
                markChanged();
            } else if (isConnecting) {
                updateTempEdge(e);
            }
        });

        graphContainer.addEventListener('mouseup', function(e) {
            if (isDragging) {
                var el = document.querySelector('[data-node-id="' + dragNode + '"]');
                if (el) el.classList.remove('dragging');
            }

            if (isConnecting) {
                var target = e.target.closest('.node');
                if (target && target.dataset.nodeId) {
                    endConnection(target.dataset.nodeId);
                } else {
                    cancelConnection();
                }
            }

            isPanning = false;
            isDragging = false;
            dragNode = null;
        });

        graphContainer.addEventListener('wheel', function(e) {
            e.preventDefault();
            var delta = e.deltaY > 0 ? -0.1 : 0.1;
            zoom = Math.min(2, Math.max(0.25, zoom + delta));
            updateTransform();
        });

        graphContainer.addEventListener('click', function(e) {
            if (e.target === graphContainer || e.target === graphCanvas || e.target.classList.contains('graph-grid')) {
                clearSelection();
            }
            hideContextMenu();
        });

        graphContainer.addEventListener('contextmenu', showContextMenu);

        document.addEventListener('click', function(e) {
            if (!contextMenu.contains(e.target)) {
                hideContextMenu();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveData();
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    deleteSelected();
                }
            }
            if (e.key === 'Escape') {
                if (isConnecting) {
                    cancelConnection();
                } else {
                    clearSelection();
                }
            }
        });

        // Message handling
        window.addEventListener('message', function(event) {
            if (!event.data || typeof event.data !== 'object') return;

            switch (event.data.type) {
                case 'pajamadot:assetData':
                    storyData = parseYaml(event.data.content);
                    if (!storyData) {
                        storyData = { version: 1, nodes: {}, edges: {} };
                    }
                    currentContent = event.data.content;
                    titleEl.textContent = event.data.name;
                    document.title = event.data.name + ' - Story Editor';
                    yamlEditor.value = event.data.content;
                    setStatus('Loaded', 'saved');
                    renderGraph();
                    fitView();
                    break;

                case 'pajamadot:saved':
                    if (event.data.success) {
                        currentContent = serializeYaml(storyData);
                        hasChanges = false;
                        setStatus('Saved', 'saved');
                    } else {
                        setStatus('Save failed: ' + event.data.error, 'error');
                    }
                    break;

                case 'pajamadot:loadAsset':
                    refreshData();
                    break;
            }
        });

        window.onbeforeunload = function() {
            if (hasChanges) {
                return 'You have unsaved changes. Are you sure you want to leave?';
            }
        };

        // Initialize
        window.opener.postMessage({ type: 'pajamadot:ready' }, '*');
        refreshData();

    })();
    <\/script>
</body>
</html>`;
}
