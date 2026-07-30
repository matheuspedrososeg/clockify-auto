import { Input, Segmented } from 'antd'
import type { AIModel, ReportVM } from '../hooks/useReport'
import { useI18n } from '../i18n/useI18n'
import { Panel } from './Panel'

const MODEL_OPTIONS = [
  { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash' },
  { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
]

interface AiModelPanelProps {
  report: ReportVM
}

export function AiModelPanel({ report }: AiModelPanelProps) {
  const { t } = useI18n()
  const {
    selectedModel, setSelectedModel,
    geminiApiKey, setGeminiApiKey,
    claudeApiKey, setClaudeApiKey,
  } = report

  return (
    <Panel index="01" title={t.ai.title} info={t.ai.info}>
      <div className="config-col">
        <Segmented
          block
          options={MODEL_OPTIONS}
          value={selectedModel}
          onChange={v => setSelectedModel(v as AIModel)}
        />
        {selectedModel === 'gemini-3.5-flash' && (
          <div className="config-field">
            <label>{t.ai.geminiKey}</label>
            <Input.Password
              placeholder={t.ai.geminiPlaceholder}
              value={geminiApiKey}
              onChange={e => setGeminiApiKey(e.target.value)}
            />
          </div>
        )}
        {selectedModel === 'claude-sonnet-4-6' && (
          <div className="config-field">
            <label>{t.ai.claudeKey}</label>
            <Input.Password
              placeholder={t.ai.claudePlaceholder}
              value={claudeApiKey}
              onChange={e => setClaudeApiKey(e.target.value)}
            />
          </div>
        )}
      </div>
    </Panel>
  )
}
