/**
 * Generation Presets Manager
 * AIGC module for saving and managing generation presets
 *
 * Supports:
 * - Custom presets for each generation type
 * - Built-in presets for common use cases
 * - Preset import/export
 * - Persistent storage in localStorage
 */

/**
 * Generation type for presets
 */
export type PresetType = 'image' | 'texture' | 'mesh' | 'video' | 'audio' | 'music';

/**
 * Preset definition
 */
export interface GenerationPreset {
    id: string;
    name: string;
    description?: string;
    type: PresetType;
    isBuiltIn: boolean;
    prompt?: string;
    options: Record<string, any>;
    createdAt: number;
    updatedAt: number;
}

/**
 * Built-in image presets
 */
const IMAGE_PRESETS: GenerationPreset[] = [
    {
        id: 'image-game-icon',
        name: 'Game Icon',
        description: 'Clean icons for games with transparent background',
        type: 'image',
        isBuiltIn: true,
        options: {
            aspectRatio: '1:1',
            style: 'realistic',
            promptSuffix: ', game icon, clean design, transparent background, high quality'
        },
        createdAt: 0,
        updatedAt: 0
    },
    {
        id: 'image-ui-button',
        name: 'UI Button',
        description: 'Game UI button graphics',
        type: 'image',
        isBuiltIn: true,
        options: {
            aspectRatio: '16:9',
            style: 'fantasy',
            promptSuffix: ', game UI button, clean edges, fantasy style, high quality'
        },
        createdAt: 0,
        updatedAt: 0
    },
    {
        id: 'image-character-portrait',
        name: 'Character Portrait',
        description: 'Character portraits for RPGs',
        type: 'image',
        isBuiltIn: true,
        options: {
            aspectRatio: '3:4',
            style: 'painted',
            promptSuffix: ', character portrait, detailed face, fantasy art style, RPG character'
        },
        createdAt: 0,
        updatedAt: 0
    },
    {
        id: 'image-item-card',
        name: 'Item Card',
        description: 'Item cards for inventory systems',
        type: 'image',
        isBuiltIn: true,
        options: {
            aspectRatio: '3:4',
            style: 'painted',
            promptSuffix: ', item card art, centered object, clean background, game item'
        },
        createdAt: 0,
        updatedAt: 0
    }
];

/**
 * Built-in texture presets
 */
const TEXTURE_PRESETS: GenerationPreset[] = [
    {
        id: 'texture-ground',
        name: 'Ground/Floor',
        description: 'Seamless ground textures',
        type: 'texture',
        isBuiltIn: true,
        options: {
            resolution: 1024,
            style: 'photorealistic',
            promptSuffix: ', seamless tile, top-down view, ground texture'
        },
        createdAt: 0,
        updatedAt: 0
    },
    {
        id: 'texture-wall',
        name: 'Wall',
        description: 'Seamless wall textures',
        type: 'texture',
        isBuiltIn: true,
        options: {
            resolution: 1024,
            style: 'photorealistic',
            promptSuffix: ', seamless tile, front view, wall texture'
        },
        createdAt: 0,
        updatedAt: 0
    },
    {
        id: 'texture-metal',
        name: 'Metal Surface',
        description: 'Metallic surface textures',
        type: 'texture',
        isBuiltIn: true,
        options: {
            resolution: 1024,
            style: 'photorealistic',
            promptSuffix: ', seamless tile, metal surface, metallic sheen'
        },
        createdAt: 0,
        updatedAt: 0
    },
    {
        id: 'texture-stylized',
        name: 'Stylized/Cartoon',
        description: 'Cartoon-style textures',
        type: 'texture',
        isBuiltIn: true,
        options: {
            resolution: 512,
            style: 'stylized',
            promptSuffix: ', seamless tile, cartoon style, hand-painted look'
        },
        createdAt: 0,
        updatedAt: 0
    }
];

/**
 * Built-in mesh presets
 */
const MESH_PRESETS: GenerationPreset[] = [
    {
        id: 'mesh-lowpoly',
        name: 'Low-Poly Model',
        description: 'Simplified low-poly 3D models',
        type: 'mesh',
        isBuiltIn: true,
        options: {
            mode: 'text_to_3d',
            polycount: 5000,
            style: 'lowpoly',
            promptSuffix: ', low-poly style, simple geometry, game asset'
        },
        createdAt: 0,
        updatedAt: 0
    },
    {
        id: 'mesh-realistic',
        name: 'Realistic Model',
        description: 'Detailed realistic 3D models',
        type: 'mesh',
        isBuiltIn: true,
        options: {
            mode: 'text_to_3d',
            polycount: 20000,
            style: 'realistic',
            promptSuffix: ', high detail, realistic proportions, PBR textures'
        },
        createdAt: 0,
        updatedAt: 0
    },
    {
        id: 'mesh-prop',
        name: 'Environment Prop',
        description: 'Props for game environments',
        type: 'mesh',
        isBuiltIn: true,
        options: {
            mode: 'text_to_3d',
            polycount: 8000,
            style: 'realistic',
            promptSuffix: ', game prop, environment asset, optimized for games'
        },
        createdAt: 0,
        updatedAt: 0
    }
];

/**
 * Built-in video presets
 */
const VIDEO_PRESETS: GenerationPreset[] = [
    {
        id: 'video-cinematic',
        name: 'Cinematic Scene',
        description: 'Cinematic video for cutscenes',
        type: 'video',
        isBuiltIn: true,
        options: {
            style: 'cinematic',
            motion: 'moderate',
            duration: 5,
            aspectRatio: '16:9'
        },
        createdAt: 0,
        updatedAt: 0
    },
    {
        id: 'video-environment',
        name: 'Environment Flythrough',
        description: 'Smooth environment flythroughs',
        type: 'video',
        isBuiltIn: true,
        options: {
            style: 'cinematic',
            motion: 'gentle',
            duration: 10,
            aspectRatio: '16:9',
            promptSuffix: ', smooth camera movement, environment flythrough'
        },
        createdAt: 0,
        updatedAt: 0
    },
    {
        id: 'video-action',
        name: 'Action Sequence',
        description: 'Dynamic action sequences',
        type: 'video',
        isBuiltIn: true,
        options: {
            style: 'cinematic',
            motion: 'dynamic',
            duration: 5,
            aspectRatio: '16:9',
            promptSuffix: ', dynamic action, fast paced'
        },
        createdAt: 0,
        updatedAt: 0
    }
];

/**
 * Built-in audio presets
 */
const AUDIO_PRESETS: GenerationPreset[] = [
    {
        id: 'audio-narrator',
        name: 'Narrator Voice',
        description: 'Professional narrator voice',
        type: 'audio',
        isBuiltIn: true,
        options: {
            mode: 'tts',
            voiceStyle: 'neutral',
            voiceGender: 'male',
            speed: 0.9
        },
        createdAt: 0,
        updatedAt: 0
    },
    {
        id: 'audio-character',
        name: 'Character Dialogue',
        description: 'Expressive character voice',
        type: 'audio',
        isBuiltIn: true,
        options: {
            mode: 'tts',
            voiceStyle: 'happy',
            voiceGender: 'female',
            speed: 1.0
        },
        createdAt: 0,
        updatedAt: 0
    },
    {
        id: 'audio-sfx-footsteps',
        name: 'Footsteps SFX',
        description: 'Walking/running footsteps',
        type: 'audio',
        isBuiltIn: true,
        prompt: 'footsteps on hard floor, walking rhythm',
        options: {
            mode: 'sfx',
            duration: 5
        },
        createdAt: 0,
        updatedAt: 0
    },
    {
        id: 'audio-sfx-ambient',
        name: 'Ambient SFX',
        description: 'Background ambient sounds',
        type: 'audio',
        isBuiltIn: true,
        prompt: 'ambient background noise',
        options: {
            mode: 'sfx',
            duration: 10
        },
        createdAt: 0,
        updatedAt: 0
    }
];

const STORAGE_KEY = 'pajamadot_generation_presets';

/**
 * Presets Manager class
 * Manages generation presets with local storage persistence
 */
class PresetsManager {
    private _presets: Map<string, GenerationPreset> = new Map();
    private _initialized = false;

    constructor() {
        this._loadPresets();
    }

    /**
     * Initialize and load presets from storage
     */
    private _loadPresets(): void {
        if (this._initialized) return;

        // Load built-in presets
        const builtInPresets = [
            ...IMAGE_PRESETS,
            ...TEXTURE_PRESETS,
            ...MESH_PRESETS,
            ...VIDEO_PRESETS,
            ...AUDIO_PRESETS
        ];

        for (const preset of builtInPresets) {
            this._presets.set(preset.id, preset);
        }

        // Load custom presets from localStorage
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const customPresets: GenerationPreset[] = JSON.parse(stored);
                for (const preset of customPresets) {
                    this._presets.set(preset.id, preset);
                }
            }
        } catch (error) {
            console.warn('[PresetsManager] Failed to load custom presets:', error);
        }

        this._initialized = true;
    }

    /**
     * Save custom presets to storage
     */
    private _savePresets(): void {
        try {
            const customPresets = Array.from(this._presets.values())
                .filter(p => !p.isBuiltIn);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
        } catch (error) {
            console.warn('[PresetsManager] Failed to save presets:', error);
        }
    }

    /**
     * Get all presets
     */
    getAllPresets(): GenerationPreset[] {
        return Array.from(this._presets.values());
    }

    /**
     * Get presets by type
     */
    getPresetsByType(type: PresetType): GenerationPreset[] {
        return Array.from(this._presets.values())
            .filter(p => p.type === type);
    }

    /**
     * Get a specific preset
     */
    getPreset(id: string): GenerationPreset | undefined {
        return this._presets.get(id);
    }

    /**
     * Create a new custom preset
     */
    createPreset(preset: Omit<GenerationPreset, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>): GenerationPreset {
        const newPreset: GenerationPreset = {
            ...preset,
            id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            isBuiltIn: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this._presets.set(newPreset.id, newPreset);
        this._savePresets();

        return newPreset;
    }

    /**
     * Update an existing preset
     */
    updatePreset(id: string, updates: Partial<GenerationPreset>): GenerationPreset | null {
        const preset = this._presets.get(id);
        if (!preset || preset.isBuiltIn) {
            return null;
        }

        const updatedPreset: GenerationPreset = {
            ...preset,
            ...updates,
            id: preset.id, // Keep original ID
            isBuiltIn: false,
            createdAt: preset.createdAt,
            updatedAt: Date.now()
        };

        this._presets.set(id, updatedPreset);
        this._savePresets();

        return updatedPreset;
    }

    /**
     * Delete a custom preset
     */
    deletePreset(id: string): boolean {
        const preset = this._presets.get(id);
        if (!preset || preset.isBuiltIn) {
            return false;
        }

        this._presets.delete(id);
        this._savePresets();

        return true;
    }

    /**
     * Apply preset to get generation options
     */
    applyPreset(presetId: string, prompt: string): { prompt: string; options: Record<string, any> } | null {
        const preset = this._presets.get(presetId);
        if (!preset) return null;

        let finalPrompt = preset.prompt || prompt;
        if (preset.options.promptSuffix) {
            finalPrompt = `${finalPrompt}${preset.options.promptSuffix}`;
        }

        return {
            prompt: finalPrompt,
            options: { ...preset.options }
        };
    }

    /**
     * Export presets as JSON
     */
    exportPresets(ids?: string[]): string {
        const presetsToExport = ids
            ? Array.from(this._presets.values()).filter(p => ids.includes(p.id))
            : Array.from(this._presets.values()).filter(p => !p.isBuiltIn);

        return JSON.stringify(presetsToExport, null, 2);
    }

    /**
     * Import presets from JSON
     */
    importPresets(json: string): { imported: number; errors: number } {
        let imported = 0;
        let errors = 0;

        try {
            const presets: GenerationPreset[] = JSON.parse(json);

            for (const preset of presets) {
                try {
                    // Create as new custom preset
                    this.createPreset({
                        name: preset.name,
                        description: preset.description,
                        type: preset.type,
                        prompt: preset.prompt,
                        options: preset.options
                    });
                    imported++;
                } catch {
                    errors++;
                }
            }
        } catch {
            errors++;
        }

        return { imported, errors };
    }

    /**
     * Get built-in presets only
     */
    getBuiltInPresets(): GenerationPreset[] {
        return Array.from(this._presets.values()).filter(p => p.isBuiltIn);
    }

    /**
     * Get custom presets only
     */
    getCustomPresets(): GenerationPreset[] {
        return Array.from(this._presets.values()).filter(p => !p.isBuiltIn);
    }
}

// Singleton instance
const presetsManager = new PresetsManager();

export { PresetsManager, presetsManager };
