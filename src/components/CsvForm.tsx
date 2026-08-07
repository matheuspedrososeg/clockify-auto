import { Button, Select, Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import type { ReportVM } from '../hooks/useReport'
import type { CsvField } from '../types/timesheet'
import type { Dictionary } from '../i18n/dictionaries'
import { useI18n } from '../i18n/useI18n'

function buildFields(t: Dictionary): Array<{ field: CsvField; label: string }> {
  return [
    { field: 'date', label: t.table.date },
    { field: 'morningCheckIn', label: t.table.checkIn },
    { field: 'morningCheckOut', label: t.table.lunchOut },
    { field: 'afternoonCheckIn', label: t.table.lunchIn },
    { field: 'afternoonCheckOut', label: t.table.checkOut },
  ]
}

interface CsvFormProps {
  report: ReportVM
  onGenerate: () => void
}

export function CsvForm({ report, onGenerate }: CsvFormProps) {
  const { t } = useI18n()
  const { loading, csvTable, csvFileName, csvMapping, loadCsvFile, setCsvMappingField, clearCsv } =
    report

  if (!csvTable) {
    const uploadProps: UploadProps = {
      name: 'file',
      accept: '.csv,text/csv',
      multiple: false,
      showUploadList: false,
      beforeUpload: async (file) => {
        await loadCsvFile(file)
        return false
      },
    }

    return (
      <div className="upload-area">
        <Upload.Dragger {...uploadProps} disabled={loading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t.csv.dropText}</p>
          <p className="ant-upload-hint">{t.csv.dropHint}</p>
        </Upload.Dragger>
      </div>
    )
  }

  const headerOptions = csvTable.headers.map(header => ({ label: header, value: header }))

  return (
    <div className="csv-form">
      <div className="csv-file-row">
        <span className="csv-file-name">{csvFileName}</span>
        <Button type="link" size="small" onClick={clearCsv}>
          {t.csv.change}
        </Button>
      </div>

      {buildFields(t).map(({ field, label }) => (
        <div className="config-field csv-field" key={field}>
          <label>{label}</label>
          <Select
            value={csvMapping[field]}
            onChange={value => setCsvMappingField(field, value ?? null)}
            options={headerOptions}
            placeholder={t.csv.columnPlaceholder}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
          />
        </div>
      ))}

      <Button type="primary" disabled={!csvMapping.date} onClick={onGenerate}>
        {t.source.generate}
      </Button>

      <p className="period-hint">{t.csv.hint}</p>
    </div>
  )
}
