
export interface GenerationHistory {
  id: string;
  timestamp: number;
  productName: string;
  prompt: string;
  storyboard?: string;
  voiceScript?: string;
  referenceImages?: string[];
  talentImages?: string[];
  productImages?: string[];
  videoUrl?: string;
  status: 'pending' | 'completed' | 'failed';
}

export enum AspectRatio {
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16'
}

export interface PromptConfig {
  productName: string;
  targetAudience: string;
  style: string;
  tone: string;
  duration: string;
  storyboard: string;
  voiceScript: string;
}

export interface VideoState {
  isGenerating: boolean;
  progress: number;
  currentMessage: string;
}
