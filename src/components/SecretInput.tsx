import { useState } from 'react'
import { Input } from 'antd'
import { Eye, EyeOff } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'

interface SecretInputProps {
  value: string
  placeholder: string
  disabled?: boolean
  onChange: (value: string) => void
  onPressEnter?: () => void
}

/**
 * Masks through CSS rather than type="password" so the browser never treats an API key
 * as a credential and never offers to save or autofill it.
 */
export function SecretInput({
  value,
  placeholder,
  disabled,
  onChange,
  onPressEnter,
}: SecretInputProps) {
  const { t } = useI18n()
  const [revealed, setRevealed] = useState(false)

  return (
    <Input
      className={revealed ? '' : 'is-masked'}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete="off"
      spellCheck={false}
      onChange={e => onChange(e.target.value)}
      onPressEnter={onPressEnter}
      suffix={
        <button
          type="button"
          className="secret-toggle"
          aria-label={revealed ? t.secret.hide : t.secret.reveal}
          onClick={() => setRevealed(prev => !prev)}
        >
          {revealed ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      }
    />
  )
}
