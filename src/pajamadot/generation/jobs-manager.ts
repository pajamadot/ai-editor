/**
 * Generation Jobs Manager
 * Tracks active generation jobs and provides real-time updates
 */

import { generationClient } from './generation-client';
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

    constructor() {
        // Auto-start polling when initialized
        this._initializePolling();
    }

    private _initializePolling(): void {
        // Start polling after a short delay
        setTimeout(() => {
            this._checkActiveJobs();
        }, 1000);
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
                    console.warn(`[JobsManager] Failed to poll job ${job.requestId}:`, e);
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
     * Check for any active jobs on startup
     */
    private async _checkActiveJobs(): Promise<void> {
        try {
            const hasToken = editor.call('pajamadot:hasToken');
            if (!hasToken) return;

            const jobs = await generationClient.getActiveJobs();

            for (const job of jobs) {
                if (!this._activeJobs.has(job.requestId)) {
                    this._activeJobs.set(job.requestId, job);
                    this._emit({ type: 'job:added', job });
                }
            }

            if (this._activeJobs.size > 0 && !this._pollInterval) {
                this._startPolling();
            }

            console.log(`[JobsManager] Found ${jobs.length} active jobs`);
        } catch (e) {
            console.warn('[JobsManager] Failed to check active jobs:', e);
        }
    }

    /**
     * Refresh active jobs from server
     */
    async refresh(): Promise<void> {
        await this._checkActiveJobs();
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
