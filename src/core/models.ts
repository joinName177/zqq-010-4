export interface ChatMessage {
  id: string;
  timestamp: Date;
  sender: string;
  content: string;
  sentimentScore: number; // -1.0 to 1.0
  wordCount: number;
}

export type RelicCategory = '初识刻石' | '誓约泥版' | '交锋裂痕' | '深夜篝火' | '寂静化石';

export interface FossilArtifact {
  id: string;
  name: string;
  category: RelicCategory;
  depthMeters: number;
  dateStr: string;
  sender: string;
  quote: string;
  archaeologicalNotes: string;
  preservationScore: number; // 0 - 100
}

export interface EmotionalSediment {
  warmth: number;   // 依恋温存 %
  longing: number;  // 牵挂思念 %
  daily: number;    // 生活琐碎 %
  friction: number; // 情绪摩擦 %
  silence: number;  // 沉默冷却 %
}

export interface StrataLayer {
  depthLevel: number; // 1 to 5 (1 = 最浅层，5 = 最深古基岩)
  epochName: string;
  geologicalCode: string;
  lithology: string; // 岩性描述 (如：风化黄土带, 细砂沉积带, 坚硬花岗基岩)
  timeRange: { start: string; end: string };
  messageCount: number;
  temperatureCelsius: number; // 关系温度 (0 - 100)
  dominantTopics: string[];
  sediment: EmotionalSediment;
  fossilRelics: FossilArtifact[];
  colorHex: string;
  soilPattern: string;
}

/** 导入/发掘失败的分类，用于界面呈现针对性的错误提示与恢复入口 */
export type ImportErrorKind =
  | 'empty-file'         // 空文件：文件无任何文本内容
  | 'no-valid-messages'  // 无有效消息：文件有内容但识别不出对话
  | 'empty-preset'       // 空预设：遗址标本数据缺失或已损坏
  | 'import-failure';    // 导入失败：文件读取或解析过程异常

export interface ArchaeologyReport {
  siteCode: string;
  siteName: string;
  excavatedAt: string;
  totalMessages: number;
  totalDays: number;
  carbon14Activity: number; // 碳14残留活性 %
  strata: StrataLayer[];
  notableRelics: FossilArtifact[];
  peakEpoch: string;
  coolingEpoch: string;
  archaeologicalSummary: string;
  curatorAssessment: string;
}
