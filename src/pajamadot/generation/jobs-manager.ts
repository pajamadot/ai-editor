/**
 * Generation Jobs Manager
 * Tracks active generation jobs and provides real-time updates
 */

import { generationClient } from './generation-client';
import { assetImporter } from './asset-importer';
import type { GenerationJob, GenerationJobStatus, MediaType } from './types';

declare const editor: any;

// Event types for job updates
type JobEventType = 'job:added' | 'job:updated' | 'job:completed' | 'job:failed' | 'job:removed';

interface JobEvent {
    type: JobEventType;
    job: GenerationJob;
}

type JobEventListener = (event: JobEvent) => void;

/**
 * Jobs Manager Class
 * Singleton that manages active generation jobs and polls for updates
 */
class JobsManager {
    private _activeJobs: Map<string, GenerationJob> = new Map();
    private _listeners: Set<JobEventListener> = new Set();
    private _pollInterval: number | null = null;
    private _pollFrequency = 2000; // 2 seconds
    private _isPolling = false;
    private _initialized = false;

    constructor() {
        // Fetch active jobs from backend on initialization
        this._initializeFromBackend();
    }

    /**
     * Initialize by fetching active jobs from backend
     */
    private async _initializeFromBackend(): Promise<void> {
        // Wait a short delay for the editor to fully load
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            await this._fetchActiveJobsFromBackend();
            this._initialized = true;
        } catch (e) {
            console.warn('[JobsManager] Failed to fetch jobs from backend:', e);
            this._initialized = true; // Still mark as initialized to allow new jobs
        }
    }

    /**
     * Fetch active (pending/in_progress) jobs from backend
     */
    private async _fetchActiveJobsFromBackend(): Promise<void> {
        try {
            // Fetch pending jobs
            const pendingResponse = await generationClient.listJobs({
                status: 'pending',
                limit: 50
            });

            // Fetch in_progress jobs
            const inProgressResponse = await generationClient.listJobs({
                status: 'in_progress',
                limit: 50
            });

            const allJobs = [
                ...pendingResponse.generations,
                ...inProgressResponse.generations
            ];

            console.log(`[JobsManager] Fetched ${allJobs.length} active jobs from backend`);

            // Add jobs to tracking
            allJobs.forEach(job => {
                if (!this._activeJobs.has(job.requestId)) {
                    this._activeJobs.set(job.requestId, job);
                    this._emit({ type: 'job:added', job });
                }
            });

            // Start polling if we have active jobs
            if (allJobs.length > 0 && !this._pollInterval) {
                this._startPolling();
            }
        } catch (e) {
            console.warn('[JobsManager] Failed to fetch active jobs:', e);
            throw e;
        }
    }

    /**
     * Add a job to track
     */
    addJob(job: GenerationJob): void {
        this._activeJobs.set(job.requestId, job);
        this._emit({ type: 'job:added', job });

        // Start polling if not already
        if (!this._pollInterval) {
            this._startPolling();
        }
    }

    /**
     * Remove a job from tracking
     */
    removeJob(requestId: string): void {
        const job = this._activeJobs.get(requestId);
        if (job) {
            this._activeJobs.delete(requestId);
            this._emit({ type: 'job:removed', job });
        }

        // Stop polling if no more jobs
        if (this._activeJobs.size === 0 && this._pollInterval) {
            this._stopPolling();
        }
    }

    /**
     * Get all active jobs
     */
    getActiveJobs(): GenerationJob[] {
        return Array.from(this._activeJobs.values());
    }

    /**
     * Get a specific job by ID
     */
    getJob(requestId: string): GenerationJob | undefined {
        return this._activeJobs.get(requestId);
    }

    /**
     * Get count of active jobs
     */
    getActiveCount(): number {
        return this._activeJobs.size;
    }

    /**
     * Check if any jobs are in progress
     */
    hasActiveJobs(): boolean {
        return this._activeJobs.size > 0;
    }

    /**
     * Subscribe to job events
     */
    on(listener: JobEventListener): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    /**
     * Emit an event to all listeners
     */
    private _emit(event: JobEvent): void {
        this._listeners.forEach(listener => {
            try {
                listener(event);
            } catch (e) {
                console.error('[JobsManager] Listener error:', e);
            }
        });

        // Also emit to editor for global listeners
        try {
            editor.emit(`pajamadot:${event.type}`, event.job);
        } catch (e) {
            // Editor might not be ready
        }
    }

    /**
     * Start polling for job updates
     */
    private _startPolling(): void {
        if (this._pollInterval) return;

        this._pollInterval = window.setInterval(() => {
            this._pollJobs();
        }, this._pollFrequency);

        console.log('[JobsManager] Started polling');
    }

    /**
     * Stop polling
     */
    private _stopPolling(): void {
        if (this._pollInterval) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
            console.log('[JobsManager] Stopped polling');
        }
    }

    /**
     * Poll all active jobs for updates
     */
    private async _pollJobs(): Promise<void> {
        if (this._isPolling) return;
        this._isPolling = true;

        try {
            const jobs = Array.from(this._activeJobs.values());

            for (const job of jobs) {
                if (job.status === 'completed' || job.status === 'failed') {
                    // Skip already completed jobs
                    continue;
                }

                try {
                    const updated = await generationClient.getJobStatus(job.requestId);
                    this._updateJob(updated);
                } catch (e) {
                    const errorMessage = e instanceof Error ? e.message : String(e);

                    // If job not found (404), mark as failed and stop polling
                    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
                        console.warn(`[JobsManager] Job ${job.requestId} not found, marking as failed`);
                        const failedJob: GenerationJob = {
                            ...job,
                            status: 'failed',
                            errorMessage: 'Job not found on server - may have expired or failed to save'
                        };
                        this._activeJobs.set(job.requestId, failedJob);
                        this._emit({ type: 'job:failed', job: failedJob });
                        // Remove from tracking after a delay
                        setTimeout(() => this.removeJob(job.requestId), 10000);
                    } else {
                        console.warn(`[JobsManager] Failed to poll job ${job.requestId}:`, e);
                    }
                }
            }
        } finally {
            this._isPolling = false;
        }
    }

    /**
     * Update a job with new data
     */
    private _updateJob(updated: GenerationJob): void {
        const existing = this._activeJobs.get(updated.requestId);
        if (!existing) return;

        // Check if status changed
        const statusChanged = existing.status !== updated.status;

        // Update the job
        this._activeJobs.set(updated.requestId, updated);

        if (updated.status === 'completed') {
            this._emit({ type: 'job:completed', job: updated });

            // Auto-import mesh/3d_model jobs when completed
            // These take 3-10 minutes, so users expect automatic asset creation
            if (updated.generatedUrl && (updated.mediaType === 'mesh' || updated.mediaType === '3d_model')) {
                this._autoImportJob(updated);
            }

            // Remove from active jobs after completion
            setTimeout(() => this.removeJob(updated.requestId), 5000);
        } else if (updated.status === 'failed') {
            this._emit({ type: 'job:failed', job: updated });
            // Remove from active jobs after failure
            setTimeout(() => this.removeJob(updated.requestId), 10000);
        } else if (statusChanged || updated.progress !== existing.progress) {
            this._emit({ type: 'job:updated', job: updated });
        }
    }

    /**
     * Auto-import a completed job's generated asset into PlayCanvas
     * Used for mesh/3d_model jobs that take a long time to generate
     */
    private async _autoImportJob(job: GenerationJob): Promise<void> {
        if (!job.generatedUrl) return;

        try {
            console.log(`[JobsManager] Auto-importing completed ${job.mediaType} job:`, job.requestId);

            const folder = await assetImporter.getOrCreateAIGCFolder();
            const prompt = String(job.input?.prompt || 'generated');
            const baseName = prompt
                .slice(0, 30)
                .replace(/[^a-zA-Z0-9 ]/g, '')
                .trim()
                .replace(/\s+/g, '_') || 'generated';

            const timestamp = Date.now().toString(36);
            const assetName = `${baseName}_${timestamp}`;

            const result = await assetImporter.importModelFromUrl(job.generatedUrl, assetName, {
                folder: folder,
                tags: ['aigc', 'mesh', '3d-model', 'auto-imported']
            });

            if (result.success) {
                console.log('[JobsManager] Auto-imported mesh asset:', assetName, 'assetId:', result.assetId);
                // Notify user via editor message
                if (typeof editor !== 'undefined' && editor.call) {
                    editor.call('realtime:notify', {
                        type: 'success',
                        title: '3D Model Generated',
                        message: `Auto-imported: ${assetName}`,
                        duration: 5000
                    });
                }
            } else {
                console.error('[JobsManager] Auto-import failed:', result.error);
            }
        } catch (error) {
            console.error('[JobsManager] Auto-import error:', error);
        }
    }

    /**
     * Check for any active jobs on startup - now fetches from backend
     */
    private async _checkActiveJobs(): Promise<void> {
        await this._fetchActiveJobsFromBackend();
    }

    /**
     * Refresh active jobs from server
     */
    async refresh(): Promise<void> {
        await this._fetchActiveJobsFromBackend();
    }

    /**
     * Get jobs by media type
     */
    getJobsByType(mediaType: MediaType): GenerationJob[] {
        return this.getActiveJobs().filter(job => job.mediaType === mediaType);
    }

    /**
     * Get jobs by status
     */
    getJobsByStatus(status: GenerationJobStatus): GenerationJob[] {
        return this.getActiveJobs().filter(job => job.status === status);
    }

    /**
     * Cleanup and destroy
     */
    destroy(): void {
        this._stopPolling();
        this._activeJobs.clear();
        this._listeners.clear();
    }
}

// Singleton instance
const jobsManager = new JobsManager();

// Register methods with editor
const registerJobsManagerMethods = (): void => {
    // Safe method registration to avoid duplicate registration errors
    const safeMethod = (name: string, fn: (...args: any[]) => any) => {
        try {
            editor.method(name, fn);
        } catch (e) {
            // Method already registered, ignore
        }
    };

    safeMethod('pajamadot:jobs:add', (job: GenerationJob) => {
        jobsManager.addJob(job);
    });

    safeMethod('pajamadot:jobs:remove', (requestId: string) => {
        jobsManager.removeJob(requestId);
    });

    safeMethod('pajamadot:jobs:get', (requestId: string) => {
        return jobsManager.getJob(requestId);
    });

    safeMethod('pajamadot:jobs:getActive', () => {
        return jobsManager.getActiveJobs();
    });

    safeMethod('pajamadot:jobs:getCount', () => {
        return jobsManager.getActiveCount();
    });

    safeMethod('pajamadot:jobs:hasActive', () => {
        return jobsManager.hasActiveJobs();
    });

    safeMethod('pajamadot:jobs:refresh', async () => {
        await jobsManager.refresh();
    });

    safeMethod('pajamadot:jobs:subscribe', (listener: JobEventListener) => {
        return jobsManager.on(listener);
    });

    console.log('[PajamaDot] Jobs manager methods registered');
};

// Initialize on editor load
editor.once('load', () => {
    setTimeout(() => {
        registerJobsManagerMethods();
    }, 500);
});

export { JobsManager, jobsManager };
