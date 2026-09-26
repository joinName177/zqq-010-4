import './ui/styles.css';
import { UniversalChatParserAdapter } from './adapters/chat-parser.adapter';
import { SampleSitesAdapter } from './adapters/sample-data.adapter';
import { ArchaeologyEngineAdapter } from './adapters/archaeology-engine.adapter';
import { renderApp } from './ui/app';
import { ArchaeologyReport, ChatMessage } from './core/models';
import { createEmptyReport } from './core/empty-report';
import { calculateReportMetrics } from './core/report-metrics';
import { reportTelemetry } from './adapters/report-telemetry';
import { buildBugSurface } from './adapters/quality/bugSurface';

const parser = new UniversalChatParserAdapter();
const sampleAdapter = new SampleSitesAdapter();
const engine = new ArchaeologyEngineAdapter();

const sampleSites = sampleAdapter.getSites();

let selectedSiteId = '';
let currentReport: ArchaeologyReport = createEmptyReport();
let selectedLayerIndex = 0;
let isReportOpen = false;
let importError: string | null = null;

/**
 * 安全发掘：任何空数据 / 异常数据都统一切换到默认空报告，
 * 并以 importError 形式在界面给出错误提示，绝不残留旧报告。
 */
function excavateSafely(messages: ChatMessage[] | undefined, siteName: string) {
  if (!messages || messages.length === 0) {
    currentReport = createEmptyReport(siteName);
    importError = `「${siteName}」没有可用的对话标本，已切换到空白勘探区。`;
    return;
  }
  try {
    currentReport = engine.excavateSite(messages, siteName);
    importError = null;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    currentReport = createEmptyReport(siteName);
    importError = `地层发掘失败：${reason}`;
  }
}

// 初始遗址：标本库为空时进入空白勘探区，而不是直接崩溃
const firstSite = sampleSites[0];
if (firstSite) {
  selectedSiteId = firstSite.id;
  excavateSafely(firstSite.data, firstSite.name);
} else {
  importError = '历史遗址标本库为空，请直接导入聊天记录文件开始勘探。';
}

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
        const target = sampleSites.find(s => s.id === siteId);
        selectedLayerIndex = 0;
        if (!target) {
          selectedSiteId = '';
          currentReport = createEmptyReport();
          importError = '未找到对应的历史遗址标本，可能已被移除，请重新选择或导入文件。';
        } else {
          selectedSiteId = siteId;
          excavateSafely(target.data, target.name);
        }
        update();
      },
      onUploadFile: async (file: File) => {
        selectedLayerIndex = 0;
        try {
          const text = await file.text();
          if (!text || !text.trim()) {
            throw new Error('文件内容为空，未检测到任何对话文本');
          }
          const msgs = await parser.parse(text);
          if (msgs.length === 0) {
            throw new Error('未能从该文件中解析出有效对话记录，请检查文件格式');
          }
          selectedSiteId = 'custom-upload';
          currentReport = engine.excavateSite(msgs, `自定义导入档案 · ${file.name}`);
          importError = null;
        } catch (err) {
          // 导入失败：切换到默认空报告并提示，绝不留存上一份旧报告
          const reason = err instanceof Error ? err.message : String(err);
          selectedSiteId = '';
          currentReport = createEmptyReport(`导入失败 · ${file.name}`);
          importError = `导入失败：${reason}。已切换到空白勘探区，请重新导入有效文件或选择示例遗址。`;
        }
        update();
      },
      onOpenReport: () => {
        isReportOpen = true;
        update();
      },
      onDismissError: () => {
        importError = null;
        update();
      },
      onLoadSample: () => {
        // 重新导入流程：从标本库载入第一个有数据的示例遗址
        const target = sampleSites.find(s => s.data && s.data.length > 0) || sampleSites[0];
        selectedLayerIndex = 0;
        if (target) {
          selectedSiteId = target.id;
          excavateSafely(target.data, target.name);
        } else {
          importError = '标本库为空，无法载入示例遗址，请导入本地聊天记录文件。';
        }
        update();
      }
    },
    (layerIdx: number) => {
      // 越界保护：不允许选中不存在的地层
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
