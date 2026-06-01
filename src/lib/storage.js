import { supabase } from './supabase';

const BUCKET_NAME = 'photos-participants';
const DEFAULT_FILE_TYPE = 'image/jpeg';

const MIME_EXTENSION_MAP = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
};

function getUploadDiagnostics(file) {
    return {
        fileName: file?.name || 'unknown',
        fileType: file?.type || DEFAULT_FILE_TYPE,
        fileSize: file?.size || 0,
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    };
}

function getFileExtension(file) {
    const fromName = file?.name?.includes('.') ? file.name.split('.').pop()?.toLowerCase() : null;
    if (fromName) return fromName;
    return MIME_EXTENSION_MAP[file?.type] || 'jpg';
}

function normalizeUploadFile(file, prefix) {
    const fileType = file?.type || DEFAULT_FILE_TYPE;
    const extension = getFileExtension(file);
    const safeName = file?.name || `${prefix}.${extension}`;

    if (file instanceof File && file.type && file.name) {
        return file;
    }

    return new File([file], safeName, {
        type: fileType,
        lastModified: Date.now(),
    });
}

function formatUploadError(error, diagnostics) {
    const rawMessage = error?.message || 'Erreur inconnue';

    if (diagnostics.online === false) {
        return new Error("Impossible d'envoyer la photo car l'appareil semble hors ligne.");
    }

    if (/Failed to fetch/i.test(rawMessage)) {
        return new Error("Impossible d'envoyer la photo au serveur. Verifiez la connexion internet puis reessayez.");
    }

    if (/413|too large|payload/i.test(rawMessage)) {
        return new Error("La photo est trop volumineuse pour etre envoyee. Essayez une image plus legere.");
    }

    if (/signature verification failed/i.test(rawMessage)) {
        return new Error("La configuration d'acces au serveur photo est invalide.");
    }

    return new Error(`Erreur lors de l'upload: ${rawMessage}`);
}

/**
 * Upload une photo vers Supabase Storage
 * @param {File} file - Le fichier image a uploader
 * @param {string} prefix - Prefixe pour le nom du fichier (ex: 'inscription')
 * @returns {Promise<string>} - L'URL publique de l'image
 */
export async function uploadPhoto(file, prefix = 'photo') {
    if (!file) {
        throw new Error('Aucun fichier fourni');
    }

    const normalizedFile = normalizeUploadFile(file, prefix);
    const diagnostics = getUploadDiagnostics(normalizedFile);

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = getFileExtension(normalizedFile);
    const fileName = `${prefix}_${timestamp}_${randomStr}.${extension}`;

    console.info('[uploadPhoto] Debut upload', {
        bucket: BUCKET_NAME,
        fileName,
        ...diagnostics,
    });

    let data = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            const uploadBody = attempt === 1 ? normalizedFile : await normalizedFile.arrayBuffer();
            const result = await supabase.storage
                .from(BUCKET_NAME)
                .upload(fileName, uploadBody, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: normalizedFile.type || DEFAULT_FILE_TYPE,
                });

            if (result.error) {
                throw result.error;
            }

            data = result.data;
            console.info('[uploadPhoto] Upload reussi', {
                attempt,
                path: data?.path,
            });
            break;
        } catch (error) {
            lastError = error;
            console.error('[uploadPhoto] Echec tentative', {
                attempt,
                message: error?.message,
                status: error?.status || error?.statusCode || null,
                ...diagnostics,
            });
        }
    }

    if (!data) {
        throw formatUploadError(lastError, diagnostics);
    }

    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

    return publicUrl;
}

/**
 * Supprimer une photo de Supabase Storage
 * @param {string} photoUrl - L'URL publique de la photo
 * @returns {Promise<void>}
 */
export async function deletePhoto(photoUrl) {
    if (!photoUrl) return;

    const urlParts = photoUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([fileName]);

    if (error) {
        console.error('Erreur suppression photo:', error);
    }
}

/**
 * Verifie si une URL est une URL Supabase Storage valide
 * @param {string} url - L'URL a verifier
 * @returns {boolean}
 */
export function isSupabaseStorageUrl(url) {
    if (!url) return false;
    return url.includes('supabase') && url.includes(BUCKET_NAME);
}
