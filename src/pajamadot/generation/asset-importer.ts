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

            // Convert blob to file
            const file = new File([blob], `${name}.png`, { type: 'image/png' });

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
            editor.call('assets:create', {
                name: name,
                type: 'texture',
                file: file,
                source: true,
                preload: true,
                folder: options?.folder,
                tags: options?.tags
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
     * @param file - Model file (GLB/GLTF) to import
     * @param name - Name for the model asset
     * @param options - Additional options
     * @returns Imported model asset
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
            // Use container type for GLB files
            editor.call('assets:create', {
                name: name,
                type: 'container',
                file: file,
                source: true,
                preload: true,
                folder: options?.folder,
                tags: options?.tags
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
