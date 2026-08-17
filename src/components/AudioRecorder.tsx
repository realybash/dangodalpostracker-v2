import React, { useState, useRef } from 'react';
import { Mic, Square, Play, Trash, Loader2 } from 'lucide-react';

interface AudioRecorderProps {
  onSave: (audioBase64: string) => void;
  initialAudio?: string;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onSave, initialAudio }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudio || null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setAudioUrl(base64Audio);
          onSave(base64Audio);
          // Stop all audio tracks to free up mic
          stream.getTracks().forEach(track => track.stop());
        };
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied", err);
      alert("Microphone access is required for voice notes. Please grant microphone permissions in your browser settings and try again.");
    }
  };
  
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };
  
  const playAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };
  
  const deleteAudio = () => {
    setAudioUrl(null);
    onSave('');
  };

  return (
    <div className="flex items-center justify-between gap-3 p-2 bg-transparent w-full">
      <div className="flex flex-col pl-2">
        <span className="text-[11px] font-black uppercase text-neutral-400 font-mono tracking-widest leading-none">Voice Note</span>
        <span className="text-[9px] font-bold text-neutral-300 uppercase tracking-tighter mt-1">Audio Evidence</span>
      </div>
      
      {!isRecording && !audioUrl && (
        <button 
          type="button" 
          onClick={startRecording} 
          className="flex items-center gap-3 px-6 py-3.5 bg-[#00B87A] text-white rounded-[1.2rem] hover:bg-emerald-600 transition-all active:scale-95 text-[12px] font-black shadow-lg shadow-[#00B87A]/20 cursor-pointer uppercase font-mono tracking-wider"
        >
          <Mic className="w-4 h-4" /> Start Recording
        </button>
      )}
      {isRecording && (
        <button 
          type="button" 
          onClick={stopRecording} 
          className="flex items-center gap-3 px-6 py-3.5 bg-red-500 text-white rounded-[1.2rem] hover:bg-red-600 transition-all active:scale-95 text-[12px] font-black shadow-lg shadow-red-500/20 cursor-pointer uppercase font-mono tracking-wider"
        >
          <Loader2 className="w-4 h-4 animate-spin" /> Recording...
        </button>
      )}
      {audioUrl && !isRecording && (
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={playAudio} 
            className="w-12 h-12 flex items-center justify-center bg-[#00B87A]/10 text-[#00B87A] rounded-2xl hover:bg-[#00B87A]/20 transition-colors cursor-pointer"
          >
            <Play className="w-5 h-5 fill-[#00B87A]" />
          </button>
          <button 
            type="button" 
            onClick={deleteAudio} 
            className="w-12 h-12 flex items-center justify-center bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors cursor-pointer"
          >
            <Trash className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
