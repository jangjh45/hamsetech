package com.hamsetech.hamsetech;

/**
 * 테스트 전용 JWT 서명 키.
 *
 * 같은 문자열이 테스트 파일 여럿에 박혀 있으면 두 가지 문제가 생긴다. 하나는
 * 스캐너가 테스트 값을 실제 키로 오인한다는 것 — 여기서 상수로 모은 것만으로는
 * 그 오인을 닫을 수 없다. 스캐너는 값의 형태만 보고, "테스트다"는 정보를 알
 * 방법이 없기 때문이다. 다른 하나는 값을 고칠 파일이 여럿이라는 것.
 *
 * 실제 서명 키는 {@code JWT_SECRET} 환경 변수에서 오고, 저장소에는 커밋되지
 * 않는다. 이 값은 그 키와 아무 관련이 없다. 시크릿 스캐너 경고를 줄이려는
 * 목적이 아니라, 값을 고칠 때 여러 테스트를 동시에 만지지 않게 하려는 것이다.
 */
public final class TestJwtSecrets {

    /**
     * HMAC-SHA 키 요구 길이를 넘기는 가짜 시크릿.
     *
     * 짧게 잡으면 {@code JwtService} 기동에서 죽는다({@code too-short} 시나리오).
     * 시크릿 특징을 흉내내야 하므로 고정 문자열을 쓰는데, 실제 서명이 아니라
     * "이 값으로 서명·검증이 잘 통한다"만 보이면 되는 곳에 쓴다.
     */
    public static final String HMAC_SHA_KEY = "test-only-key-not-used-for-any-real-signing-operation-0123456789abcdef";

    /** 위와 다른 값. 이 값으로 만든 토큰이 첫 키로는 깨진다는 걸 보일 때 쓴다. */
    public static final String DIFFERENT_HMAC_SHA_KEY =
            "another-test-only-key-never-issued-for-any-production-purpose-0123456789abcdef";

    private TestJwtSecrets() {
    }
}
