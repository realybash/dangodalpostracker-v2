import React, { useEffect, useState, useRef, useCallback } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export interface LocationData {
  address: string;
  lat: number;
  lng: number;
  accuracy: number;
  lastUpdated: string;
}

function GeocoderComponent({ onLocationUpdate, onError }: { 
  onLocationUpdate: (data: LocationData) => void;
  onError: (msg: string) => void;
}) {
  const geocodingLib = useMapsLibrary('geocoding');

  const onLocationUpdateRef = useRef(onLocationUpdate);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
    onErrorRef.current = onError;
  }, [onLocationUpdate, onError]);

  useEffect(() => {
    if (!geocodingLib) return;

    const geocoder = new geocodingLib.Geocoder();

    const updateLocation = async (position: GeolocationPosition) => {
      const { latitude: lat, longitude: lng, accuracy } = position.coords;
      try {
        const response = await geocoder.geocode({ location: { lat, lng } });
        const address = response.results[0]?.formatted_address || 'Unknown Location';
        
        onLocationUpdateRef.current({
          address,
          lat,
          lng,
          accuracy,
          lastUpdated: new Date().toLocaleTimeString()
        });
      } catch (e) {
        onErrorRef.current('Failed to fetch address. Displaying coordinates.');
        onLocationUpdateRef.current({
          address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          lat,
          lng,
          accuracy,
          lastUpdated: new Date().toLocaleTimeString()
        });
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      onErrorRef.current(error.message);
    };

    const watchId = navigator.geolocation.watchPosition(updateLocation, handleError, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 5000
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [geocodingLib]);

  return null;
}

export function LocationDetector({ onLocationChange }: { onLocationChange: (data: LocationData | null) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleLocationUpdate = useCallback((data: LocationData) => {
    setIsLoading(false);
    setError(null);
    onLocationChange(data);
  }, [onLocationChange]);

  const handleLocationError = useCallback((msg: string) => {
    setIsLoading(false);
    setError(msg);
    onLocationChange(null);
  }, [onLocationChange]);

  if (!hasValidKey) {
    return <div className="text-xs text-red-500 font-bold p-2 bg-red-50 rounded-xl">Maps API Key missing.</div>;
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <GeocoderComponent 
        onLocationUpdate={handleLocationUpdate} 
        onError={handleLocationError}
      />
      {isLoading && (
        <div className="flex items-center gap-2 text-neutral-500 text-xs font-mono animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin" />
          Detecting location...
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-amber-600 text-xs font-bold bg-amber-50 p-2 rounded-xl">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </APIProvider>
  );
}
