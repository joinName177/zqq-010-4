import { ArchaeologyReport, ImportErrorKind, StrataLayer } from '../core/models';
import { SampleSite } from '../adapters/sample-data.adapter';
import { isDefaultReport } from '../core/default-report';

export interface ImportErrorState {
  kind: ImportErrorKind;
  message: string;
  sourceName?: string;
}

export interface UIEventHandlers {
  onSelectPreset: (siteId: string) => void;
  onUploadFile: (file: File) => void;
  onOpenReport: () => void;
  onRestoreDefault: () => void;
  onDismissError: () => void;
}

const ERROR_TITLES: Record<ImportErrorKind, string> = {
  'empty-file': '空文件 · 未检测到任何对话内容',
  'no-valid-messages': '无有效消息 · 未识别出对话记录',
  'empty-preset': '空预设 · 遗址标本数据缺失',
  'import-failure': '导入失败 · 文件读取或解析异常'
};

export function renderApp(
  container: HTMLElement,
  report: ArchaeologyReport,
  sampleSites: SampleSite[],
  selectedSiteId: string,
  selectedLayerIndex: number,
  isReportOpen: boolean,
  importError: ImportErrorState | null,
  handlers: UIEventHandlers,
  onSelectLayer: (idx: number) => void,
  onCloseReport: () => void
) {
  const hasStrata = report.strata.length > 0;
  // 越界保护：无论外部传入什么索引，都只会访问真实存在的地层
  const safeLayerIndex = hasStrata
    ? Math.min(Math.max(selectedLayerIndex, 0), report.strata.length - 1)
    : -1;
  const currentLayer: StrataLayer | null = safeLayerIndex >= 0 ? report.strata[safeLayerIndex] : null;
  const isDefault = isDefaultReport(report);

  const escapeHtml = (str: string) =>
    str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));

  container.innerHTML = `
    <div class="archaeo-app">
      <header class="site-header">
        <div class="brand">
          <div class="brand-icon">⛏️</div>
          <div>
            <h1>对话地层学 · 关系考古勘探系统</h1>
            <p>RELATIONSHIP STRATIGRAPHY &amp; EXCAVATION REPORT · v1.0.0</p>
          </div>
        </div>
        <div class="header-status">
          <span>${
            hasStrata
              ? `● 发掘就绪 | 标本勘测点：${escapeHtml(report.siteCode)}`
              : '○ 空白遗址 · 等待对话标本入库'
          }</span>
        </div>
      </header>

      ${
        importError
          ? `
        <section class="import-error-banner" role="alert">
          <div class="error-icon">⚠️</div>
          <div class="error-body">
            <div class="error-title">${ERROR_TITLES[importError.kind]}</div>
            <div class="error-message">${escapeHtml(importError.message)}</div>
          </div>
          <div class="error-actions">
            <button class="btn-retry" id="btnRetryImport">🔄 重新导入</button>
            <button class="btn-secondary" id="btnRestoreDefault">🏺 恢复默认标本</button>
            <button class="btn-dismiss" id="btnDismissError" title="关闭提示">✕</button>
          </div>
        </section>
      `
          : ''
      }

      <section class="control-hub">
        <div class="preset-sites">
          <div class="preset-title">
            <span>🏺 历史遗址标本库 (点击切换发掘地)：</span>
          </div>
          <div class="preset-btns">
            ${sampleSites
              .map(
                s => `
              <button class="btn-preset ${s.id === selectedSiteId ? 'active' : ''}" data-site="${s.id}">
                <strong>${escapeHtml(s.name)}</strong>
                <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(s.eraSpan)}</div>
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="upload-section">
          <div class="drop-area" id="dropArea">
            <input type="file" id="chatFileInput" class="file-input" accept=".txt,.json,.csv" />
            <p>📄 拖拽或点击导入本地聊天记录文件 (支持微信/QQ/短信文本导出格式)</p>
            <span style="font-size:12px;color:var(--text-muted);">纯前端本地地质切片计算，无任何网络传输</span>
          </div>
          <button class="btn-report" id="btnOpenReport">
            📜 生成关系考古报告
          </button>
        </div>
      </section>

      <main class="strata-layout">
        <!-- Left: Stratigraphic Column -->
        <section class="core-column-wrap">
          <div class="column-title">
            <h3>🏛️ 对话地层岩芯柱 (自浅入深)</h3>
            <span class="depth-indicator">总发掘深度: ${report.strata.length * 2.5}m</span>
          </div>
          <div class="strata-stack">
            ${
              hasStrata
                ? report.strata
                    .map(
                      (layer, idx) => `
              <div class="strata-card ${idx === safeLayerIndex ? 'selected' : ''}"
                   data-layer="${idx}"
                   style="--layer-color: ${layer.colorHex}">
                <div class="strata-card-header">
                  <span class="layer-tag">Layer 0${layer.depthLevel} · ${layer.geologicalCode}</span>
                  <span class="layer-depth">深度 -${(layer.depthLevel * 2.4).toFixed(1)}m</span>
                </div>
                <div class="layer-name">${escapeHtml(layer.epochName)}</div>
                <div class="layer-meta">
                  <span>${layer.timeRange.start} ~ ${layer.timeRange.end}</span>
                  <span class="temp-badge">${layer.temperatureCelsius}°C</span>
                </div>
              </div>
            `
                    )
                    .join('')
                : `
              <div class="empty-strata">
                <div class="empty-icon">🏜️</div>
                <p>空白遗址 · 尚未沉积任何对话地层</p>
                <span>导入聊天记录文件或选择完整遗址标本后，此处将生成五层地质构造</span>
              </div>
            `
            }
          </div>
        </section>

        <!-- Right: Layer Inspection Details -->
        <section class="detail-panel">
          ${
            currentLayer
              ? `
          <div class="detail-header">
            <div class="detail-epoch">
              Layer 0${currentLayer.depthLevel}：${escapeHtml(currentLayer.epochName)}
            </div>
            <div class="detail-lithology">
              <strong>岩相剖面特征：</strong>${escapeHtml(currentLayer.lithology)}
            </div>
          </div>

          <!-- Temperature -->
          <div class="temp-gauge-box">
            <div class="gauge-title">
              <span>关系地温指数：${currentLayer.temperatureCelsius}°C</span>
              <span>记录密度：${currentLayer.messageCount} 条对话遗存</span>
            </div>
            <div class="gauge-bar-bg">
              <div class="gauge-bar-fill" style="width: ${currentLayer.temperatureCelsius}%"></div>
            </div>
          </div>

          <!-- Emotional Sediment -->
          <div class="sediment-box">
            <div style="font-size:13px;color:var(--earth-accent);font-weight:600;">
              🧪 情感词汇沉积物化验分析 (Sediment Spectrum)：
            </div>
            <div class="sediment-bars">
              <div class="sediment-item">
                <span>依恋温存</span>
                <div class="sediment-progress"><div class="sediment-fill" style="width:${currentLayer.sediment.warmth}%;background:#e76f51;"></div></div>
                <span>${currentLayer.sediment.warmth}%</span>
              </div>
              <div class="sediment-item">
                <span>牵挂思念</span>
                <div class="sediment-progress"><div class="sediment-fill" style="width:${currentLayer.sediment.longing}%;background:#f4a261;"></div></div>
                <span>${currentLayer.sediment.longing}%</span>
              </div>
              <div class="sediment-item">
                <span>生活琐碎</span>
                <div class="sediment-progress"><div class="sediment-fill" style="width:${currentLayer.sediment.daily}%;background:#2a9d8f;"></div></div>
                <span>${currentLayer.sediment.daily}%</span>
              </div>
              <div class="sediment-item">
                <span>情绪摩擦</span>
                <div class="sediment-progress"><div class="sediment-fill" style="width:${currentLayer.sediment.friction}%;background:#9d0208;"></div></div>
                <span>${currentLayer.sediment.friction}%</span>
              </div>
              <div class="sediment-item">
                <span>沉默冷却</span>
                <div class="sediment-progress"><div class="sediment-fill" style="width:${currentLayer.sediment.silence}%;background:#6c757d;"></div></div>
                <span>${currentLayer.sediment.silence}%</span>
              </div>
            </div>
          </div>

          <!-- Dominant Topics -->
          <div style="background:var(--panel-card);padding:16px;border-radius:8px;border:1px solid var(--border-color);">
            <div style="font-size:13px;color:var(--earth-accent);margin-bottom:6px;">
              🏷️ 该层出土核心话题印记：
            </div>
            <div class="topics-cloud">
              ${currentLayer.dominantTopics.map(t => `<span class="topic-chip">${escapeHtml(t)}</span>`).join('')}
            </div>
          </div>

          <!-- Fossils in this layer -->
          <div class="fossils-section">
            <h4>⛏️ 该层位代表性对话化石 (Unearthed Artifacts)</h4>
            <div class="fossil-cards">
              ${
                currentLayer.fossilRelics.length > 0
                  ? currentLayer.fossilRelics
                      .map(
                        f => `
                    <div class="fossil-item">
                      <div class="fossil-top">
                        <span class="fossil-badge">${escapeHtml(f.category)}</span>
                        <span style="font-family:var(--font-mono);color:var(--text-muted);">${f.dateStr} · 发掘深度 -${f.depthMeters.toFixed(1)}m</span>
                      </div>
                      <div class="fossil-quote">“${escapeHtml(f.quote)}”</div>
                      <div class="fossil-notes">🔬 考古学鉴定：${escapeHtml(f.archaeologicalNotes)} (保存完好度: ${f.preservationScore}%)</div>
                    </div>
                  `
                      )
                      .join('')
                  : `<div style="color:var(--text-muted);font-size:13px;">该地层未发现突异晶体化石，呈现均匀日常沉积。</div>`
              }
            </div>
          </div>
          `
              : `
          <!-- Empty state: no strata available -->
          <div class="empty-detail">
            <div class="empty-icon">⛏️</div>
            <h3>暂无可供勘测的地层</h3>
            <p>当前遗址尚未出土任何地质层位。请导入微信 / QQ / 短信聊天记录文件，或恢复默认遗址标本后开始发掘。</p>
            <div class="empty-actions">
              <button class="btn-report" id="btnEmptyImport">📄 导入对话标本</button>
              <button class="btn-secondary" id="btnEmptyRestore">🏺 恢复默认标本</button>
            </div>
          </div>
          `
          }
        </section>
      </main>

      <!-- Modal: Report -->
      ${
        isReportOpen
          ? `
        <div class="modal-overlay" id="reportOverlay">
          <div class="modal-content">
            <div class="report-seal">国家地层考古认证</div>
            <div class="report-header">
              <h2>《${escapeHtml(report.siteName)}》关系考古发掘总报告</h2>
              <div class="report-sub">
                ARCHAEOLOGICAL FIELD REPORT · 编号 ${escapeHtml(report.siteCode)} · 发掘时间：${report.excavatedAt}
              </div>
            </div>

            <div class="report-grid">
              <div class="report-stat-card">
                <div class="val">${report.totalDays} 天</div>
                <div class="lbl">对话地质沉淀跨度</div>
              </div>
              <div class="report-stat-card">
                <div class="val">${report.totalMessages} 条</div>
                <div class="lbl">出土总话语标本</div>
              </div>
              <div class="report-stat-card">
                <div class="val">${report.carbon14Activity}%</div>
                <div class="lbl">碳14现代残余活性</div>
              </div>
            </div>

            ${
              isDefault
                ? `
              <div class="report-section report-empty-note">
                <h4>⚠️ 系统默认空白报告</h4>
                <p>当前报告由系统默认生成，尚未基于真实对话标本发掘。导入有效聊天记录或选择完整遗址标本后，此处将呈现真实的地层纪年、温差曲线与文物鉴定结果。</p>
              </div>
            `
                : ''
            }

            <div class="report-section">
              <h4>地层温差纪年：</h4>
              <p>最高温纪元：<strong>${escapeHtml(report.peakEpoch)}</strong></p>
              <p>渐冷纪元：<strong>${escapeHtml(report.coolingEpoch)}</strong></p>
            </div>

            <div class="report-section">
              <h4>地质剖面综述：</h4>
              <p>${escapeHtml(report.archaeologicalSummary)}</p>
            </div>

            <div class="report-section">
              <h4>馆藏专家终审评定：</h4>
              <p>“${escapeHtml(report.curatorAssessment)}”</p>
            </div>

            <div class="report-actions">
              <button class="btn-secondary" id="btnCloseReport">关闭报告</button>
              <button class="btn-report" onclick="window.print()">🖨️ 打印 / 保存标本档案</button>
            </div>
          </div>
        </div>
      `
          : ''
      }
    </div>
  `;

  // Attach event listeners
  container.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const siteId = btn.getAttribute('data-site');
      if (siteId) handlers.onSelectPreset(siteId);
    });
  });

  const dropArea = container.querySelector('#dropArea');
  const fileInput = container.querySelector('#chatFileInput') as HTMLInputElement;

  if (dropArea && fileInput) {
    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', e => {
      e.preventDefault();
      dropArea.classList.add('hover');
    });
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('hover'));
    dropArea.addEventListener('drop', e => {
      e.preventDefault();
      dropArea.classList.remove('hover');
      const files = (e as DragEvent).dataTransfer?.files;
      if (files && files.length > 0) {
        handlers.onUploadFile(files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) {
        handlers.onUploadFile(file);
      }
      // 重置选择器，保证重新导入同一文件时 change 事件仍会触发
      fileInput.value = '';
    });
  }

  container.querySelector('#btnOpenReport')?.addEventListener('click', () => {
    handlers.onOpenReport();
  });

  // 重新导入流程：错误横幅与空状态面板中的入口均直接打开文件选择器
  container.querySelector('#btnRetryImport')?.addEventListener('click', () => {
    (container.querySelector('#chatFileInput') as HTMLInputElement | null)?.click();
  });

  container.querySelector('#btnEmptyImport')?.addEventListener('click', () => {
    (container.querySelector('#chatFileInput') as HTMLInputElement | null)?.click();
  });

  container.querySelector('#btnRestoreDefault')?.addEventListener('click', () => {
    handlers.onRestoreDefault();
  });

  container.querySelector('#btnEmptyRestore')?.addEventListener('click', () => {
    handlers.onRestoreDefault();
  });

  container.querySelector('#btnDismissError')?.addEventListener('click', () => {
    handlers.onDismissError();
  });

  container.querySelectorAll('.strata-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.getAttribute('data-layer') || '0', 10);
      onSelectLayer(idx);
    });
  });

  container.querySelector('#btnCloseReport')?.addEventListener('click', () => {
    onCloseReport();
  });

  container.querySelector('#reportOverlay')?.addEventListener('click', e => {
    if (e.target === container.querySelector('#reportOverlay')) {
      onCloseReport();
    }
  });
}
