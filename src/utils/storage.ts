import { supabase } from '../lib/supabase';

export const uploadSnapshot = async (userId: string, file: File): Promise<string> => {
  try {
    // Validate file type and size
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      throw new Error('Invalid file type. Only JPG, PNG, and WEBP images are supported.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File too large. Maximum size is 5MB.');
    }

    // First check if we have a valid session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session found');
    }

    // Create a unique filename with timestamp and user folder
    const timestamp = new Date().getTime();
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${timestamp}.${fileExt}`;

    // Upload the file
    const { data, error: uploadError } = await supabase.storage
      .from('trade-snapshots')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type // Explicitly set content type
      });

    if (uploadError) {
      if (uploadError.message.includes('Bucket not found')) {
        throw new Error('Storage not properly configured. Please contact support.');
      }
      throw uploadError;
    }

    // Get the public URL with better error handling
    const { data: { publicUrl }, error: urlError } = supabase.storage
      .from('trade-snapshots')
      .getPublicUrl(fileName);

    if (urlError) {
      throw urlError;
    }

    if (!publicUrl) {
      throw new Error('Failed to get public URL for uploaded file');
    }

    return publicUrl;
  } catch (error) {
    console.error('Error uploading snapshot:', error);
    throw error;
  }
};

export const deleteSnapshot = async (url: string) => {
  try {
    // First check if we have a valid session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session found');
    }

    // Extract the file path from the URL
    const path = url.split('/').slice(-2).join('/');
    
    const { error } = await supabase.storage
      .from('trade-snapshots')
      .remove([path]);

    if (error) {
      if (error.message.includes('Bucket not found')) {
        throw new Error('Storage not properly configured. Please contact support.');
      }
      throw error;
    }
  } catch (error) {
    console.error('Error deleting snapshot:', error);
    throw error;
  }
};