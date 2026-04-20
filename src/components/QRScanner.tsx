import jsQR from "jsqr";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function QRScanner({ onScan, onClose }: { onScan: (data: string) => void, onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream;
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true"); // Required to tell iOS safari we don't want fullscreen
          videoRef.current.play();
          requestAnimationFrame(tick);
        }
      } catch (err) {
        console.error("Camera error", err);
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          onScan(code.data);
          return; // Stop after successful scan
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    startCamera();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel p-6 rounded-2xl w-full max-w-sm relative flex flex-col items-center border-[var(--glow-color)] border">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-[var(--glow-color)] transition-colors">
          <X size={24} />
        </button>
        <h3 className="text-xl font-bold font-mono mb-4 text-white">SCAN ASSET (QR)</h3>
        <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-black border border-white/10">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 pointer-events-none border-2 border-[var(--glow-color)] rounded-xl opacity-50 m-8 animate-pulse" />
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <p className="text-sm text-gray-400 mt-4 text-center">Point your camera at a QR code</p>
      </div>
    </div>
  );
}
