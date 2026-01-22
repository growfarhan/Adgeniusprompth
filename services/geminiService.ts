
import { GoogleGenAI, Type, GenerateContentResponse, VideoGenerationReferenceType } from "@google/genai";
import { PromptConfig } from "../types";

export class GeminiService {
  private getAI() {
    // The key is injected from process.env.API_KEY automatically.
    return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateVideoPrompt(
    config: PromptConfig, 
    referenceImages: string[] = [], 
    talentImages: string[] = [], 
    productImages: string[] = []
  ): Promise<string> {
    const ai = this.getAI();
    // Using gemini-3-flash-preview for general text prompt generation
    const model = 'gemini-3-flash-preview';

    const systemInstruction = `
      Anda adalah pakar Videografi Iklan dan Prompt Engineering.
      Tugas Anda adalah membuat prompt video deskriptif yang mendalam untuk model AI video (seperti Veo).
      
      Prompt harus mencakup:
      1. Pergerakan kamera (e.g., dynamic pan, slow zoom, cinematic tracking).
      2. Pencahayaan (e.g., volumetric lighting, golden hour, neon cinematic).
      3. Detail subjek (tekstur, warna, aksi).
      4. Atmosfer/Mood (energetic, luxurious, minimalist).
      5. Alur Cerita: Jika disediakan storyboard, pastikan prompt menggambarkan transisi dan urutan adegan tersebut.
      6. Sinkronisasi Suara: Jika ada Voice Script, instruksikan model video untuk membuat subjek/talent melakukan lip-sync atau gerakan yang sesuai dengan durasi dan nada bicara script tersebut.
      
      Output HANYA berupa teks prompt video dalam Bahasa Inggris yang sangat teknis dan deskriptif agar menghasilkan hasil visual terbaik.
    `;

    const userPromptText = `
      Buat prompt video promosi untuk produk berikut:
      Nama Produk: ${config.productName}
      Target Audiens: ${config.targetAudience}
      Gaya Visual: ${config.style}
      Nada/Tone: ${config.tone}
      Durasi Target: ${config.duration}
      
      Storyboard/Alur Adegan:
      ${config.storyboard || 'Tampilkan produk secara sinematik dengan fokus pada detail.'}

      Voice Script (Dialog/Narasi):
      ${config.voiceScript || 'Tidak ada dialog spesifik.'}

      Gunakan semua gambar yang diberikan sebagai referensi visual:
      - Gambar Mood/Referensi: Memberikan tone warna dan komposisi visual.
      - Gambar Talent: Foto pemeran yang harus muncul secara natural.
      - Gambar Produk: Detail barang yang dipromosikan.
    `;

    const parts: any[] = [{ text: userPromptText }];

    // Add all images to the prompt context, extracting base64 data if needed
    [...referenceImages, ...talentImages, ...productImages].forEach(img => {
      const base64Data = img.includes(',') ? img.split(',')[1] : img;
      parts.push({ inlineData: { data: base64Data, mimeType: 'image/png' } });
    });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction,
        temperature: 0.8,
      },
    });

    return response.text || "Gagal menghasilkan prompt.";
  }

  async createVideo(
    prompt: string, 
    referenceImages: string[] = [], 
    talentImages: string[] = [], 
    productImages: string[] = [],
    aspectRatio: string = '16:9'
  ): Promise<string> {
    const ai = this.getAI();
    
    // Combine all available images for Veo reference
    const allImages = [...referenceImages, ...talentImages, ...productImages];
    const hasMultiple = allImages.length > 1;
    const model = hasMultiple ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';

    const videoConfig: any = {
      model,
      prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio as any
      }
    };

    if (hasMultiple) {
      // Veo supports up to 3 reference images for 'veo-3.1-generate-preview'
      const refImagesPayload = allImages.slice(0, 3).map(img => ({
        image: { 
          imageBytes: img.includes(',') ? img.split(',')[1] : img, 
          mimeType: 'image/png' 
        },
        referenceType: VideoGenerationReferenceType.ASSET,
      }));
      
      videoConfig.config.referenceImages = refImagesPayload;
      videoConfig.config.resolution = '720p';
      videoConfig.config.aspectRatio = '16:9'; // Multi-ref requires 16:9 as per guidelines
    } else if (allImages.length === 1) {
      videoConfig.image = {
        imageBytes: allImages[0].includes(',') ? allImages[0].split(',')[1] : allImages[0],
        mimeType: 'image/png'
      };
    }

    let operation = await ai.models.generateVideos(videoConfig);

    // Polling until video generation is done
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 8000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video URI not found");

    // Must append API key when fetching from the download link for Veo responses
    const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    // Fix: cast to any or Blob to avoid 'unknown' assignment issues in certain TS environments
    const videoBlob = await videoResponse.blob() as Blob;
    return URL.createObjectURL(videoBlob);
  }
}

export const geminiService = new GeminiService();
