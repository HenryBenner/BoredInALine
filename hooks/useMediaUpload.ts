import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { ApiClient } from '@/utils/api';

interface UploadResult {
  publicUrl: string;
  objectPath: string;
}

interface MediaPickResult {
  uri: string;
  mimeType: string;
  type: 'image' | 'video';
}

interface UseMediaUploadReturn {
  pickImage: () => Promise<MediaPickResult | null>;
  takePhoto: () => Promise<MediaPickResult | null>;
  uploadMedia: (uri: string, mimeType: string) => Promise<UploadResult>;
  uploading: boolean;
  progress: number;
  error: string | null;
}

export function useMediaUpload(): UseMediaUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const requestPermissions = async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    }
  };

  const getMimeType = (asset: ImagePicker.ImagePickerAsset): string => {
    if (asset.mimeType) {
      return asset.mimeType;
    }
    
    const lowerUri = asset.uri.toLowerCase();
    if (lowerUri.includes('.png')) return 'image/png';
    if (lowerUri.includes('.gif')) return 'image/gif';
    if (lowerUri.includes('.webp')) return 'image/webp';
    if (lowerUri.includes('.mp4')) return 'video/mp4';
    if (lowerUri.includes('.mov')) return 'video/quicktime';
    if (lowerUri.includes('.avi')) return 'video/x-msvideo';
    if (lowerUri.includes('.webm')) return 'video/webm';
    
    if (asset.type === 'video') return 'video/mp4';
    return 'image/jpeg';
  };

  const getFileExtension = (mimeType: string): string => {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/webm': 'webm',
    };
    return extensions[mimeType] || 'jpg';
  };

  const pickImage = async (): Promise<MediaPickResult | null> => {
    setError(null);
    
    const hasPermission = await requestPermissions('library');
    if (!hasPermission) {
      setError('Permission to access media library is required');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      mimeType: getMimeType(asset),
      type: asset.type === 'video' ? 'video' : 'image',
    };
  };

  const takePhoto = async (): Promise<MediaPickResult | null> => {
    setError(null);
    
    const hasPermission = await requestPermissions('camera');
    if (!hasPermission) {
      setError('Permission to access camera is required');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      mimeType: getMimeType(asset),
      type: asset.type === 'video' ? 'video' : 'image',
    };
  };

  const uploadMedia = async (uri: string, mimeType: string): Promise<UploadResult> => {
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(10);

      const formData = new FormData();
      const extension = getFileExtension(mimeType);
      const fileName = `upload.${extension}`;

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, fileName);
      } else {
        formData.append('file', {
          uri,
          type: mimeType,
          name: fileName,
        } as any);
      }

      setProgress(30);

      const result = await ApiClient.uploadFile<{
        objectPath: string;
        publicUrl: string;
      }>('/uploads/upload', formData);

      setProgress(100);

      return {
        publicUrl: result.publicUrl,
        objectPath: result.objectPath,
      };
    } catch (err: any) {
      console.error('Failed to upload media:', err);
      const errorMessage = err?.message || 'Failed to upload media';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return {
    pickImage,
    takePhoto,
    uploadMedia,
    uploading,
    progress,
    error,
  };
}
