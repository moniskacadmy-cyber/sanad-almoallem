import React, { useState, useRef } from 'react';
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';
import { auth } from '../firebase';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  compact?: boolean;
  className?: string;
  disabled?: boolean;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  compact = false,
  className = '',
  disabled = false,
}) => {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStartListening = async () => {
    if (disabled || status !== 'idle') return;
    setErrorMessage(null);

    // 1. Try Web Speech API (SpeechRecognition) first
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ar-EG';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setStatus('listening');
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0]?.[0]?.transcript;
          if (transcript) {
            onTranscript(transcript);
          }
          setStatus('idle');
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition error:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setErrorMessage('تم رفض إذن استخدام الميكروفون.');
            setStatus('idle');
          } else if (event.error === 'no-speech') {
            setStatus('idle');
          } else {
            // Fallback to MediaRecorder if SpeechRecognition fails
            startMediaRecorderFallback();
          }
        };

        recognition.onend = () => {
          setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (err) {
        console.warn('SpeechRecognition initialization error, falling back to MediaRecorder:', err);
      }
    }

    // 2. Fallback to MediaRecorder + Gemini Transcribe API
    startMediaRecorderFallback();
  };

  const startMediaRecorderFallback = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('المتصفح لا يدعم التسجيل الصوتي.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setStatus('listening');
        // Auto-stop recording after 30 seconds
        timerRef.current = setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            stopMediaRecorder();
          }
        }, 30000);
      };

      mediaRecorder.onstop = async () => {
        clearTimer();
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) {
          setStatus('idle');
          return;
        }

        setStatus('processing');
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
          const base64Audio = await blobToBase64(audioBlob);
          const cleanBase64 = base64Audio.split(',')[1] || base64Audio;

          const currentUser = auth.currentUser;
          const token = currentUser ? await currentUser.getIdToken() : '';

          const response = await fetch('/api/ai/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: token ? `Bearer ${token}` : '',
            },
            body: JSON.stringify({
              audioBase64: cleanBase64,
              mimeType: audioBlob.type || 'audio/webm',
            }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'فشل التفريغ النصي للصوت.');
          }

          const data = await response.json();
          if (data.text) {
            onTranscript(data.text);
          }
        } catch (err: any) {
          console.error('Audio transcription error:', err);
          setErrorMessage(err.message || 'حدث خطأ أثناء معالجة الصوت.');
        } finally {
          setStatus('idle');
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
    } catch (err: any) {
      console.error('getUserMedia error:', err);
      setStatus('idle');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('تم رفض إذن استخدام الميكروفون.');
      } else {
        setErrorMessage('تعذر الاتصال بالميكروفون.');
      }
    }
  };

  const stopMediaRecorder = () => {
    clearTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return (
    <div className="relative inline-flex items-center">
      {status === 'idle' && (
        <button
          type="button"
          onClick={handleStartListening}
          disabled={disabled}
          title="إدخال صوتي"
          className={`rounded-xl transition cursor-pointer flex items-center justify-center ${
            compact
              ? 'p-2 bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-500/30'
              : 'px-3 py-2 bg-purple-950/70 hover:bg-purple-900/90 text-purple-200 border border-purple-500/40 text-xs font-bold gap-1.5'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        >
          <Mic className={compact ? 'w-4 h-4' : 'w-4 h-4 text-purple-400'} />
          {!compact && <span>إدخال صوتي</span>}
        </button>
      )}

      {status === 'listening' && (
        <button
          type="button"
          onClick={stopMediaRecorder}
          title="إيقاف الاستماع"
          className={`rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 transition cursor-pointer flex items-center gap-1.5 animate-pulse ${
            compact ? 'p-2' : 'px-3 py-2 text-xs font-bold'
          } ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <MicOff className="w-4 h-4 text-rose-400" />
          {!compact && <span>جارٍ الاستماع...</span>}
        </button>
      )}

      {status === 'processing' && (
        <div
          className={`rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 flex items-center gap-1.5 ${
            compact ? 'p-2' : 'px-3 py-2 text-xs font-bold'
          } ${className}`}
        >
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          {!compact && <span>جارٍ المعالجة...</span>}
        </div>
      )}

      {errorMessage && (
        <div className="absolute bottom-full mb-1 right-0 z-50 whitespace-nowrap bg-rose-950/95 border border-rose-500/60 text-rose-200 text-[11px] px-2.5 py-1 rounded-lg shadow-lg flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="mr-1 text-rose-400 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
