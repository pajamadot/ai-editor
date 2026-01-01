/**
 * Active Jobs Panel
 * Shows currently running generation jobs with progress indicators
 */

import { Button, Container, Label, Panel, Progress } from '@playcanvas/pcui';
import { jobsManager } from '../generation/jobs-manager';
import type { GenerationJob, GenerationJobStatus, MediaType } from '../generation/types';

declare const editor: any;

/**
 * Get status color
 */
function getStatusColor(status: GenerationJobStatus): string {
    switch (status) {
        case 'pending': return '#f59e0b';      // amber
        case 'in_progress': return '#3b82f6';  // blue
        case 'downloading': return '#8b5cf6'; // purple
        case 'uploading': return '#6366f1';   // indigo
        case 'completed': return '#22c55e';    // green
        case 'failed': return '#ef4444';       // red
        default: return '#888';
    }
}

/**
 * Get media type icon
 */
function getMediaTypeIcon(mediaType: MediaType): string {
    switch (mediaType) {
        case 'image': return 'E159';
        case 'texture': return 'E159';
        case 'video': return 'E217';
        case 'audio': return 'E175';
        case 'mesh': return 'E207';
        case 'voiceover': return 'E175';
        case 'music': return 'E175';
        default: return 'E195';
    }
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
}

/**
 * Job Item Component
 */
class JobItem extends Container {
    private _job: GenerationJob;
    private _progressBar: Progress;
    private _statusLabel: Label;
    private _timeLabel: Label;
    private _updateInterval: number | null = null;

    constructor(job: GenerationJob) {
        super({ class: 'job-item' });
        this._job = job;
        this._buildUI();
        this._startTimeUpdates();
    }

    private _buildUI(): void {
        // Icon
        const icon = new Label({
            text: '',
            class: 'job-item-icon'
        });
        icon.dom.innerHTML = `<span style="font-family: 'pc-icon'; font-size: 16px;">&#x${getMediaTypeIcon(this._job.mediaType).slice(1)};</span>`;
        this.append(icon);

        // Info container
        const info = new Container({ class: 'job-item-info' });

        // Title row
        const titleRow = new Container({ class: 'job-item-title-row' });

        const typeLabel = new Label({
            text: this._job.mediaType.toUpperCase(),
            class: 'job-item-type'
        });
        titleRow.append(typeLabel);

        this._statusLabel = new Label({
            text: this._job.status.replace('_', ' '),
            class: 'job-item-status'
        });
        this._statusLabel.dom.style.color = getStatusColor(this._job.status);
        titleRow.append(this._statusLabel);

        info.append(titleRow);

        // Progress bar
        this._progressBar = new Progress({
            value: this._job.progress / 100,
            class: 'job-item-progress'
        });
        info.append(this._progressBar);

        // Details row
        const detailsRow = new Container({ class: 'job-item-details' });

        this._timeLabel = new Label({
            text: formatRelativeTime(this._job.createdAt),
            class: 'job-item-time'
        });
        detailsRow.append(this._timeLabel);

        if (this._job.creditsCost) {
            const costLabel = new Label({
                text: `${this._job.creditsCost}cr`,
                class: 'job-item-cost'
            });
            detailsRow.append(costLabel);
        }

        info.append(detailsRow);
        this.append(info);
    }

    private _startTimeUpdates(): void {
        this._updateInterval = window.setInterval(() => {
            this._timeLabel.text = formatRelativeTime(this._job.createdAt);
        }, 10000);
    }

    update(job: GenerationJob): void {
        this._job = job;
        this._statusLabel.text = job.status.replace('_', ' ');
        this._statusLabel.dom.style.color = getStatusColor(job.status);
        this._progressBar.value = job.progress / 100;
    }

    destroy(): void {
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
        }
        super.destroy();
    }
}

/**
 * Active Jobs Panel
 */
export class ActiveJobsPanel extends Panel {
    private _jobItems: Map<string, JobItem> = new Map();
    private _emptyLabel: Label;
    private _unsubscribe: (() => void) | null = null;

    constructor() {
        super({
            headerText: 'ACTIVE GENERATIONS',
            collapsible: true,
            collapsed: false,
            class: 'active-jobs-panel'
        });

        this._buildUI();
        this._subscribeToJobs();
        this._addStyles();
    }

    private _buildUI(): void {
        // Empty state label
        this._emptyLabel = new Label({
            text: 'No active generations',
            class: 'active-jobs-empty'
        });
        this.append(this._emptyLabel);

        // Refresh button in header
        const refreshBtn = new Button({
            icon: 'E134',
            class: 'active-jobs-refresh-btn'
        });
        refreshBtn.on('click', () => this._refresh());

        // Add to header
        const header = this.dom.querySelector('.pcui-panel-header');
        if (header) {
            header.appendChild(refreshBtn.dom);
        }

        // Load initial jobs
        this._loadJobs();
    }

    private _subscribeToJobs(): void {
        this._unsubscribe = jobsManager.on((event) => {
            switch (event.type) {
                case 'job:added':
                    this._addJobItem(event.job);
                    break;
                case 'job:updated':
                    this._updateJobItem(event.job);
                    break;
                case 'job:completed':
                case 'job:failed':
                    this._updateJobItem(event.job);
                    break;
                case 'job:removed':
                    this._removeJobItem(event.job.requestId);
                    break;
            }
        });
    }

    private async _loadJobs(): Promise<void> {
        const jobs = jobsManager.getActiveJobs();
        jobs.forEach(job => this._addJobItem(job));
        this._updateEmptyState();
    }

    private async _refresh(): Promise<void> {
        await jobsManager.refresh();
        this._updateEmptyState();
    }

    private _addJobItem(job: GenerationJob): void {
        if (this._jobItems.has(job.requestId)) return;

        const item = new JobItem(job);
        this._jobItems.set(job.requestId, item);
        this.append(item);
        this._updateEmptyState();
    }

    private _updateJobItem(job: GenerationJob): void {
        const item = this._jobItems.get(job.requestId);
        if (item) {
            item.update(job);
        }
    }

    private _removeJobItem(requestId: string): void {
        const item = this._jobItems.get(requestId);
        if (item) {
            item.destroy();
            this._jobItems.delete(requestId);
            this._updateEmptyState();
        }
    }

    private _updateEmptyState(): void {
        this._emptyLabel.hidden = this._jobItems.size > 0;
    }

    private _addStyles(): void {
        const styleId = 'pajamadot-active-jobs-panel-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .active-jobs-panel {
                margin-bottom: 10px;
            }

            .active-jobs-panel .pcui-panel-header {
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1));
                position: relative;
            }

            .active-jobs-refresh-btn {
                position: absolute;
                right: 30px;
                top: 50%;
                transform: translateY(-50%);
                width: 24px;
                height: 24px;
                min-width: 24px;
                padding: 0;
            }

            .active-jobs-empty {
                color: #666;
                font-size: 11px;
                text-align: center;
                padding: 12px;
            }

            .job-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 10px;
                border-bottom: 1px solid #2a2a2a;
            }

            .job-item:last-child {
                border-bottom: none;
            }

            .job-item-icon {
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(99, 102, 241, 0.15);
                border-radius: 6px;
                color: #a5b4fc;
            }

            .job-item-info {
                flex: 1;
                min-width: 0;
            }

            .job-item-title-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 4px;
            }

            .job-item-type {
                font-size: 10px;
                font-weight: 600;
                color: #a5b4fc;
                letter-spacing: 0.5px;
            }

            .job-item-status {
                font-size: 10px;
                font-weight: 500;
                text-transform: capitalize;
            }

            .job-item-progress {
                height: 4px;
                margin-bottom: 4px;
            }

            .job-item-progress .pcui-progress-inner {
                background: linear-gradient(90deg, #3b82f6, #8b5cf6);
            }

            .job-item-details {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .job-item-time {
                font-size: 10px;
                color: #666;
            }

            .job-item-cost {
                font-size: 10px;
                color: #a855f7;
                font-weight: 500;
            }
        `;
        document.head.appendChild(styles);
    }

    destroy(): void {
        if (this._unsubscribe) {
            this._unsubscribe();
        }
        this._jobItems.forEach(item => item.destroy());
        this._jobItems.clear();
        super.destroy();
    }
}

// Track panel instance
let activeJobsPanelInstance: ActiveJobsPanel | null = null;

/**
 * Show/hide the active jobs panel
 */
function toggleActiveJobsPanel(): void {
    if (activeJobsPanelInstance) {
        activeJobsPanelInstance.collapsed = !activeJobsPanelInstance.collapsed;
    }
}

/**
 * Initialize active jobs panel
 */
function initActiveJobsPanel(): void {
    // Add to AIGC panel area if available
    const aigcPanel = editor.call('layout.aigc') || editor.call('layout.right');
    if (!aigcPanel) {
        console.warn('[PajamaDot] Cannot find panel to attach active jobs');
        return;
    }

    activeJobsPanelInstance = new ActiveJobsPanel();

    // Insert at top of panel
    if (aigcPanel.dom.firstChild) {
        aigcPanel.dom.insertBefore(activeJobsPanelInstance.dom, aigcPanel.dom.firstChild);
    } else {
        aigcPanel.append(activeJobsPanelInstance);
    }

    // Register method to toggle panel
    editor.method('pajamadot:panel:activejobs:toggle', toggleActiveJobsPanel);

    console.log('[PajamaDot] Active jobs panel initialized');
}

// Initialize on editor load
editor.once('load', () => {
    setTimeout(() => {
        initActiveJobsPanel();
    }, 1000);
});
