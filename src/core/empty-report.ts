import { ArchaeologyReport } from './models';

export const EMPTY_SITE_NAME = '空白勘探区 · 等待对话标本';

/**
 * 默认空报告（安全降级状态）。
 * 当导入失败、文件为空、无有效消息或预设标本为空时，
 * 界面统一切换到该默认报告，避免残留旧报告或访问不存在的地层。
 */
export function createEmptyReport(
  siteName: string = EMPTY_SITE_NAME,
  reason = '尚未发掘到有效对话地层。请导入聊天记录文件，或从标本库选择一处历史遗址开始勘探。'
): ArchaeologyReport {
  return {
    siteCode: 'RELIC-ARCH-000000',
    siteName,
    excavatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    totalMessages: 0,
    totalDays: 0,
    carbon14Activity: 0,
    strata: [],
    notableRelics: [],
    peakEpoch: '暂无纪年数据',
    coolingEpoch: '暂无纪年数据',
    archaeologicalSummary: reason,
    curatorAssessment: '馆藏待建 · 勘探队尚未获得可鉴定的对话标本'
  };
}

/** 判断报告是否为空白状态（无任何地层切片） */
export function isEmptyReport(report: ArchaeologyReport | null | undefined): boolean {
  return !report || !Array.isArray(report.strata) || report.strata.length === 0;
}
