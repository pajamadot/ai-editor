/**
 * VN AIGC Integration
 * AI-Generated Content integration for Visual Novel assets
 *
 * Provides easy-to-use APIs for generating:
 * - Character portraits and expressions
 * - Background scenes and CGs
 * - Voice lines and narration
 * - Background music and sound effects
 * - Animated character sprites
 */

import type { StoryCharacterData } from '../types/character';
import type { StoryLocationData } from '../types/location';
import type { VNCharacterAssets, VNLocationAssets, VNAssetRef } from './vn-types';

// Import generation clients
import { textureClient, TextureStyle } from '../generation/texture-client';
import { audioClient, type VoiceStyle, type VoiceGender } from '../generation/audio-client';
import { musicClient, type MusicPreset } from '../generation/music-client';
import { imageEditorClient } from '../generation/image-editor-client';
import { batchGenerator } from '../generation/batch-generator';
import { assetImporter } from '../generation/asset-importer';
import { jobsManager } from '../generation/jobs-manager';

/**
 * Character expression types commonly used in VNs
 */
export type VNExpression =
    | 'neutral'
    | 'happy'
    | 'sad'
    | 'angry'
    | 'surprised'
    | 'embarrassed'
    | 'scared'
    | 'confident'
    | 'thinking'
    | 'crying'
    | 'laughing'
    | 'blushing'
    | 'smirking'
    | 'determined';

/**
 * Character portrait generation request
 */
export interface CharacterPortraitRequest {
    character: StoryCharacterData;
    expressions: VNExpression[];
    style: 'anime' | 'realistic' | 'cartoon' | 'painterly';
    size: '512x512' | '768x768' | '1024x1024';
    variants?: number; // Number of variants per expression
    referenceImage?: string; // URL to reference image for consistency
}

/**
 * Background generation request
 */
export interface BackgroundRequest {
    location: StoryLocationData;
    timeOfDay: 'morning' | 'day' | 'evening' | 'night';
    weather?: 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog';
    style: 'anime' | 'realistic' | 'painterly' | 'pixel';
    aspectRatio: '16:9' | '4:3' | '21:9';
    variants?: number;
}

/**
 * CG (Computer Graphics - full scene illustration) request
 */
export interface CGRequest {
    scene: {
        description: string;
        characters: StoryCharacterData[];
        location?: StoryLocationData;
    };
    mood: 'romantic' | 'dramatic' | 'comedic' | 'mysterious' | 'action';
    style: 'anime' | 'realistic' | 'painterly';
    aspectRatio: '16:9' | '4:3';
}

/**
 * Voice generation request
 */
export interface VoiceRequest {
    character: StoryCharacterData;
    lines: string[];
    voiceStyle: VoiceStyle;
    emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'scared';
    speed?: number;
    cloneFromUrl?: string;
}

/**
 * BGM generation request
 */
export interface BGMRequest {
    location?: StoryLocationData;
    mood: 'peaceful' | 'tense' | 'romantic' | 'mysterious' | 'action' | 'sad';
    preset?: string;
    duration?: number;
    loopable?: boolean;
}

/**
 * SFX generation request
 */
export interface SFXRequest {
    description: string;
    category: 'ui' | 'ambient' | 'action' | 'voice';
    duration?: number;
}

/**
 * Generation result
 */
export interface GenerationResult<T = any> {
    success: boolean;
    data?: T;
    assetId?: string;
    url?: string;
    error?: string;
    creditsCost: number;
}

/**
 * Batch generation result
 */
export interface BatchGenerationResult<T = any> {
    total: number;
    successful: number;
    failed: number;
    results: GenerationResult<T>[];
}

/**
 * VN AIGC Integration class
 * Provides high-level APIs for generating VN assets
 */
class VNAIGCIntegration {
    private defaultCharacterStyle: 'anime' | 'realistic' | 'cartoon' | 'painterly' = 'anime';
    private defaultBackgroundStyle: 'anime' | 'realistic' | 'painterly' | 'pixel' = 'anime';

    /**
     * Set default character style
     */
    setDefaultCharacterStyle(style: 'anime' | 'realistic' | 'cartoon' | 'painterly'): void {
        this.defaultCharacterStyle = style;
    }

    /**
     * Set default background style
     */
    setDefaultBackgroundStyle(style: 'anime' | 'realistic' | 'painterly' | 'pixel'): void {
        this.defaultBackgroundStyle = style;
    }

    // ========================================================================
    // Character Generation
    // ========================================================================

    /**
     * Generate character portrait with multiple expressions
     */
    async generateCharacterPortraits(
        request: CharacterPortraitRequest,
        onProgress?: (current: number, total: number, message: string) => void
    ): Promise<BatchGenerationResult> {
        const results: GenerationResult[] = [];
        const style = request.style || this.defaultCharacterStyle;
        const totalExpressions = request.expressions.length * (request.variants || 1);
        let current = 0;

        // Build character description from data
        const charDesc = this.buildCharacterDescription(request.character);

        for (const expression of request.expressions) {
            const variantCount = request.variants || 1;

            for (let v = 0; v < variantCount; v++) {
                current++;
                onProgress?.(current, totalExpressions, `Generating ${expression} expression...`);

                try {
                    const prompt = this.buildPortraitPrompt(charDesc, expression, style);

                    const result = await textureClient.generateTexture({
                        prompt,
                        negativePrompt: this.getCharacterNegativePrompt(),
                        style: style as TextureStyle,
                        width: parseInt(request.size.split('x')[0]),
                        height: parseInt(request.size.split('x')[1]),
                        referenceImageUrl: request.referenceImage
                    });

                    if ('imageUrl' in result && result.imageUrl) {
                        // Import to PlayCanvas
                        const asset = await assetImporter.importTextureFromUrl(
                            result.imageUrl,
                            `${request.character.name}_${expression}${v > 0 ? `_v${v}` : ''}`
                        );

                        results.push({
                            success: true,
                            data: { expression, variant: v },
                            assetId: asset?.id?.toString(),
                            url: result.imageUrl,
                            creditsCost: result.creditsCost || 0
                        });
                    } else {
                        results.push({
                            success: false,
                            error: 'No image URL in response',
                            creditsCost: 0
                        });
                    }
                } catch (error: any) {
                    results.push({
                        success: false,
                        error: error.message || 'Generation failed',
                        creditsCost: 0
                    });
                }
            }
        }

        return {
            total: totalExpressions,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        };
    }

    /**
     * Generate a single character portrait
     */
    async generateCharacterPortrait(
        character: StoryCharacterData,
        expression: VNExpression,
        options: {
            style?: 'anime' | 'realistic' | 'cartoon' | 'painterly';
            size?: '512x512' | '768x768' | '1024x1024';
            referenceImage?: string;
        } = {}
    ): Promise<GenerationResult> {
        const style = options.style || this.defaultCharacterStyle;
        const charDesc = this.buildCharacterDescription(character);
        const prompt = this.buildPortraitPrompt(charDesc, expression, style);

        try {
            const result = await textureClient.generateTexture({
                prompt,
                negativePrompt: this.getCharacterNegativePrompt(),
                style: style as TextureStyle,
                width: parseInt((options.size || '768x768').split('x')[0]),
                height: parseInt((options.size || '768x768').split('x')[1]),
                referenceImageUrl: options.referenceImage
            });

            if ('imageUrl' in result && result.imageUrl) {
                const asset = await assetImporter.importTextureFromUrl(
                    result.imageUrl,
                    `${character.name}_${expression}`
                );

                return {
                    success: true,
                    data: { expression },
                    assetId: asset?.id?.toString(),
                    url: result.imageUrl,
                    creditsCost: result.creditsCost || 0
                };
            }

            return {
                success: false,
                error: 'No image URL in response',
                creditsCost: 0
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Generation failed',
                creditsCost: 0
            };
        }
    }

    /**
     * Generate expression variations from base portrait
     */
    async generateExpressionFromBase(
        baseImageUrl: string,
        targetExpression: VNExpression,
        characterName: string
    ): Promise<GenerationResult> {
        const prompt = `Change facial expression to ${targetExpression}, keep all other features identical`;

        try {
            const result = await imageEditorClient.inpaint({
                imageUrl: baseImageUrl,
                prompt,
                strength: 0.6
            });

            if ('imageUrl' in result && result.imageUrl) {
                const asset = await assetImporter.importTextureFromUrl(
                    result.imageUrl,
                    `${characterName}_${targetExpression}`
                );

                return {
                    success: true,
                    data: { expression: targetExpression },
                    assetId: asset?.id?.toString(),
                    url: result.imageUrl,
                    creditsCost: result.creditsCost || 0
                };
            }

            return {
                success: false,
                error: 'No image URL in response',
                creditsCost: 0
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                creditsCost: 0
            };
        }
    }

    // ========================================================================
    // Background Generation
    // ========================================================================

    /**
     * Generate background scene
     */
    async generateBackground(
        request: BackgroundRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<GenerationResult> {
        const style = request.style || this.defaultBackgroundStyle;
        const prompt = this.buildBackgroundPrompt(
            request.location,
            request.timeOfDay,
            request.weather,
            style
        );

        const aspectDimensions: Record<string, { width: number; height: number }> = {
            '16:9': { width: 1920, height: 1080 },
            '4:3': { width: 1600, height: 1200 },
            '21:9': { width: 2560, height: 1080 }
        };

        const dims = aspectDimensions[request.aspectRatio] || aspectDimensions['16:9'];

        try {
            onProgress?.(10, 'Generating background...');

            const result = await textureClient.generateTexture({
                prompt,
                negativePrompt: this.getBackgroundNegativePrompt(),
                style: style as TextureStyle,
                width: dims.width,
                height: dims.height,
                seamless: false,
                tileable: false
            });

            if ('imageUrl' in result && result.imageUrl) {
                onProgress?.(80, 'Importing to project...');

                const asset = await assetImporter.importTextureFromUrl(
                    result.imageUrl,
                    `bg_${request.location.name}_${request.timeOfDay}`
                );

                onProgress?.(100, 'Complete!');

                return {
                    success: true,
                    data: { timeOfDay: request.timeOfDay, weather: request.weather },
                    assetId: asset?.id?.toString(),
                    url: result.imageUrl,
                    creditsCost: result.creditsCost || 0
                };
            }

            return {
                success: false,
                error: 'No image URL in response',
                creditsCost: 0
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                creditsCost: 0
            };
        }
    }

    /**
     * Generate all time-of-day variants for a location
     */
    async generateBackgroundSet(
        location: StoryLocationData,
        options: {
            style?: 'anime' | 'realistic' | 'painterly' | 'pixel';
            aspectRatio?: '16:9' | '4:3' | '21:9';
            includeWeather?: boolean;
        } = {},
        onProgress?: (current: number, total: number, message: string) => void
    ): Promise<BatchGenerationResult> {
        const timesOfDay: Array<'morning' | 'day' | 'evening' | 'night'> = [
            'morning', 'day', 'evening', 'night'
        ];

        const results: GenerationResult[] = [];
        let current = 0;
        const total = timesOfDay.length;

        for (const timeOfDay of timesOfDay) {
            current++;
            onProgress?.(current, total, `Generating ${timeOfDay}...`);

            const result = await this.generateBackground({
                location,
                timeOfDay,
                style: options.style || this.defaultBackgroundStyle,
                aspectRatio: options.aspectRatio || '16:9'
            });

            results.push(result);
        }

        return {
            total,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        };
    }

    // ========================================================================
    // CG Generation
    // ========================================================================

    /**
     * Generate CG (full scene illustration)
     */
    async generateCG(
        request: CGRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<GenerationResult> {
        const prompt = this.buildCGPrompt(request);
        const aspectDimensions: Record<string, { width: number; height: number }> = {
            '16:9': { width: 1920, height: 1080 },
            '4:3': { width: 1600, height: 1200 }
        };

        const dims = aspectDimensions[request.aspectRatio] || aspectDimensions['16:9'];

        try {
            onProgress?.(10, 'Generating CG...');

            const result = await textureClient.generateTexture({
                prompt,
                negativePrompt: this.getCGNegativePrompt(),
                style: request.style as TextureStyle,
                width: dims.width,
                height: dims.height
            });

            if ('imageUrl' in result && result.imageUrl) {
                onProgress?.(80, 'Importing to project...');

                const asset = await assetImporter.importTextureFromUrl(
                    result.imageUrl,
                    `cg_${Date.now()}`
                );

                onProgress?.(100, 'Complete!');

                return {
                    success: true,
                    data: { mood: request.mood },
                    assetId: asset?.id?.toString(),
                    url: result.imageUrl,
                    creditsCost: result.creditsCost || 0
                };
            }

            return {
                success: false,
                error: 'No image URL in response',
                creditsCost: 0
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                creditsCost: 0
            };
        }
    }

    // ========================================================================
    // Voice Generation
    // ========================================================================

    /**
     * Generate voice lines for a character
     */
    async generateVoiceLines(
        request: VoiceRequest,
        onProgress?: (current: number, total: number, message: string) => void
    ): Promise<BatchGenerationResult> {
        const results: GenerationResult[] = [];
        const total = request.lines.length;

        for (let i = 0; i < request.lines.length; i++) {
            onProgress?.(i + 1, total, `Generating line ${i + 1}...`);

            try {
                const result = await audioClient.generateTTS({
                    text: request.lines[i],
                    voiceStyle: request.voiceStyle,
                    speed: request.speed || 1.0,
                    voiceUrl: request.cloneFromUrl
                });

                if ('audioUrl' in result && result.audioUrl) {
                    const asset = await assetImporter.importAudioFromUrl(
                        result.audioUrl,
                        `voice_${request.character.name}_${i + 1}`
                    );

                    results.push({
                        success: true,
                        data: { lineIndex: i, text: request.lines[i] },
                        assetId: asset?.id?.toString(),
                        url: result.audioUrl,
                        creditsCost: result.creditsCost || 0
                    });
                } else {
                    results.push({
                        success: false,
                        error: 'No audio URL in response',
                        creditsCost: 0
                    });
                }
            } catch (error: any) {
                results.push({
                    success: false,
                    error: error.message,
                    creditsCost: 0
                });
            }
        }

        return {
            total,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        };
    }

    /**
     * Generate a single voice line
     */
    async generateVoiceLine(
        character: StoryCharacterData,
        text: string,
        options: {
            voiceStyle?: VoiceStyle;
            emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'scared';
            speed?: number;
        } = {}
    ): Promise<GenerationResult> {
        try {
            const result = await audioClient.generateTTS({
                text,
                voiceStyle: options.voiceStyle || 'conversational',
                speed: options.speed || 1.0
            });

            if ('audioUrl' in result && result.audioUrl) {
                const asset = await assetImporter.importAudioFromUrl(
                    result.audioUrl,
                    `voice_${character.name}_${Date.now()}`
                );

                return {
                    success: true,
                    data: { text },
                    assetId: asset?.id?.toString(),
                    url: result.audioUrl,
                    creditsCost: result.creditsCost || 0
                };
            }

            return {
                success: false,
                error: 'No audio URL in response',
                creditsCost: 0
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                creditsCost: 0
            };
        }
    }

    // ========================================================================
    // Music Generation
    // ========================================================================

    /**
     * Generate background music
     */
    async generateBGM(
        request: BGMRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<GenerationResult> {
        try {
            onProgress?.(10, 'Generating music...');

            // Find matching preset or use custom settings
            const moodToPreset: Record<string, string> = {
                'peaceful': 'peaceful-town',
                'tense': 'suspense',
                'romantic': 'romantic',
                'mysterious': 'mystery',
                'action': 'battle',
                'sad': 'emotional-scene'
            };

            const presetId = request.preset || moodToPreset[request.mood] || 'ambient';

            const result = await musicClient.generateFromPreset(
                presetId,
                {
                    duration: request.duration,
                    loopable: request.loopable
                },
                (progress, message) => onProgress?.(10 + progress * 0.7, message)
            );

            if ('audioUrl' in result && result.audioUrl) {
                onProgress?.(90, 'Importing to project...');

                const asset = await assetImporter.importAudioFromUrl(
                    result.audioUrl,
                    `bgm_${request.mood}_${Date.now()}`
                );

                onProgress?.(100, 'Complete!');

                return {
                    success: true,
                    data: { mood: request.mood, preset: presetId },
                    assetId: asset?.id?.toString(),
                    url: result.audioUrl,
                    creditsCost: result.creditsCost || 0
                };
            }

            return {
                success: false,
                error: 'No audio URL in response',
                creditsCost: 0
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                creditsCost: 0
            };
        }
    }

    /**
     * Generate sound effect
     */
    async generateSFX(
        request: SFXRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<GenerationResult> {
        try {
            onProgress?.(10, 'Generating sound effect...');

            const result = await audioClient.generateSFX({
                description: request.description,
                duration: request.duration || 3,
                category: request.category
            });

            if ('audioUrl' in result && result.audioUrl) {
                onProgress?.(80, 'Importing to project...');

                const asset = await assetImporter.importAudioFromUrl(
                    result.audioUrl,
                    `sfx_${request.category}_${Date.now()}`
                );

                onProgress?.(100, 'Complete!');

                return {
                    success: true,
                    data: { description: request.description },
                    assetId: asset?.id?.toString(),
                    url: result.audioUrl,
                    creditsCost: result.creditsCost || 0
                };
            }

            return {
                success: false,
                error: 'No audio URL in response',
                creditsCost: 0
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                creditsCost: 0
            };
        }
    }

    // ========================================================================
    // Batch Operations
    // ========================================================================

    /**
     * Generate complete character asset set
     */
    async generateCompleteCharacter(
        character: StoryCharacterData,
        options: {
            expressions?: VNExpression[];
            style?: 'anime' | 'realistic' | 'cartoon' | 'painterly';
            generateVoice?: boolean;
            voiceStyle?: VoiceStyle;
            sampleLines?: string[];
        } = {},
        onProgress?: (phase: string, current: number, total: number) => void
    ): Promise<{
        portraits: BatchGenerationResult;
        voice?: BatchGenerationResult;
    }> {
        const expressions = options.expressions || [
            'neutral', 'happy', 'sad', 'angry', 'surprised'
        ];

        onProgress?.('portraits', 0, expressions.length);

        // Generate portraits
        const portraits = await this.generateCharacterPortraits({
            character,
            expressions,
            style: options.style || this.defaultCharacterStyle,
            size: '768x768'
        }, (current, total, _msg) => {
            onProgress?.('portraits', current, total);
        });

        let voice: BatchGenerationResult | undefined;

        // Generate voice samples if requested
        if (options.generateVoice && options.sampleLines?.length) {
            onProgress?.('voice', 0, options.sampleLines.length);

            voice = await this.generateVoiceLines({
                character,
                lines: options.sampleLines,
                voiceStyle: options.voiceStyle || 'conversational'
            }, (current, total, _msg) => {
                onProgress?.('voice', current, total);
            });
        }

        return { portraits, voice };
    }

    /**
     * Generate complete location asset set
     */
    async generateCompleteLocation(
        location: StoryLocationData,
        options: {
            style?: 'anime' | 'realistic' | 'painterly' | 'pixel';
            generateBGM?: boolean;
            bgmMood?: 'peaceful' | 'tense' | 'romantic' | 'mysterious' | 'action' | 'sad';
            generateAmbient?: boolean;
        } = {},
        onProgress?: (phase: string, current: number, total: number) => void
    ): Promise<{
        backgrounds: BatchGenerationResult;
        bgm?: GenerationResult;
        ambient?: GenerationResult;
    }> {
        onProgress?.('backgrounds', 0, 4);

        // Generate backgrounds for all times of day
        const backgrounds = await this.generateBackgroundSet(
            location,
            { style: options.style || this.defaultBackgroundStyle },
            (current, total, _msg) => {
                onProgress?.('backgrounds', current, total);
            }
        );

        let bgm: GenerationResult | undefined;
        let ambient: GenerationResult | undefined;

        // Generate BGM if requested
        if (options.generateBGM) {
            onProgress?.('bgm', 0, 1);
            bgm = await this.generateBGM({
                location,
                mood: options.bgmMood || 'peaceful',
                loopable: true
            });
            onProgress?.('bgm', 1, 1);
        }

        // Generate ambient sound if requested
        if (options.generateAmbient) {
            onProgress?.('ambient', 0, 1);
            ambient = await this.generateSFX({
                description: `Ambient sound for ${location.description || location.name}`,
                category: 'ambient',
                duration: 30
            });
            onProgress?.('ambient', 1, 1);
        }

        return { backgrounds, bgm, ambient };
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private buildCharacterDescription(character: StoryCharacterData): string {
        const parts: string[] = [];

        parts.push(character.name);

        if (character.bio?.appearance) {
            parts.push(character.bio.appearance);
        }

        if (character.bio?.age) {
            parts.push(`${character.bio.age} years old`);
        }

        if (character.bio?.gender) {
            parts.push(character.bio.gender);
        }

        return parts.join(', ');
    }

    private buildPortraitPrompt(
        charDesc: string,
        expression: VNExpression,
        style: string
    ): string {
        const expressionDescriptions: Record<VNExpression, string> = {
            'neutral': 'calm neutral expression, relaxed face',
            'happy': 'bright smile, happy eyes, joyful expression',
            'sad': 'downcast eyes, slight frown, melancholic expression',
            'angry': 'furrowed brows, intense glare, angry expression',
            'surprised': 'wide eyes, raised eyebrows, open mouth, shocked expression',
            'embarrassed': 'blushing cheeks, averted gaze, shy expression',
            'scared': 'frightened eyes, trembling, fearful expression',
            'confident': 'proud smirk, confident posture, self-assured expression',
            'thinking': 'contemplative look, hand on chin, pondering expression',
            'crying': 'tears streaming, sad eyes, crying expression',
            'laughing': 'open mouth laughing, closed eyes, gleeful expression',
            'blushing': 'red cheeks, shy smile, flustered expression',
            'smirking': 'one-sided smile, knowing look, smug expression',
            'determined': 'focused eyes, set jaw, resolute expression'
        };

        const styleModifiers: Record<string, string> = {
            'anime': 'anime style, visual novel character art, clean lines, vibrant colors',
            'realistic': 'realistic portrait, photorealistic, detailed face',
            'cartoon': 'cartoon style, bold outlines, expressive',
            'painterly': 'oil painting style, artistic, brush strokes visible'
        };

        return `Portrait of ${charDesc}, ${expressionDescriptions[expression]}, ${styleModifiers[style]}, upper body, facing viewer, high quality, detailed`;
    }

    private buildBackgroundPrompt(
        location: StoryLocationData,
        timeOfDay: string,
        weather: string | undefined,
        style: string
    ): string {
        const timeModifiers: Record<string, string> = {
            'morning': 'soft morning light, sunrise, golden hour',
            'day': 'bright daylight, clear sky, midday sun',
            'evening': 'warm sunset colors, orange sky, dusk',
            'night': 'dark night, moonlight, stars, night time'
        };

        const weatherModifiers: Record<string, string> = {
            'clear': 'clear sky',
            'cloudy': 'overcast, cloudy sky',
            'rain': 'rainy, wet surfaces, rain drops',
            'snow': 'snowing, snow covered, winter',
            'fog': 'foggy, misty, atmospheric haze'
        };

        const styleModifiers: Record<string, string> = {
            'anime': 'anime background art, visual novel background, detailed',
            'realistic': 'photorealistic environment, detailed scenery',
            'painterly': 'digital painting, artistic background',
            'pixel': 'pixel art, retro game style, 16-bit aesthetic'
        };

        let prompt = `${location.description || location.name}, ${timeModifiers[timeOfDay]}`;

        if (weather && weatherModifiers[weather]) {
            prompt += `, ${weatherModifiers[weather]}`;
        }

        prompt += `, ${styleModifiers[style]}, no characters, environment only, wide shot, high quality`;

        return prompt;
    }

    private buildCGPrompt(request: CGRequest): string {
        const moodDescriptions: Record<string, string> = {
            'romantic': 'romantic atmosphere, soft lighting, intimate moment',
            'dramatic': 'dramatic scene, intense lighting, emotional moment',
            'comedic': 'lighthearted scene, bright colors, funny moment',
            'mysterious': 'mysterious atmosphere, shadows, suspenseful',
            'action': 'dynamic action scene, motion blur, intense'
        };

        let prompt = request.scene.description;

        // Add character descriptions
        if (request.scene.characters.length > 0) {
            const charDescs = request.scene.characters.map(c =>
                this.buildCharacterDescription(c)
            );
            prompt += `, featuring ${charDescs.join(' and ')}`;
        }

        // Add location if specified
        if (request.scene.location) {
            prompt += `, set in ${request.scene.location.description || request.scene.location.name}`;
        }

        prompt += `, ${moodDescriptions[request.mood]}`;
        prompt += `, ${request.style} style, cinematic composition, high quality illustration`;

        return prompt;
    }

    private getCharacterNegativePrompt(): string {
        return 'blurry, low quality, deformed, bad anatomy, extra limbs, duplicate, cropped, watermark, text';
    }

    private getBackgroundNegativePrompt(): string {
        return 'people, characters, figures, blurry, low quality, text, watermark, signature';
    }

    private getCGNegativePrompt(): string {
        return 'blurry, low quality, deformed, bad anatomy, amateur, poorly drawn, watermark';
    }

    // ========================================================================
    // Job Management
    // ========================================================================

    /**
     * Get all active generation jobs
     */
    getActiveJobs(): any[] {
        return jobsManager.getActiveJobs();
    }

    /**
     * Cancel a generation job
     */
    cancelJob(requestId: string): boolean {
        return jobsManager.cancelJob(requestId);
    }

    /**
     * Get total credits used in current session
     */
    getSessionCreditsUsed(): number {
        const jobs = jobsManager.getAllJobs();
        return jobs.reduce((total, job) => total + (job.creditsCost || 0), 0);
    }
}

// Singleton instance
const vnAIGC = new VNAIGCIntegration();

export { vnAIGC, VNAIGCIntegration };
