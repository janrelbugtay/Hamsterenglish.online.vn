import React, { useState, useRef } from 'react';
import { Sparkles, Image as ImageIcon, Video, Camera, Upload, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function MediaStudio() {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'analyze'>('image');

  return (
    <div className="min-h-screen py-10 max-w-7xl mx-auto px-6">
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-purple/10 text-brand-purple mb-6">
          <Sparkles size={32} />
        </div>
        <h1 className="text-4xl font-display font-bold text-slate-900 mb-4">AI Media Studio</h1>
        <p className="text-slate-600 text-lg">Generate hyper-realistic images, animate photos into videos, or analyze any image using Gemini 3.1 Pro.</p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="bg-white p-2 rounded-2xl shadow-sm flex gap-2">
          <button
            onClick={() => setActiveTab('image')}
            className={cn("flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all", activeTab === 'image' ? "bg-brand-purple text-white shadow-md" : "text-slate-500 hover:bg-slate-50")}
          >
            <ImageIcon size={18} /> Generate Image
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={cn("flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all", activeTab === 'video' ? "bg-brand-purple text-white shadow-md" : "text-slate-500 hover:bg-slate-50")}
          >
            <Video size={18} /> Animate Photo (Veo)
          </button>
          <button
            onClick={() => setActiveTab('analyze')}
            className={cn("flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all", activeTab === 'analyze' ? "bg-brand-purple text-white shadow-md" : "text-slate-500 hover:bg-slate-50")}
          >
            <Camera size={18} /> Analyze Image
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[24px] p-8 premium-shadow max-w-4xl mx-auto min-h-[400px]">
        {activeTab === 'image' && <ImageGeneration />}
        {activeTab === 'video' && <VideoGeneration />}
        {activeTab === 'analyze' && <ImageAnalysis />}
      </div>
    </div>
  );
}

function ImageGeneration() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1K");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!prompt) return;
    setLoading(true);
    setError(null);
    setResultUrl(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size })
      });
      const data = await res.json();
      if (!res.ok) {
        let errStr = data.error || "Failed to generate image";
        if (typeof errStr === 'string' && errStr.includes('exceeded your current quota')) {
          errStr = "Image generation free tier quota exceeded. Please wait a minute and try again.";
        }
        throw new Error(errStr);
      }
      setResultUrl(data.imageUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <h2 className="text-2xl font-bold text-slate-900">Generate Image (Gemini 3 Pro)</h2>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Image Prompt</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-brand-purple focus:bg-white transition-all resize-none h-24"
          placeholder="A hyper-realistic cute puppy playing with a ball of yarn in a sunlit room..."
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Resolution</label>
        <div className="flex gap-4">
          {["1K", "2K", "4K"].map(s => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={cn("px-6 py-2 rounded-xl font-bold border-2 transition-all", size === s ? "border-brand-purple bg-brand-purple/10 text-brand-purple" : "border-slate-200 text-slate-500 hover:border-slate-300")}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={generate}
        disabled={loading || !prompt}
        className="px-8 py-3 bg-brand-purple text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
      >
        {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
        {loading ? "Generating..." : "Generate Image"}
      </button>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}
      {resultUrl && (
        <div className="mt-8 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex justify-center p-4">
          <img src={resultUrl} alt="Generated" className="max-w-full rounded-xl shadow-lg" />
        </div>
      )}
    </div>
  );
}

function VideoGeneration() {
  const [image, setImage] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [loading, setLoading] = useState(false);
  const [operationName, setOperationName] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const generate = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setOperationName(null);
    setVideoUrl(null);
    
    const formData = new FormData();
    formData.append("image", image);
    formData.append("aspectRatio", aspectRatio);
    
    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start video generation");
      setOperationName(data.operationName);
      pollOperation(data.operationName);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const pollOperation = async (opName: string) => {
    try {
      const res = await fetch("/api/video-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationName: opName })
      });
      const data = await res.json();
      if (data.done) {
        setVideoUrl(`/api/video-download?operationName=${encodeURIComponent(opName)}`);
        setLoading(false);
      } else {
        setTimeout(() => pollOperation(opName), 5000);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <h2 className="text-2xl font-bold text-slate-900">Animate Photo (Veo 3.1 Fast Generate)</h2>
      
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Upload Starting Photo</label>
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center cursor-pointer hover:bg-slate-50 transition-colors flex flex-col items-center justify-center gap-3"
        >
          {image ? (
            <div className="font-medium text-brand-purple flex items-center gap-2"><ImageIcon size={20} /> {image.name} (Click to change)</div>
          ) : (
            <>
              <Upload size={32} className="text-slate-400" />
              <div className="font-medium text-slate-600">Click to upload photo</div>
            </>
          )}
        </div>
        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUpload} />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Aspect Ratio</label>
        <div className="flex gap-4">
          {["16:9", "9:16"].map(s => (
            <button
              key={s}
              onClick={() => setAspectRatio(s)}
              className={cn("px-6 py-2 rounded-xl font-bold border-2 transition-all", aspectRatio === s ? "border-brand-purple bg-brand-purple/10 text-brand-purple" : "border-slate-200 text-slate-500 hover:border-slate-300")}
            >
              {s === "16:9" ? "16:9 (Landscape)" : "9:16 (Portrait)"}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={generate}
        disabled={loading || !image}
        className="px-8 py-3 bg-brand-purple text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
      >
        {loading ? <Loader2 className="animate-spin" /> : <Video size={18} />}
        {loading ? (operationName ? "Generating Video (this may take a few minutes)..." : "Uploading...") : "Animate Photo"}
      </button>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}
      {videoUrl && (
        <div className="mt-8 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-4">
          <video src={videoUrl} controls autoPlay loop className="w-full rounded-xl shadow-lg max-h-[500px]" />
        </div>
      )}
    </div>
  );
}

function ImageAnalysis() {
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const analyze = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResultText(null);
    
    const formData = new FormData();
    formData.append("image", image);
    
    try {
      const res = await fetch("/api/analyze-image", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        let errStr = data.error || "Failed to analyze image";
        if (typeof errStr === 'string' && errStr.includes('exceeded your current quota')) {
          errStr = "Image analysis free tier quota exceeded. Please wait a minute and try again.";
        }
        throw new Error(errStr);
      }
      setResultText(data.text);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <h2 className="text-2xl font-bold text-slate-900">Analyze Image (Gemini 3.1 Pro)</h2>
      
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Upload Photo for Analysis</label>
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center cursor-pointer hover:bg-slate-50 transition-colors flex flex-col items-center justify-center gap-3"
        >
          {image ? (
            <div className="font-medium text-brand-blue flex items-center gap-2"><ImageIcon size={20} /> {image.name} (Click to change)</div>
          ) : (
            <>
              <Camera size={32} className="text-slate-400" />
              <div className="font-medium text-slate-600">Click to upload photo</div>
            </>
          )}
        </div>
        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUpload} />
      </div>

      <button
        onClick={analyze}
        disabled={loading || !image}
        className="px-8 py-3 bg-brand-blue text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
      >
        {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
        {loading ? "Analyzing..." : "Analyze Image"}
      </button>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}
      {resultText && (
        <div className="mt-8 rounded-2xl bg-slate-50 border border-slate-200 p-6 whitespace-pre-wrap text-slate-700 leading-relaxed">
          <div className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Camera size={18} /> Analysis Result:</div>
          {resultText}
        </div>
      )}
    </div>
  );
}
