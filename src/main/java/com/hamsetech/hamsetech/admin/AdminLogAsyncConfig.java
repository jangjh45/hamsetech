package com.hamsetech.hamsetech.admin;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * 조회 로그 전용 실행기.
 *
 * 공용 실행기를 쓰지 않는 이유는, 감사 로그가 다른 비동기 작업과 큐를 나눠 쓰면
 * 어느 쪽이 밀렸는지 구분할 수 없기 때문이다. 이 큐만 보면 조회 로그가 밀리는지
 * 바로 보인다.
 */
@Configuration
@EnableAsync
public class AdminLogAsyncConfig {

    public static final String READ_LOG_EXECUTOR = "adminReadLogExecutor";

    @Bean(name = READ_LOG_EXECUTOR)
    public Executor adminReadLogExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        // 조회 로그는 짧은 INSERT 하나다. 스레드를 많이 둘 이유가 없고,
        // 많이 두면 DB 커넥션 풀만 잠식한다.
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("admin-read-log-");

        // 큐가 가득 차면 호출한 스레드가 직접 저장한다. 감사 기록을 버리는 것보다
        // 그 요청 하나가 느려지는 편이 낫다. 조용히 사라지는 감사 로그는
        // 없는 것보다 나쁘다 — 있다고 믿게 만들기 때문이다.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());

        // 종료 시 큐에 남은 것을 마저 쓴다. 이게 없으면 재배포 때마다 마지막 몇 건이 사라진다.
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);

        executor.initialize();
        return executor;
    }
}
