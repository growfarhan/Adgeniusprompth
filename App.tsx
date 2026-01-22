
import React, { useState, useEffect, useRef } from 'react';
import { GenerationHistory, PromptConfig, AspectRatio, VideoState } from './types';
import { geminiService } from './services/geminiService';
import { STYLES, TONES, LOADING_MESSAGES } from './constants';

const App: React.FC = () => {
  const [config, setConfig] = useState<PromptConfig>({
    productName: '',
    targetAudience: '',
    style: STYLES[0],
    tone: TONES[0],
    duration: '10 detik',
    storyboard: '',
    voiceScript: ''
  });
  
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [talentImages, setTalentImages] = useState<string[]>([]);
  const [productImages, setProductImages] = useState<string[]>([]);
  
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [videoState, setVideoState] = useState<VideoState>({
    isGenerating: false,
    progress: 0,
    currentMessage: ''
  });
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.LANDSCAPE);
  const [hasApiKey, setHasApiKey] = useState(false);

  const refInputRef = useRef<HTMLInputElement>(null);
  const talentInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkApiKey();
    const saved = localStorage.getItem('adgenius_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved) as GenerationHistory[]);
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const checkApiKey = async () => {
    try {
      // @ts-ignore
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    } catch (e) {
      console.error("API Key check failed", e);
    }
  };

  const handleSelectApiKey = async () => {
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    } catch (e) {
      alert("Gagal memilih API Key");
    }
  };

  const saveToHistory = (item: Partial<GenerationHistory>) => {
    const newItem: GenerationHistory = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      productName: config.productName || 'Tanpa Nama',
      prompt: generatedPrompt,
      storyboard: config.storyboard,
      voiceScript: config.voiceScript,
      referenceImages: [...referenceImages],
      talentImages: [...talentImages],
      productImages: [...productImages],
      status: 'completed',
      ...item as GenerationHistory
    };
    const updated = [newItem, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem('adgenius_history', JSON.stringify(updated));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setter(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
    e.target.value = '';
  };

  const removeImage = (index: number, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const generatePrompt = async () => {
    if (!config.productName) return alert("Mohon masukkan nama produk");
    setIsGeneratingPrompt(true);
    try {
      const prompt = await geminiService.generateVideoPrompt(
        config, 
        referenceImages,
        talentImages,
        productImages
      );
      setGeneratedPrompt(prompt);
    } catch (error) {
      console.error(error);
      alert("Gagal generate prompt");
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const createVideo = async () => {
    if (!hasApiKey) return handleSelectApiKey();
    if (!generatedPrompt) return alert("Generate prompt terlebih dahulu");

    setVideoState({ isGenerating: true, progress: 0, currentMessage: LOADING_MESSAGES[0] });
    
    let msgIndex = 0;
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setVideoState(prev => ({ ...prev, currentMessage: LOADING_MESSAGES[msgIndex], progress: Math.min(prev.progress + 5, 95) }));
    }, 4000);

    try {
      const videoUrl = await geminiService.createVideo(
        generatedPrompt, 
        referenceImages,
        talentImages,
        productImages,
        aspectRatio
      );
      saveToHistory({ videoUrl });
      setVideoState(prev => ({ ...prev, progress: 100, currentMessage: "Video berhasil dibuat!" }));
      setTimeout(() => setVideoState(prev => ({ ...prev, isGenerating: false })), 2000);
    } catch (error: any) {
      if (error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        alert("Sesi API Key berakhir. Mohon pilih kembali.");
      } else {
        alert("Gagal membuat video. " + error.message);
      }
      setVideoState(prev => ({ ...prev, isGenerating: false }));
    } finally {
      clearInterval(interval);
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      setIsCustomDuration(true);
      setConfig({...config, duration: ''});
    } else {
      setIsCustomDuration(false);
      setConfig({...config, duration: val});
    }
  };

  const AssetSection = ({ 
    title, 
    subtitle, 
    images, 
    setter, 
    inputRef, 
    icon,
    colorClass 
  }: { 
    title: string; 
    subtitle: string; 
    images: string[]; 
    setter: React.Dispatch<React.SetStateAction<string[]>>; 
    inputRef: React.RefObject<HTMLInputElement>;
    icon: string;
    colorClass: string;
  }) => (
    <div className={`glass p-4 rounded-2xl border-white/5 transition-all hover:border-${colorClass}-500/30`}>
      <div className="flex justify-between items-center mb-3">
        <div>
          <p className="text-xs font-bold text-slate-200">{title}</p>
          <p className="text-[9px] text-slate-500">{subtitle}</p>
        </div>
        <button 
          onClick={() => inputRef.current?.click()}
          className={`w-8 h-8 rounded-full bg-${colorClass}-500/20 text-${colorClass}-400 flex items-center justify-center hover:bg-${colorClass}-500/40 transition-colors`}
        >
          <i className="fas fa-plus text-xs"></i>
        </button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {images.map((img, idx) => (
          <div key={idx} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-white/10">
            <img src={img} className="w-full h-full object-cover" />
            <button 
              onClick={() => removeImage(idx, setter)}
              className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px]"
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
        ))}
        {images.length === 0 && (
          <div 
            onClick={() => inputRef.current?.click()}
            className="w-14 h-14 rounded-lg border-2 border-dashed border-white/5 flex items-center justify-center cursor-pointer hover:border-white/20 transition-colors"
          >
            <i className={`${icon} text-slate-600 text-xs`}></i>
          </div>
        )}
      </div>
      <input 
        type="file" 
        multiple
        ref={inputRef} 
        onChange={e => handleFileChange(e, setter)} 
        className="hidden" 
        accept="image/*" 
      />
    </div>
  );

  return (
    <div className="min-h-screen pb-12">
      <nav className="p-6 border-b border-white/10 glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <i className="fas fa-play-circle text-xl"></i>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Ad<span className="gradient-text">Genius</span></h1>
          </div>
          {!hasApiKey && (
            <button 
              onClick={handleSelectApiKey}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all text-sm flex items-center gap-2"
            >
              <i className="fas fa-key text-yellow-500"></i>
              <span>Hubungkan API Key (Veo)</span>
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-10">
        <section className="lg:col-span-5 space-y-8">
          <div className="glass p-8 rounded-3xl space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3">
              <i className="fas fa-sliders-h text-indigo-400"></i>
              Konfigurasi Video
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Nama Produk / Brand</label>
                  <input 
                    type="text" 
                    value={config.productName}
                    onChange={e => setConfig({...config, productName: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
                    placeholder="Contoh: Kopi Susu Gula Aren"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Target Audiens</label>
                  <input 
                    type="text" 
                    value={config.targetAudience}
                    onChange={e => setConfig({...config, targetAudience: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
                    placeholder="Contoh: Gen Z, Pekerja Kreatif"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2 text-xs">Gaya Visual</label>
                  <select 
                    value={config.style}
                    onChange={e => setConfig({...config, style: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none text-xs"
                  >
                    {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2 text-xs">Tone/Suasana</label>
                  <select 
                    value={config.tone}
                    onChange={e => setConfig({...config, tone: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none text-xs"
                  >
                    {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Video Duration Input */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-400 text-xs">Durasi Video</label>
                <div className="flex gap-3">
                  <select 
                    value={isCustomDuration ? 'custom' : config.duration}
                    onChange={handleDurationChange}
                    className="flex-1 bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none text-xs"
                  >
                    <option value="5 detik">5 detik</option>
                    <option value="10 detik">10 detik (Default)</option>
                    <option value="15 detik">15 detik</option>
                    <option value="30 detik">30 detik</option>
                    <option value="custom">Input Manual...</option>
                  </select>
                  
                  {isCustomDuration && (
                    <div className="relative flex-1">
                      <input 
                        type="number" 
                        value={config.duration.replace(/[^0-9]/g, '')}
                        onChange={e => setConfig({...config, duration: e.target.value + ' detik'})}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-xs pr-12"
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">detik</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                  <i className="fas fa-film text-indigo-400"></i>
                  Storyboard / Alur Adegan
                </label>
                <textarea 
                  value={config.storyboard}
                  onChange={e => setConfig({...config, storyboard: e.target.value})}
                  rows={3}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm resize-none"
                  placeholder="Deskripsikan urutan adegan..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                  <i className="fas fa-microphone-alt text-emerald-400"></i>
                  Script Suara / Voiceover (Opsional)
                </label>
                <textarea 
                  value={config.voiceScript}
                  onChange={e => setConfig({...config, voiceScript: e.target.value})}
                  rows={2}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm resize-none"
                  placeholder="Masukkan teks narasi atau dialog..."
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-300">Aset Visual (Unlimited)</label>
                
                <AssetSection 
                  title="Referensi Mood" 
                  subtitle="Tone & komposisi visual." 
                  images={referenceImages} 
                  setter={setReferenceImages} 
                  inputRef={refInputRef} 
                  icon="fas fa-image"
                  colorClass="indigo"
                />

                <AssetSection 
                  title="Talent / Model" 
                  subtitle="Pemeran dalam video." 
                  images={talentImages} 
                  setter={setTalentImages} 
                  inputRef={talentInputRef} 
                  icon="fas fa-user"
                  colorClass="purple"
                />

                <AssetSection 
                  title="Foto Produk" 
                  subtitle="Barang spesifik." 
                  images={productImages} 
                  setter={setProductImages} 
                  inputRef={productInputRef} 
                  icon="fas fa-box"
                  colorClass="emerald"
                />
              </div>
            </div>

            <button 
              onClick={generatePrompt}
              disabled={isGeneratingPrompt}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                isGeneratingPrompt 
                  ? 'bg-slate-800 cursor-not-allowed text-slate-500' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95'
              }`}
            >
              {isGeneratingPrompt ? (
                <>
                  <i className="fas fa-circle-notch fa-spin"></i>
                  <span>Menganalisis {referenceImages.length + talentImages.length + productImages.length} Aset...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-magic"></i>
                  <span>Generate Magic Prompt</span>
                </>
              )}
            </button>
          </div>
        </section>

        <section className="lg:col-span-7 space-y-8">
          <div className="glass p-8 rounded-3xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <i className="fas fa-terminal text-indigo-400"></i>
                AI-Engineered Prompt
              </h2>
              {generatedPrompt && (
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPrompt);
                    alert("Prompt disalin!");
                  }}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 px-2 py-1 rounded"
                >
                  <i className="fas fa-copy"></i> Copy
                </button>
              )}
            </div>
            
            <div className="relative min-h-[200px] bg-slate-900/80 rounded-2xl border border-white/5 p-5">
              {!generatedPrompt && !isGeneratingPrompt && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                  <i className="fas fa-sparkles text-2xl mb-2"></i>
                  <p className="text-sm">Siapkan aset dan konfigurasi Anda</p>
                </div>
              )}
              {isGeneratingPrompt && (
                <div className="space-y-3">
                  <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-white/5 rounded animate-pulse"></div>
                  <div className="h-4 w-5/6 bg-white/5 rounded animate-pulse"></div>
                  <div className="h-4 w-2/3 bg-white/5 rounded animate-pulse"></div>
                </div>
              )}
              {generatedPrompt && (
                <p className="text-indigo-100/90 leading-relaxed font-mono text-sm whitespace-pre-wrap">
                  {generatedPrompt}
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-white/5 space-y-6">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-400">Aspect Ratio:</span>
                  <div className="flex p-1 bg-slate-900 rounded-lg">
                    <button 
                      onClick={() => setAspectRatio(AspectRatio.LANDSCAPE)}
                      className={`px-3 py-1 text-xs rounded-md transition-all ${aspectRatio === AspectRatio.LANDSCAPE ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      16:9
                    </button>
                    <button 
                      onClick={() => setAspectRatio(AspectRatio.PORTRAIT)}
                      className={`px-3 py-1 text-xs rounded-md transition-all ${aspectRatio === AspectRatio.PORTRAIT ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      9:16
                    </button>
                  </div>
                </div>
                
                <button 
                  onClick={createVideo}
                  disabled={videoState.isGenerating || !generatedPrompt}
                  className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
                    videoState.isGenerating || !generatedPrompt
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:scale-95'
                  }`}
                >
                  <i className="fas fa-video"></i>
                  Generate Video
                </button>
              </div>

              {videoState.isGenerating && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-emerald-400 font-semibold flex items-center gap-2 text-sm">
                        <i className="fas fa-robot animate-bounce"></i>
                        {videoState.currentMessage}
                      </p>
                      <p className="text-[10px] text-slate-500">Video engine akan memproses 3 aset utama sebagai referensi.</p>
                    </div>
                    <span className="text-xs font-mono text-slate-400">{videoState.progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 transition-all duration-1000 ease-linear"
                      style={{ width: `${videoState.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {history.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold px-2">Koleksi Terakhir</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {history.map((item) => (
                  <div key={item.id} className="glass rounded-2xl overflow-hidden group">
                    <div className="aspect-video bg-black relative">
                      {item.videoUrl ? (
                        <video 
                          src={item.videoUrl} 
                          controls 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-4">
                          <i className="fas fa-file-video text-2xl mb-2"></i>
                          <p className="text-xs text-center font-mono opacity-50 line-clamp-2">{item.prompt}</p>
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-slate-900/40">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-2">
                          <h3 className="text-sm font-bold text-slate-200 truncate">{item.productName}</h3>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.referenceImages?.slice(0, 2).map((img, i) => <div key={i} className="w-4 h-4 rounded bg-indigo-500/20 border border-indigo-500/30 overflow-hidden"><img src={img} className="w-full h-full object-cover"/></div>)}
                            {item.talentImages?.slice(0, 2).map((img, i) => <div key={i} className="w-4 h-4 rounded bg-purple-500/20 border border-purple-500/30 overflow-hidden"><img src={img} className="w-full h-full object-cover"/></div>)}
                            {item.productImages?.slice(0, 2).map((img, i) => <div key={i} className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/30 overflow-hidden"><img src={img} className="w-full h-full object-cover"/></div>)}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-600 flex-shrink-0">{new Date(item.timestamp).toLocaleDateString('id-ID')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="text-center py-12 text-slate-500 text-sm">
        <p>© 2024 AdGenius Studio. Ditenagai oleh Gemini & Veo Pro.</p>
      </footer>
    </div>
  );
};

export default App;
