import { Link } from 'react-router-dom'
import AuthShell from '../components/AuthShell'

/*
 * 비밀번호 재설정 안내.
 *
 * 예전에는 이 화면에서 아이디와 가입 이메일만 맞으면 그 자리에서 새 비밀번호를
 * 정할 수 있었다. 이메일을 실제로 받아보는 사람인지 확인하는 절차가 없어,
 * 사번 규칙과 사내 이메일 형식을 아는 사람이면 남의 계정을 가져갈 수 있었다.
 *
 * 메일 발송 인프라가 없으므로 자가 재설정 대신 관리자가 임시 비밀번호를 발급하는
 * 방식으로 바꿨다. 로그인 화면의 "비밀번호를 잊으셨나요?" 링크가 여기로 오므로
 * 라우트는 그대로 두고 내용만 안내로 바꾼다.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <div className="au-heading">
        <h2>비밀번호 재설정</h2>
        <p>관리자에게 요청하면 임시 비밀번호를 받을 수 있습니다.</p>
      </div>

      <div className="au-fields">
        <div className="au-alert is-info" role="status">
          <span className="au-glyph">!</span>
          본인 확인을 위해 비밀번호 재설정은 관리자를 통해서만 진행합니다.
        </div>

        <ol className="au-guide">
          <li>관리자에게 사번(아이디)을 알려주고 비밀번호 초기화를 요청하세요.</li>
          <li>전달받은 임시 비밀번호로 로그인합니다.</li>
          <li>로그인한 뒤 프로필 화면에서 새 비밀번호로 바꿔주세요.</li>
        </ol>

        <div className="au-alt">
          <Link className="fl-link" to="/login">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
