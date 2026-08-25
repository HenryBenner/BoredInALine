import { useState } from 'react';
import * as Location from 'expo-location';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface LocationError {
  message: string;
  code?: string;
  isPermissionDenied?: boolean;
}

export const useLocation = () => {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [error, setError] = useState<LocationError | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);

  const requestLocation = async (): Promise<LocationCoords | null> => {
    setLoading(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status !== Location.PermissionStatus.GRANTED) {
        const errorMessage = status === Location.PermissionStatus.DENIED 
          ? 'Location permission denied. Please enable location access in your device settings.'
          : 'Location permission is required to check in.';
        
        setError({ 
          message: errorMessage, 
          code: 'PERMISSION_DENIED',
          isPermissionDenied: true 
        });
        setLoading(false);
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
      });

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setLocation(coords);
      setLoading(false);
      return coords;
    } catch (err: any) {
      let errorMessage = 'Failed to get your location. Please try again.';
      
      if (err.message?.includes('timeout')) {
        errorMessage = 'Location request timed out. Please check your connection and try again.';
      } else if (err.message?.includes('unavailable')) {
        errorMessage = 'Location services are unavailable. Please enable them in your device settings.';
      }

      setError({ message: errorMessage, code: 'LOCATION_ERROR' });
      setLoading(false);
      return null;
    }
  };

  const resetError = () => setError(null);

  return {
    location,
    error,
    loading,
    permissionStatus,
    requestLocation,
    resetError,
  };
};
