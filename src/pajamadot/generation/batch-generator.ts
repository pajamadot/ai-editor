/**
 * Batch Generator
 * AIGC module for generating multiple assets in parallel
 *
 * Supports:
 * - Batch image generation
 * - Batch texture generation
 * - Batch audio generation
 * - Progress tracking for all items
 */

import { generationClient } from './generation-client';
import { textureClient } from './texture-client';
import { audioClient } from './audio-client';
import { musicClient } from './music-client';
import { jobsManager } from './jobs-manager';
import type { GenerationJob, GenerationJobStatus, MediaType } from './types';

/**
 * Batch item definition
 */
export interface BatchItem {
    id: string;
    prompt: string;
    type: 'image' | 'texture' | 'audio' | 'music';
    options?: Record<string, any>;
}

/**
 * Batch item result
 */
export interface BatchItemResult {
    id: string;
    success: boolean;
    url?: string;
    assetId?: string;
    error?: string;
    creditsCost?: number;
}

/**
 * Batch generation options
 */
export interface BatchGenerationOptions {
    concurrency?: number;        // Max concurrent generations (default: 3)
    onItemComplete?: (item: BatchItemResult, index: number, total: number) => void;
    onItemStart?: (item: BatchItem, index: number, total: number) => void;
    onProgress?: (completed: number, total: number) => void;
}

/**
 * Batch generation result
 */
export interface BatchGenerationResult {
    success: boolean;
    totalItems: number;
    completedItems: number;
    failedItems: number;
    results: BatchItemResult[];
    totalCreditsCost: number;
}

/**
 * Batch Generator class
 * Manages parallel generation of multiple assets
 */
class BatchGenerator {
    private _activeGenerations = 0;
    private _maxConcurrency = 3;

    /**
     * Generate multiple items in batch
     *
     * @param items - Array of batch items to generate
     * @param options - Batch generation options
     * @returns Batch generation result
     */
    async generateBatch(
        items: BatchItem[],
        options: BatchGenerationOptions = {}
    ): Promise<BatchGenerationResult> {
        const concurrency = options.concurrency ?? this._maxConcurrency;
        const results: BatchItemResult[] = [];
        let completedCount = 0;
        let failedCount = 0;
        let totalCreditsCost = 0;

        // Create a queue for processing
        const queue = [...items];
        const processing: Promise<void>[] = [];

        const processItem = async (item: BatchItem, index: number): Promise<void> => {
            try {
                // Notify start
                options.onItemStart?.(item, index, items.length);

                // Generate based on type
                const result = await this._generateItem(item);
                results.push(result);

                if (result.success) {
                    completedCount++;
                    if (result.creditsCost) {
                        totalCreditsCost += result.creditsCost;
                    }
                } else {
                    failedCount++;
                }

                // Notify completion
                options.onItemComplete?.(result, index, items.length);
                options.onProgress?.(completedCount + failedCount, items.length);
            } catch (error) {
                const errorResult: BatchItemResult = {
                    id: item.id,
                    success: false,
                    error: error instanceof Error ? error.message : 'Generation failed'
                };
                results.push(errorResult);
                failedCount++;
                options.onItemComplete?.(errorResult, index, items.length);
                options.onProgress?.(completedCount + failedCount, items.length);
            }
        };

        // Process items with concurrency limit
        let itemIndex = 0;
        while (queue.length > 0 || processing.length > 0) {
            // Start new generations up to concurrency limit
            while (queue.length > 0 && processing.length < concurrency) {
                const item = queue.shift()!;
                const currentIndex = itemIndex++;
                const promise = processItem(item, currentIndex).then(() => {
                    // Remove from processing array when done
                    const idx = processing.indexOf(promise);
                    if (idx !== -1) {
                        processing.splice(idx, 1);
                    }
                });
                processing.push(promise);
            }

            // Wait for at least one to complete before continuing
            if (processing.length > 0) {
                await Promise.race(processing);
            }
        }

        return {
            success: failedCount === 0,
            totalItems: items.length,
            completedItems: completedCount,
            failedItems: failedCount,
            results,
            totalCreditsCost
        };
    }

    /**
     * Generate a single batch item
     */
    private async _generateItem(item: BatchItem): Promise<BatchItemResult> {
        try {
            let result: any;

            switch (item.type) {
                case 'image':
                    result = await generationClient.generateImage({
                        prompt: item.prompt,
                        model: item.options?.model || 'flux-schnell',
                        aspectRatio: item.options?.aspectRatio || '1:1'
                    });
                    break;

                case 'texture':
                    result = await textureClient.generateTexture({
                        prompt: item.prompt,
                        style: item.options?.style || 'photorealistic',
                        resolution: item.options?.resolution || 1024
                    });
                    break;

                case 'audio':
                    if (item.options?.mode === 'sfx') {
                        result = await audioClient.generateSoundEffect({
                            prompt: item.prompt,
                            duration: item.options?.duration || 5
                        });
                    } else {
                        result = await audioClient.generateSpeech({
                            text: item.prompt,
                            voiceStyle: item.options?.voiceStyle || 'neutral',
                            voiceGender: item.options?.voiceGender || 'female'
                        });
                    }
                    break;

                case 'music':
                    result = await musicClient.generateMusic({
                        prompt: item.prompt,
                        genre: item.options?.genre || 'ambient',
                        mood: item.options?.mood || 'peaceful',
                        duration: item.options?.duration || 30,
                        loopable: item.options?.loopable ?? true
                    });
                    break;

                default:
                    throw new Error(`Unknown batch item type: ${item.type}`);
            }

            // Check result format
            if (result.success === false) {
                return {
                    id: item.id,
                    success: false,
                    error: result.error || 'Generation failed'
                };
            }

            // Handle sync result
            if (result.imageUrl || result.audioUrl || result.textureUrl) {
                return {
                    id: item.id,
                    success: true,
                    url: result.imageUrl || result.audioUrl || result.textureUrl,
                    assetId: result.assetId,
                    creditsCost: result.creditsCost
                };
            }

            // Handle async job (return job ID for tracking)
            if (result.requestId) {
                return {
                    id: item.id,
                    success: true,
                    assetId: result.requestId,
                    creditsCost: result.creditsCost
                };
            }

            return {
                id: item.id,
                success: false,
                error: 'Unexpected result format'
            };
        } catch (error) {
            return {
                id: item.id,
                success: false,
                error: error instanceof Error ? error.message : 'Generation failed'
            };
        }
    }

    /**
     * Create batch items from prompts
     *
     * @param prompts - Array of prompts
     * @param type - Generation type for all items
     * @param options - Shared options for all items
     * @returns Array of batch items
     */
    createBatchItems(
        prompts: string[],
        type: BatchItem['type'],
        options?: Record<string, any>
    ): BatchItem[] {
        return prompts.map((prompt, index) => ({
            id: `batch_${Date.now()}_${index}`,
            prompt,
            type,
            options
        }));
    }

    /**
     * Estimate credits for a batch
     *
     * @param items - Array of batch items
     * @returns Estimated total credits
     */
    estimateBatchCredits(items: BatchItem[]): number {
        let total = 0;

        for (const item of items) {
            switch (item.type) {
                case 'image':
                    total += 4; // Flux Schnell base cost
                    break;
                case 'texture':
                    total += 8; // Single texture cost
                    break;
                case 'audio':
                    if (item.options?.mode === 'sfx') {
                        total += 8; // SFX cost
                    } else {
                        // TTS cost estimate based on text length
                        total += Math.max(5, Math.ceil(item.prompt.length / 100) * 5);
                    }
                    break;
                case 'music':
                    const duration = item.options?.duration || 30;
                    total += Math.ceil(duration / 30) * 15; // 15 credits per 30s
                    break;
            }
        }

        return total;
    }
}

// Singleton instance
const batchGenerator = new BatchGenerator();

export { BatchGenerator, batchGenerator };
