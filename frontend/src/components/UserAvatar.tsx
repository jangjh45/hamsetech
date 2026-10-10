interface Props {
  src?: string | null
  label: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/** 사용자 사진이 없거나 불러오지 못하면 기본 프로필 아이콘을 보여준다. */
export default function UserAvatar({ src, label, size = 'md', className = '' }: Props) {
  return (
    <span className={`ua-avatar ua-avatar-${size} ${className}`} role="img" aria-label={label}>
      <svg className="ua-avatar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="4" fill="currentColor" />
        <path d="M4.5 20c.55-4.05 3.45-6.5 7.5-6.5s6.95 2.45 7.5 6.5" fill="currentColor" />
      </svg>
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          loading={size === 'sm' ? 'lazy' : 'eager'}
          decoding="async"
          onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
        />
      )}
    </span>
  )
}
