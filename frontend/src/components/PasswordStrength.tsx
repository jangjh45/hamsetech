// 비밀번호 강도 계산 (1: 약함, 2: 보통, 3: 강함, 4: 매우 강함)
export function getPasswordStrength(password: string): number {
  let strength = 0

  if (password.length >= 8) strength++
  if (password.length >= 12) strength++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
  if (/[0-9]/.test(password)) strength++
  if (/[^a-zA-Z0-9]/.test(password)) strength++

  return Math.min(strength, 4)
}

const LABELS = ['약함', '보통', '강함', '매우 강함']
const TONES = ['danger', 'warn', 'primary', 'success']

interface PasswordStrengthProps {
  password: string
}

// 4칸 막대 + 강도 텍스트. 회원가입 1단계와 프로필 비밀번호 변경이 같이 쓴다.
// 색은 --fl-* 토큰이라 라이트/다크가 자동으로 따라온다.
export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = password ? getPasswordStrength(password) : 0
  const tone = strength ? TONES[strength - 1] : null

  return (
    <div className="fl-strength">
      <div className="fl-strength-bars">
        {[1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={level <= strength ? `fl-strength-bar fl-tone-${tone}` : 'fl-strength-bar'}
          />
        ))}
      </div>
      <span className={tone ? `fl-strength-label fl-tone-${tone}` : 'fl-strength-label'}>
        {strength ? LABELS[strength - 1] : ''}
      </span>
    </div>
  )
}
