/**
 * PlayCanvas Asset Importer
 * Utility module for importing AI-generated assets into PlayCanvas Editor
 */

declare const editor: any;

/**
 * Asset types supported by PlayCanvas
 */
export type PlayCanvasAssetType =
    | 'texture'
    | 'material'
    | 'model'
    | 'container'  // For GLB/GLTF
    | 'animation'
    | 'audio'
    | 'json'
    | 'script'
    | 'shader'
    | 'cubemap';

/**
 * Options for creating PlayCanvas assets
 */
export interface AssetCreateOptions {
    name: string;
    type: PlayCanvasAssetType;
    file?: File | Blob;
    data?: any;
    source?: boolean;
    preload?: boolean;
    folder?: any; // PlayCanvas folder asset
    tags?: string[];
}

/**
 * Result of asset import
 */
export interface ImportResult {
    success: boolean;
    asset?: any; // PlayCanvas Asset
    assetId?: number;
    error?: string;
}

/**
 * Material creation options
 */
export interface MaterialOptions {
    name: string;
    diffuseMap?: any; // texture asset
    normalMap?: any;
    glossMap?: any;   // roughness/smoothness
    emissiveMap?: any;
    opacityMap?: any;
    metalness?: number;
    shininess?: number;
    useMetalness?: boolean;
}

/**
 * PlayCanvas Asset Importer
 * Handles importing AI-generated textures, models, and materials
 */
class AssetImporter {
    /**
     * Import a texture from URL into PlayCanvas
     *
     * @param imageUrl - URL of the image to import
     * @param name - Name for the texture asset
     * @param options - Additional options
     * @returns Imported texture asset
     */
    async importTextureFromUrl(
        imageUrl: string,
        name: string,
        options?: {
            folder?: any;
            tags?: string[];
        }
    ): Promise<ImportResult> {
        try {
            // Fetch the image as a blob
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
            }
            const blob = await response.blob();

            // Detect content type and extension
            const contentType = blob.type || response.headers.get('content-type') || 'image/png';
            const ext = this._getExtensionFromMimeType(contentType);

            // Convert blob to file with correct type
            const file = new File([blob], `${name}${ext}`, { type: contentType });

            // Import into PlayCanvas
            return await this.importTexture(file, name, options);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to import texture'
            };
        }
    }

    /**
     * Get file extension from MIME type
     */
    private _getExtensionFromMimeType(mimeType: string): string {
        const mimeToExt: Record<string, string> = {
            'image/png': '.png',
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/webp': '.webp',
            'image/gif': '.gif',
            'image/bmp': '.bmp',
            'image/tiff': '.tiff'
        };
        return mimeToExt[mimeType.toLowerCase()] || '.png';
    }

    /**
     * Import a texture file into PlayCanvas
     *
     * @param file - Image file to import
     * @param name - Name for the texture asset
     * @param options - Additional options
     * @returns Imported texture asset
     */
    async importTexture(
        file: File | Blob,
        name: string,
        options?: {
            folder?: any;
            tags?: string[];
        }
    ): Promise<ImportResult> {
        return new Promise((resolve) => {
            // Ensure file has proper name with extension
            let fileName = name;
            if (file instanceof File) {
                fileName = file.name;
            } else {
                // For Blob, ensure we have an extension
                const ext = this._getExtensionFromMimeType((file as Blob).type || 'image/png');
                if (!name.toLowerCase().endsWith(ext)) {
                    fileName = `${name}${ext}`;
                }
            }

            // Convert Blob to File if needed (PlayCanvas needs File object)
            const uploadFile = file instanceof File ? file : new File([file], fileName, { type: file.type || 'image/png' });

            console.log('[AssetImporter] Uploading texture:', fileName, 'type:', uploadFile.type);

            // Use assets:uploadFile for proper texture creation via pipeline
            // NOT passing 'asset' triggers assetCreate instead of assetUpdate
            editor.call('assets:uploadFile', {
                file: uploadFile,
                type: 'texture',
                name: fileName,
                parent: options?.folder || null,
                pipeline: true,
                preload: true
            }, (err: Error | null, data: any) => {
                if (err) {
                    console.error('[AssetImporter] Texture upload error:', err);
                    resolve({
                        success: false,
                        error: typeof err === 'string' ? err : err.message
                    });
                } else {
                    console.log('[AssetImporter] Texture upload response:', data);

                    // Wait for asset to be available in the assets list
                    const assetId = data?.id;
                    if (assetId) {
                        // Try to get the asset, it might not be immediately available
                        const checkAsset = () => {
                            const asset = editor.call('assets:get', assetId);
                            if (asset) {
                                // Add AIGC tag
                                if (options?.tags && options.tags.length > 0) {
                                    const existingTags = asset.get('tags') || [];
                                    asset.set('tags', [...existingTags, ...options.tags]);
                                }
                                console.log('[AssetImporter] Texture created:', assetId, asset.get('type'));
                                resolve({
                                    success: true,
                                    asset: asset,
                                    assetId: assetId
                                });
                            } else {
                                // Wait a bit and try again
                                setTimeout(checkAsset, 100);
                            }
                        };
                        checkAsset();
                    } else {
                        resolve({
                            success: true,
                            assetId: data?.id
                        });
                    }
                }
            });
        });
    }

    /**
     * Import a GLB/GLTF model from URL into PlayCanvas
     *
     * @param modelUrl - URL of the GLB/GLTF model
     * @param name - Name for the model asset
     * @param options - Additional options
     * @returns Imported model asset
     */
    async importModelFromUrl(
        modelUrl: string,
        name: string,
        options?: {
            folder?: any;
            tags?: string[];
        }
    ): Promise<ImportResult> {
        try {
            // Fetch the model as a blob
            const response = await fetch(modelUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch model: ${response.status}`);
            }
            const blob = await response.blob();

            // Convert blob to file
            const file = new File([blob], `${name}.glb`, { type: 'model/gltf-binary' });

            // Import into PlayCanvas
            return await this.importModel(file, name, options);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to import model'
            };
        }
    }

    /**
     * Import a model file into PlayCanvas
     *
     * Uses assets:uploadFile with pipeline:true to properly process GLB files.
     * This triggers the asset pipeline which creates container assets with
     * embedded meshes, materials, and textures - not raw binary assets.
     *
     * @param file - Model file (GLB/GLTF) to import
     * @param name - Name for the model asset
     * @param options - Additional options
     * @returns Imported model asset (container with model hierarchy)
     */
    async importModel(
        file: File | Blob,
        name: string,
        options?: {
            folder?: any;
            tags?: string[];
        }
    ): Promise<ImportResult> {
        return new Promise((resolve) => {
            // Ensure file has proper name with .glb extension
            let fileName = name;
            if (!name.toLowerCase().endsWith('.glb') && !name.toLowerCase().endsWith('.gltf')) {
                fileName = `${name}.glb`;
            }

            // Convert Blob to File if needed (PlayCanvas needs File object with correct type)
            const uploadFile = file instanceof File
                ? file
                : new File([file], fileName, { type: 'model/gltf-binary' });

            console.log('[AssetImporter] Uploading GLB model:', fileName, 'type:', uploadFile.type, 'size:', uploadFile.size);

            // Use assets:uploadFile with pipeline:true for proper GLB processing
            // This triggers the asset pipeline which creates:
            // - A container asset with the model hierarchy
            // - Embedded model, material, and texture assets
            // - Proper mesh data (not raw binary)
            // NOTE: GLB files use type 'scene' (not 'container' or 'model')
            // The 'scene' type triggers PlayCanvas's model import pipeline
            editor.call('assets:uploadFile', {
                file: uploadFile,
                type: 'scene', // GLB files use 'scene' type for 3D model import pipeline
                name: fileName,
                parent: options?.folder || null,
                pipeline: true,   // CRITICAL: Process through asset pipeline
                preload: true
            }, (err: Error | null, data: any) => {
                if (err) {
                    console.error('[AssetImporter] Model upload error:', err);
                    resolve({
                        success: false,
                        error: typeof err === 'string' ? err : err.message
                    });
                } else {
                    console.log('[AssetImporter] Model upload response:', data);

                    // Wait for asset to be available in the assets list
                    const assetId = data?.id;
                    if (assetId) {
                        // Try to get the asset, it might not be immediately available
                        const checkAsset = () => {
                            const asset = editor.call('assets:get', assetId);
                            if (asset) {
                                // Add AIGC tags
                                const baseTags = ['aigc', '3d-model', 'auto-imported'];
                                const allTags = options?.tags
                                    ? [...baseTags, ...options.tags]
                                    : baseTags;
                                const existingTags = asset.get('tags') || [];
                                const uniqueTags = [...new Set([...existingTags, ...allTags])];
                                asset.set('tags', uniqueTags);

                                console.log('[AssetImporter] Model created:', assetId, 'type:', asset.get('type'));
                                resolve({
                                    success: true,
                                    asset: asset,
                                    assetId: assetId
                                });
                            } else {
                                // Wait a bit and try again (pipeline processing takes time)
                                setTimeout(checkAsset, 200);
                            }
                        };
                        // Give the pipeline some time to start processing
                        setTimeout(checkAsset, 500);
                    } else {
                        resolve({
                            success: true,
                            assetId: data?.id
                        });
                    }
                }
            });
        });
    }

    /**
     * Create a material with imported textures
     *
     * @param options - Material creation options
     * @returns Created material asset
     */
    async createMaterial(options: MaterialOptions): Promise<ImportResult> {
        return new Promise((resolve) => {
            // Create a new standard material
            const materialData: any = {
                name: options.name,
                shader: 'standard'
            };

            // Set texture maps if provided
            if (options.diffuseMap) {
                materialData.diffuseMap = options.diffuseMap.get('id');
            }
            if (options.normalMap) {
                materialData.normalMap = options.normalMap.get('id');
            }
            if (options.glossMap) {
                materialData.glossMap = options.glossMap.get('id');
            }
            if (options.emissiveMap) {
                materialData.emissiveMap = options.emissiveMap.get('id');
            }
            if (options.opacityMap) {
                materialData.opacityMap = options.opacityMap.get('id');
            }

            // Set material properties
            if (options.metalness !== undefined) {
                materialData.metalness = options.metalness;
            }
            if (options.shininess !== undefined) {
                materialData.shininess = options.shininess;
            }
            if (options.useMetalness !== undefined) {
                materialData.useMetalness = options.useMetalness;
            }

            editor.call('assets:create', {
                name: options.name,
                type: 'material',
                data: materialData,
                preload: true
            }, (err: Error | null, asset: any) => {
                if (err) {
                    resolve({
                        success: false,
                        error: err.message
                    });
                } else {
                    resolve({
                        success: true,
                        asset: asset,
                        assetId: asset?.get('id')
                    });
                }
            });
        });
    }

    /**
     * Import PBR texture set and create material
     *
     * @param textures - Object containing diffuse, normal, roughness URLs
     * @param name - Base name for assets
     * @returns Created material and texture assets
     */
    async importPBRMaterial(
        textures: {
            diffuseUrl?: string;
            normalUrl?: string;
            roughnessUrl?: string;
        },
        name: string
    ): Promise<{
        success: boolean;
        material?: any;
        textures?: {
            diffuse?: any;
            normal?: any;
            roughness?: any;
        };
        error?: string;
    }> {
        try {
            const importedTextures: any = {};

            // Import diffuse texture
            if (textures.diffuseUrl) {
                const diffuseResult = await this.importTextureFromUrl(
                    textures.diffuseUrl,
                    `${name}_diffuse`,
                    { tags: ['aigc', 'diffuse'] }
                );
                if (diffuseResult.success) {
                    importedTextures.diffuse = diffuseResult.asset;
                }
            }

            // Import normal texture
            if (textures.normalUrl) {
                const normalResult = await this.importTextureFromUrl(
                    textures.normalUrl,
                    `${name}_normal`,
                    { tags: ['aigc', 'normal'] }
                );
                if (normalResult.success) {
                    importedTextures.normal = normalResult.asset;
                }
            }

            // Import roughness texture
            if (textures.roughnessUrl) {
                const roughnessResult = await this.importTextureFromUrl(
                    textures.roughnessUrl,
                    `${name}_roughness`,
                    { tags: ['aigc', 'roughness'] }
                );
                if (roughnessResult.success) {
                    importedTextures.roughness = roughnessResult.asset;
                }
            }

            // Create material with imported textures
            const materialResult = await this.createMaterial({
                name: `${name}_material`,
                diffuseMap: importedTextures.diffuse,
                normalMap: importedTextures.normal,
                glossMap: importedTextures.roughness,
                useMetalness: true
            });

            return {
                success: materialResult.success,
                material: materialResult.asset,
                textures: importedTextures,
                error: materialResult.error
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to import PBR material'
            };
        }
    }

    /**
     * Import a video from URL into PlayCanvas
     *
     * @param videoUrl - URL of the video to import
     * @param name - Name for the video asset
     * @param options - Additional options
     * @returns Imported video asset
     */
    async importVideoFromUrl(
        videoUrl: string,
        name: string,
        options?: {
            folder?: any;
            tags?: string[];
        }
    ): Promise<ImportResult> {
        try {
            // Fetch the video as a blob
            const response = await fetch(videoUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch video: ${response.status}`);
            }
            const blob = await response.blob();

            // Detect content type and extension
            const contentType = blob.type || response.headers.get('content-type') || 'video/mp4';
            const ext = this._getVideoExtension(contentType);

            // Convert blob to file
            const file = new File([blob], `${name}${ext}`, { type: contentType });

            // Import into PlayCanvas
            return await this.importVideo(file, name, options);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to import video'
            };
        }
    }

    /**
     * Get video file extension from MIME type
     */
    private _getVideoExtension(mimeType: string): string {
        const mimeToExt: Record<string, string> = {
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'video/ogg': '.ogv',
            'video/quicktime': '.mov'
        };
        return mimeToExt[mimeType.toLowerCase()] || '.mp4';
    }

    /**
     * Import a video file into PlayCanvas
     *
     * @param file - Video file to import
     * @param name - Name for the video asset
     * @param options - Additional options
     * @returns Imported video asset
     */
    async importVideo(
        file: File | Blob,
        name: string,
        options?: {
            folder?: any;
            tags?: string[];
        }
    ): Promise<ImportResult> {
        return new Promise((resolve) => {
            let fileName = name;
            if (!name.toLowerCase().match(/\.(mp4|webm|ogv|mov)$/)) {
                fileName = `${name}.mp4`;
            }

            const uploadFile = file instanceof File
                ? file
                : new File([file], fileName, { type: file.type || 'video/mp4' });

            console.log('[AssetImporter] Uploading video:', fileName, 'type:', uploadFile.type);

            // PlayCanvas doesn't have a native video asset type
            // We store it as a binary asset that can be referenced
            editor.call('assets:uploadFile', {
                file: uploadFile,
                type: 'binary', // Use binary for video files
                name: fileName,
                parent: options?.folder || null,
                preload: true
            }, (err: Error | null, data: any) => {
                if (err) {
                    console.error('[AssetImporter] Video upload error:', err);
                    resolve({
                        success: false,
                        error: typeof err === 'string' ? err : err.message
                    });
                } else {
                    console.log('[AssetImporter] Video upload response:', data);

                    const assetId = data?.id;
                    if (assetId) {
                        const checkAsset = () => {
                            const asset = editor.call('assets:get', assetId);
                            if (asset) {
                                const baseTags = ['aigc', 'video'];
                                const allTags = options?.tags
                                    ? [...new Set([...baseTags, ...options.tags])]
                                    : baseTags;
                                const existingTags = asset.get('tags') || [];
                                asset.set('tags', [...new Set([...existingTags, ...allTags])]);

                                console.log('[AssetImporter] Video created:', assetId);
                                resolve({
                                    success: true,
                                    asset: asset,
                                    assetId: assetId
                                });
                            } else {
                                setTimeout(checkAsset, 100);
                            }
                        };
                        checkAsset();
                    } else {
                        resolve({
                            success: true,
                            assetId: data?.id
                        });
                    }
                }
            });
        });
    }

    /**
     * Import an audio file from URL into PlayCanvas
     *
     * @param audioUrl - URL of the audio to import
     * @param name - Name for the audio asset
     * @param options - Additional options
     * @returns Imported audio asset
     */
    async importAudioFromUrl(
        audioUrl: string,
        name: string,
        options?: {
            folder?: any;
            tags?: string[];
        }
    ): Promise<ImportResult> {
        try {
            // Fetch the audio as a blob
            const response = await fetch(audioUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch audio: ${response.status}`);
            }
            const blob = await response.blob();

            // Detect content type and extension
            const contentType = blob.type || response.headers.get('content-type') || 'audio/mpeg';
            const ext = this._getAudioExtension(contentType);

            // Convert blob to file
            const file = new File([blob], `${name}${ext}`, { type: contentType });

            // Import into PlayCanvas
            return await this.importAudio(file, name, options);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to import audio'
            };
        }
    }

    /**
     * Get audio file extension from MIME type
     */
    private _getAudioExtension(mimeType: string): string {
        const mimeToExt: Record<string, string> = {
            'audio/mpeg': '.mp3',
            'audio/mp3': '.mp3',
            'audio/wav': '.wav',
            'audio/x-wav': '.wav',
            'audio/ogg': '.ogg',
            'audio/webm': '.webm',
            'audio/aac': '.aac',
            'audio/flac': '.flac'
        };
        return mimeToExt[mimeType.toLowerCase()] || '.mp3';
    }

    /**
     * Import an audio file into PlayCanvas
     *
     * @param file - Audio file to import
     * @param name - Name for the audio asset
     * @param options - Additional options
     * @returns Imported audio asset
     */
    async importAudio(
        file: File | Blob,
        name: string,
        options?: {
            folder?: any;
            tags?: string[];
        }
    ): Promise<ImportResult> {
        return new Promise((resolve) => {
            let fileName = name;
            if (!name.toLowerCase().match(/\.(mp3|wav|ogg|webm|aac|flac)$/)) {
                fileName = `${name}.mp3`;
            }

            const uploadFile = file instanceof File
                ? file
                : new File([file], fileName, { type: file.type || 'audio/mpeg' });

            console.log('[AssetImporter] Uploading audio:', fileName, 'type:', uploadFile.type);

            // Use audio type for proper audio asset creation
            editor.call('assets:uploadFile', {
                file: uploadFile,
                type: 'audio',
                name: fileName,
                parent: options?.folder || null,
                preload: true
            }, (err: Error | null, data: any) => {
                if (err) {
                    console.error('[AssetImporter] Audio upload error:', err);
                    resolve({
                        success: false,
                        error: typeof err === 'string' ? err : err.message
                    });
                } else {
                    console.log('[AssetImporter] Audio upload response:', data);

                    const assetId = data?.id;
                    if (assetId) {
                        const checkAsset = () => {
                            const asset = editor.call('assets:get', assetId);
                            if (asset) {
                                const baseTags = ['aigc', 'audio'];
                                const allTags = options?.tags
                                    ? [...new Set([...baseTags, ...options.tags])]
                                    : baseTags;
                                const existingTags = asset.get('tags') || [];
                                asset.set('tags', [...new Set([...existingTags, ...allTags])]);

                                console.log('[AssetImporter] Audio created:', assetId, asset.get('type'));
                                resolve({
                                    success: true,
                                    asset: asset,
                                    assetId: assetId
                                });
                            } else {
                                setTimeout(checkAsset, 100);
                            }
                        };
                        checkAsset();
                    } else {
                        resolve({
                            success: true,
                            assetId: data?.id
                        });
                    }
                }
            });
        });
    }

    /**
     * Create or get the AIGC assets folder
     *
     * @returns The AIGC folder asset
     */
    async getOrCreateAIGCFolder(): Promise<any> {
        return new Promise((resolve) => {
            // Try to find existing AIGC folder
            const assets = editor.call('assets:list');
            const aigcFolder = assets.find((asset: any) =>
                asset.get('type') === 'folder' && asset.get('name') === 'AIGC Generated'
            );

            if (aigcFolder) {
                resolve(aigcFolder);
                return;
            }

            // Create new AIGC folder
            editor.call('assets:create', {
                name: 'AIGC Generated',
                type: 'folder'
            }, (err: Error | null, folder: any) => {
                resolve(err ? null : folder);
            });
        });
    }

    /**
     * Get all assets with AIGC tag
     *
     * @returns Array of AIGC-generated assets
     */
    getAIGCAssets(): any[] {
        const assets = editor.call('assets:list');
        return assets.filter((asset: any) => {
            const tags = asset.get('tags') || [];
            return tags.includes('aigc');
        });
    }

    /**
     * Add AIGC metadata to an asset
     *
     * @param asset - PlayCanvas asset
     * @param metadata - Generation metadata
     */
    addAIGCMetadata(
        asset: any,
        metadata: {
            prompt?: string;
            model?: string;
            generatedAt?: Date;
            cost?: number;
        }
    ): void {
        const existingMeta = asset.get('meta') || {};
        asset.set('meta', {
            ...existingMeta,
            aigc: {
                prompt: metadata.prompt,
                model: metadata.model,
                generatedAt: metadata.generatedAt?.toISOString() || new Date().toISOString(),
                cost: metadata.cost
            }
        });

        // Add aigc tag
        const tags = asset.get('tags') || [];
        if (!tags.includes('aigc')) {
            asset.set('tags', [...tags, 'aigc']);
        }
    }
}

// Singleton instance
const assetImporter = new AssetImporter();

export { AssetImporter, assetImporter };
