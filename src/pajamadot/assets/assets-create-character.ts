/**
 * Character Asset Creation (YAML format)
 */

import { getDefaultCharacterData } from '../types/character';
import { toYaml, FILE_PATTERNS } from '../yaml';

declare const editor: any;
declare const config: any;

editor.once('load', () => {
    editor.method('assets:create:storycharacter', (args: {
        name?: string;
        parent?: number;
        data?: Partial<ReturnType<typeof getDefaultCharacterData>>;
        callback?: (err: Error | null, asset?: any) => void;
        noSelect?: boolean;
    } = {}) => {
        if (!editor.call('permissions:write')) {
            return;
        }

        const data = {
            ...getDefaultCharacterData(),
            ...args.data
        };

        // Override name if provided
        if (args.name) {
            data.name = args.name;
        }

        const baseName = args.name ?? data.name ?? 'New Character';
        // Include type suffix in name for detection
        const assetName = `${baseName}.character`;
        const yamlContent = toYaml(data);
        const file = new File([yamlContent], `${assetName}.yaml`, { type: 'text/plain' });

        const asset = {
            name: assetName,
            type: 'text',
            source: false,
            parent: (args.parent !== undefined) ? args.parent : editor.call('assets:panel:currentFolder'),
            file: file,
            scope: {
                type: 'project',
                id: config.project.id
            }
        };

        editor.call('assets:create', asset, (err: Error | null, assetId: number) => {
            if (err) {
                console.error('[PajamaDot] Failed to create character:', err);
                if (args.callback) args.callback(err);
                return;
            }

            console.log('[PajamaDot] Character created with ID:', assetId);

            const createdAsset = editor.call('assets:get', assetId);

            if (args.callback) {
                args.callback(null, createdAsset || assetId);
            }
        }, args.noSelect);
    });

    // Schema helper for default data
    editor.method('schema:storycharacter:getDefaultData', () => {
        return getDefaultCharacterData();
    });

    console.log('[PajamaDot] Character asset creation registered');
});
