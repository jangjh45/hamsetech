import { useEffect, useState } from 'react'

/**
 * 닉네임 인라인 편집.
 * 목록이 다시 로드돼도 방금 친 값이 남지 않도록 서버 값(initial)이 바뀌면 입력도 따라간다.
 */
export default function DisplayNameEditor({
  initial,
  onSave,
}: {
  initial: string
  onSave: (value: string) => Promise<void>
}) {
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(initial)
  }, [initial])

  async function save() {
    setSaving(true)
    try {
      await onSave(value)
    } finally {
      setSaving(false)
    }
  }

  return (
    <span className="ad-name-edit">
      <input
        className="fl-input"
        placeholder="이름/닉네임"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <button className="fl-btn fl-btn-sm" onClick={save} disabled={saving || value === initial}>
        저장
      </button>
    </span>
  )
}