"use client";

/**
 * QR CODE SCANNER COMPONENT
 *
 * Modern QR code scanning for WalletConnect URIs
 * Provides seamless connection experience
 */

import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { Button } from "@/components/ui/button";
import { X, Camera, CameraOff } from "lucide-react";
import { QRScannerSkeleton } from "@/components/ui/Skeleton";

interface QRCodeScannerProps {
  onScan: (uri: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function QRCodeScanner({ onScan, onClose, isOpen }: QRCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopScanning();
      return;
    }

    initializeScanner();

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const initializeScanner = async () => {
    if (!videoRef.current) return;

    setIsInitializing(true);
    try {
      // Check camera permission
      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        setError("No camera found on this device");
        setHasPermission(false);
        return;
      }

      // Initialize scanner
      scannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          console.log("QR Code detected:", result.data);
          handleScanResult(result.data);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
        }
      );

      // Start scanning
      await scannerRef.current.start();
      setIsScanning(true);
      setHasPermission(true);
      setError(null);
    } catch (err: any) {
      console.error("Failed to initialize QR scanner:", err);
      setError(err.message || "Failed to access camera");
      setHasPermission(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleScanResult = (data: string) => {
    // Validate that it's a WalletConnect URI
    if (data.startsWith("wc:")) {
      stopScanning();
      onScan(data);
    } else {
      // Not a WalletConnect URI, continue scanning
      console.log("Scanned non-WalletConnect URI:", data);
    }
  };

  const toggleScanning = async () => {
    if (isScanning) {
      stopScanning();
    } else {
      await initializeScanner();
    }
  };

  if (!isOpen) return null;

  // Show skeleton while initializing
  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <QRScannerSkeleton />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Scan QR Code</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scanner Area */}
        <div className="relative aspect-square bg-black">
          {hasPermission === false ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
              <CameraOff className="w-12 h-12 text-gray-500 mb-4" />
              <p className="text-gray-400 mb-2">
                {error || "Camera access denied"}
              </p>
              <p className="text-sm text-gray-500">
                Please allow camera access to scan QR codes
              </p>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
          )}

          {/* Scanning overlay */}
          {isScanning && (
            <div className="absolute inset-0 border-2 border-blue-500 rounded-lg m-4 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-16 h-16 border-2 border-blue-400 rounded-lg animate-pulse" />
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-2">
              Scan a WalletConnect QR code from a dApp
            </p>
            <p className="text-xs text-gray-500">
              Position the QR code within the frame to connect
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={toggleScanning}
              disabled={hasPermission === false}
              className="flex-1"
              variant={isScanning ? "secondary" : "default"}
            >
              {isScanning ? (
                <>
                  <CameraOff className="w-4 h-4 mr-2" />
                  Stop Scanning
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Start Scanning
                </>
              )}
            </Button>

            <Button
              onClick={onClose}
              variant="ghost"
              className="px-4"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
