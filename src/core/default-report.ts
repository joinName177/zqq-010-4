import { ArchaeologyReport } from './models';

/** 系统默认空白报告的固定勘测编号 */
export const DEFAULT_REPORT_SITE_CODE = 'RELIC-ARCH-000000';

/**
 * 生成系统默认空白报告。
 *
 * 当空文件、无有效消息、空预设或导入失败导致无法生成真实地层报告时，
 * 界面统一回落到该默认报告：strata 为空数组、统计归零、文案为占位提示。
 * 由此保证 UI 永远不会访问到 undefined 的地层，也不会残留上一份旧报告。
 */
export function createDefaultReport(siteName = '未命名空白遗址'): ArchaeologyReport {
  return {
    siteCode: DEFAULT_REPORT_SITE_CODE,
    siteName,
    excavatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    totalMessages: 0,
    totalDays: 0,
    carbon14Activity: 0,
    strata: [],
    notableRelics: [],
    peakEpoch: '暂无纪年数据',
    coolingEpoch: '暂无纪年数据',
    archaeologicalSummary:
      '尚未导入有效对话标本，遗址剖面处于未发掘状态。本报告为系统默认空白档案，导入有效聊天记录后将生成真实的地层构造。',
    curatorAssessment: '空白遗址待勘 · 请导入对话标本或选择完整遗址标本后重新鉴定'
  };
}

/** 判断报告是否为系统默认空白报告（无真实地层） */
export function isDefaultReport(report: ArchaeologyReport): boolean {
  return report.siteCode === DEFAULT_REPORT_SITE_CODE || report.strata.length === 0;
}
