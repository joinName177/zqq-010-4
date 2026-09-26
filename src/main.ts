import './ui/styles.css';
import { UniversalChatParserAdapter, ChatParseError } from './adapters/chat-parser.adapter';
import { SampleSitesAdapter } from './adapters/sample-data.adapter';
import { ArchaeologyEngineAdapter } from './adapters/archaeology-engine.adapter';
import { renderApp, ImportErrorState } from './ui/app';
import { ArchaeologyReport } from './core/models';
import { createDefaultReport } from './core/default-report';
import { calculateReportMetrics } from './core/report-metrics';
import { reportTelemetry } from './adapters/report-telemetry';
import { buildBugSurface } from './adapters/quality/bugSurface';

const parser = new UniversalChatParserAdapter();
const sampleAdapter = new SampleSitesAdapter();
const engine = new ArchaeologyEngineAdapter();

const sampleSites = sampleAdapter.getSites();

interface PresetExcavation {
  report: ArchaeologyReport;
  error: ImportErrorState | null;
}

/**
 * 统一的预设发掘入口：空预设、缺失标本或引擎异常时，
 * 一律回落到系统默认空白报告并附带明确的错误提示，
 * 保证界面不会残留旧报告，也不会访问不存在的地层。
 */
function excavatePreset(siteId: string): PresetExcavation {
  const target = sampleSites.find(s => s.id === siteId);
  if (!target) {
    return {
      report: createDefaultReport(),
      error: { kind: 'empty-preset', message: '标本库中不存在该遗址（可能已被移除），请选择其他标本或导入本地聊天记录。' }
    };
  }
  if (!target.data || target.data.length === 0) {
    return {
      report: createDefaultReport(target.name),
      error: {
        kind: 'empty-preset',
        sourceName: target.name,
        message: `遗址标本${target.name}的数据为空或已损坏，无法切片勘探。请选择其他标本或导入本地聊天记录。`
      }
    };
  }
  const result = engine.tryExcavateSite(target.data, target.name);
  if (result.ok) {
    return { report: result.report, error: null };
  }
  return {
    report: createDefaultReport(target.name),
    error: { kind: 'import-failure', sourceName: target.name, message: `遗址标本发掘失败：${result.error.message}` }
  };
}

// 启动时优先选择第一个数据完整的标本，全部缺失时进入空白安全状态
const firstViableSiteId = (sampleSites.find(s => s.data && s.data.length > 0) ?? sampleSites[0])?.id ?? '';
const initialState: PresetExcavation = firstViableSiteId
  ? excavatePreset(firstViableSiteId)
  : {
      report: createDefaultReport(),
      error: { kind: 'empty-preset', message: '历史遗址标本库为空，请导入本地聊天记录文件开始发掘。' }
    };

let selectedSiteId = firstViableSiteId;
let currentReport: ArchaeologyReport = initialState.report;
let importError: ImportErrorState | null = initialState.error;
let selectedLayerIndex = 0;
let isReportOpen = false;

const appRoot = document.getElementById('app')!;
const bugSurface = buildBugSurface([currentReport.totalMessages, currentReport.strata.length]);
appRoot.dataset.reportTelemetry = reportTelemetry('sample', {
  ...calculateReportMetrics(currentReport),
  bug: bugSurface.values[0],
  bugCount: bugSurface.bugs.length
});
appRoot.dataset.preembeddedBugs = JSON.stringify({
  bugs: bugSurface.bugs,
  affectedLayers: bugSurface.affectedLayers,
  digest: bugSurface.digest
});

function update() {
  renderApp(
    appRoot,
    currentReport,
    sampleSites,
    selectedSiteId,
    selectedLayerIndex,
    isReportOpen,
    importError,
    {
      onSelectPreset: (siteId: string) => {
        const next = excavatePreset(siteId);
        selectedSiteId = siteId;
        currentReport = next.report;
        importError = next.error;
        selectedLayerIndex = 0;
        update();
      },
      onUploadFile: async (file: File) => {
        const uploadSiteName = `自定义导入档案 · ${file.name}`;
        try {
          const text = await file.text();
          const msgs = await parser.parseStrict(text);
          const result = engine.tryExcavateSite(msgs, uploadSiteName);
          if (result.ok) {
            currentReport = result.report;
            importError = null;
          } else {
            currentReport = createDefaultReport(uploadSiteName);
            importError = {
              kind: 'import-failure',
              sourceName: file.name,
              message: `文件「${file.name}」发掘失败：${result.error.message}`
            };
          }
        } catch (err) {
          // 空文件 / 无有效消息 / 读取异常：统一回落默认报告 + 分类错误提示
          currentReport = createDefaultReport(uploadSiteName);
          if (err instanceof ChatParseError) {
            importError = { kind: err.kind, sourceName: file.name, message: err.message };
          } else {
            const reason = err instanceof Error ? err.message : String(err);
            importError = {
              kind: 'import-failure',
              sourceName: file.name,
              message: `文件「${file.name}」读取或解析异常：${reason}`
            };
          }
        }
        selectedSiteId = 'custom-upload';
        selectedLayerIndex = 0;
        update();
      },
      onOpenReport: () => {
        isReportOpen = true;
        update();
      },
      onRestoreDefault: () => {
        if (!firstViableSiteId) {
          currentReport = createDefaultReport();
          importError = { kind: 'empty-preset', message: '历史遗址标本库为空，无法恢复默认标本，请导入本地聊天记录文件。' };
        } else {
          const next = excavatePreset(firstViableSiteId);
          selectedSiteId = firstViableSiteId;
          currentReport = next.report;
          importError = next.error;
        }
        selectedLayerIndex = 0;
        update();
      },
      onDismissError: () => {
        importError = null;
        update();
      }
    },
    (layerIdx: number) => {
      // 越界地层访问保护：仅接受当前报告中真实存在的层位
      if (layerIdx >= 0 && layerIdx < currentReport.strata.length) {
        selectedLayerIndex = layerIdx;
        update();
      }
    },
    () => {
      isReportOpen = false;
      update();
    }
  );
}

// Initial render
update();
