import { supabase } from './supabase';

const BUCKET_NAME = 'photos-participants';

/**
 * Upload une photo vers Supabase Storage
 * @param {File} file - Le fichier image à uploader
 * @param {string} prefix - Préfixe pour le nom du fichier (ex: 'inscription')
 * @returns {Promise<string>} - L'URL publique de l'image
 */
export async function uploadPhoto(file, prefix = 'photo') {
    if (!file) {
        throw new Error('Aucun fichier fourni');
    }

    // Générer un nom unique
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `${prefix}_${timestamp}_${randomStr}.${extension}`;

    // Upload vers Supabase Storage
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        console.error('Erreur upload:', error);
        throw new Error(`Erreur lors de l'upload: ${error.message}`);
    }

    // Obtenir l'URL publique
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

    // Extraire le nom du fichier de l'URL
    const urlParts = photoUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([fileName]);

    if (error) {
        console.error('Erreur suppression photo:', error);
        // Ne pas throw, juste logger
    }
}

/**
 * Vérifie si une URL est une URL Supabase Storage valide
 * @param {string} url - L'URL à vérifier
 * @returns {boolean}
 */
export function isSupabaseStorageUrl(url) {
    if (!url) return false;
    return url.includes('supabase') && url.includes(BUCKET_NAME);
}
