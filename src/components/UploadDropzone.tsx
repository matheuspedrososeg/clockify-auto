import { Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import type { ReportVM } from '../hooks/useReport'
import { useI18n } from '../i18n/useI18n'

const { Dragger } = Upload

interface UploadDropzoneProps {
  report: ReportVM
  onBeforeProcess: () => void
}

export function UploadDropzone({ report, onBeforeProcess }: UploadDropzoneProps) {
  const { t } = useI18n()
  const { loading, canProcess, processFile } = report

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    showUploadList: false,
    beforeUpload: async (file) => {
      await processFile(file, onBeforeProcess)
      return false
    },
  }

  return (
    <div className="upload-area">
      <Dragger {...uploadProps} disabled={loading || !canProcess}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{t.upload.text}</p>
        <p className="ant-upload-hint">{t.upload.hint}</p>
      </Dragger>
    </div>
  )
}
