package com.hamsetech.hamsetech.admin;

import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.user.UserRole;
import com.hamsetech.hamsetech.notice.Notice;
import com.hamsetech.hamsetech.notice.NoticeRepository;
import com.hamsetech.hamsetech.scenario.PackingScenario;
import com.hamsetech.hamsetech.scenario.PackingScenarioRepository;
import com.hamsetech.hamsetech.scenario.PackingItem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Set;
import java.util.List;

@Configuration
public class AdminInitializer {

    @Bean
    CommandLineRunner seedAdmin(@Value("${admin.username:admin}") String adminUsername,
                                @Value("${admin.email:admin@example.com}") String adminEmail,
                                @Value("${admin.password:admin1234}") String adminPassword,
                                @Value("${admin.display-name:관리자}") String adminDisplayName,
                                @Value("${admin.reset-password-on-start:true}") boolean resetPasswordOnStart,
                                UserAccountRepository userRepository,
                                PasswordEncoder passwordEncoder,
                                NoticeRepository noticeRepository,
                                PackingScenarioRepository scenarioRepository) {
        return args -> {
            var existing = userRepository.findByUsername(adminUsername).orElse(null);
            if (existing == null) {
                UserAccount admin = new UserAccount();
                admin.setUsername(adminUsername);
                admin.setEmail(adminEmail);
                admin.setPasswordHash(passwordEncoder.encode(adminPassword));
                admin.setDisplayName(adminDisplayName != null && !adminDisplayName.isBlank() ? adminDisplayName : adminUsername);
                admin.setRoles(Set.of(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER));
                userRepository.save(admin);
                System.out.println("[ADMIN INIT] default admin created: " + adminUsername);
            } else {
                // Ensure ADMIN role exists
                var roles = existing.getRoles();
                if (!roles.contains(UserRole.ADMIN)) {
                    roles.add(UserRole.ADMIN);
                    existing.setRoles(roles);
                    System.out.println("[ADMIN INIT] added ADMIN role to existing user: " + adminUsername);
                }
                if (!roles.contains(UserRole.SUPER_ADMIN)) {
                    roles.add(UserRole.SUPER_ADMIN);
                    existing.setRoles(roles);
                    System.out.println("[ADMIN INIT] added SUPER_ADMIN role to existing user: " + adminUsername);
                }
                // Optionally reset password from properties (dev convenience)
                if (resetPasswordOnStart) {
                    existing.setPasswordHash(passwordEncoder.encode(adminPassword));
                    System.out.println("[ADMIN INIT] reset admin password on start for user: " + adminUsername);
                }
                // Ensure email populated
                if (existing.getEmail() == null || existing.getEmail().isBlank()) {
                    existing.setEmail(adminEmail);
                }
                // Ensure display name populated
                if (existing.getDisplayName() == null || existing.getDisplayName().isBlank()) {
                    existing.setDisplayName(adminDisplayName != null && !adminDisplayName.isBlank() ? adminDisplayName : adminUsername);
                    System.out.println("[ADMIN INIT] set display name for admin: " + existing.getDisplayName());
                }
                userRepository.save(existing);
            }

            // 샘플 공시사항 추가
            if (noticeRepository.count() == 0) {
                UserAccount admin = userRepository.findByUsername(adminUsername).orElse(null);
                if (admin != null) {
                    createSampleNotices(noticeRepository, admin);
                }
            }

            // 샘플 시뮬레이션 데이터 추가
            if (scenarioRepository.count() == 0) {
                UserAccount admin = userRepository.findByUsername(adminUsername).orElse(null);
                if (admin != null) {
                    createSampleScenarios(scenarioRepository, admin);
                }
            }
        };
    }

    private void createSampleNotices(NoticeRepository noticeRepository, UserAccount admin) {
        Notice notice1 = new Notice();
        notice1.setTitle("시스템 업데이트 안내");
        notice1.setContent("2025년 11월 중 시스템 성능 개선 및 새로운 기능을 추가하는 업데이트가 예정되어 있습니다. 업데이트 기간 동안 일시적으로 서비스 이용이 제한될 수 있으니 양해 부탁드립니다.\n\n주요 업데이트 내용:\n- 적재 시뮬레이션 알고리즘 개선\n- UI/UX 사용자 경험 향상\n- 새로운 보고서 기능 추가");
        notice1.setAuthorUsername(admin.getUsername());
        notice1.setAuthorDisplayName(admin.getDisplayName());
        noticeRepository.save(notice1);

        Notice notice2 = new Notice();
        notice2.setTitle("적재 시뮬레이션 사용 가이드");
        notice2.setContent("적재 시뮬레이션 기능을 효과적으로 사용하기 위한 가이드를 안내드립니다.\n\n1. 트럭 크기 설정: 실제 트럭의 내부 치수를 정확히 입력해주세요.\n2. 물품 등록: 각 물품의 실제 크기와 수량을 입력하세요.\n3. 회전 허용: 물품을 회전시켜 적재할 수 있는지 설정합니다.\n4. 마진 설정: 물품 간 안전 거리를 설정할 수 있습니다.\n\n더 자세한 사용법은 도움말을 참고해주세요.");
        notice2.setAuthorUsername(admin.getUsername());
        notice2.setAuthorDisplayName(admin.getDisplayName());
        noticeRepository.save(notice2);

        Notice notice3 = new Notice();
        notice3.setTitle("새로운 기능 소개: 시나리오 저장");
        notice3.setContent("이제 적재 시뮬레이션 설정을 저장하고 불러올 수 있습니다!\n\n새로운 기능:\n- 시나리오 저장: 자주 사용하는 설정을 저장하세요\n- 시나리오 불러오기: 저장된 설정을 빠르게 불러옵니다\n- 즐겨찾기: 자주 사용하는 시나리오를 즐겨찾기에 추가하세요\n- 검색 기능: 저장된 시나리오를 이름이나 설명으로 검색할 수 있습니다\n\n이 기능을 통해 업무 효율성을 높여보세요!");
        notice3.setAuthorUsername(admin.getUsername());
        notice3.setAuthorDisplayName(admin.getDisplayName());
        noticeRepository.save(notice3);

        System.out.println("[SAMPLE DATA] Created 3 sample notices");
    }

    private void createSampleScenarios(PackingScenarioRepository scenarioRepository, UserAccount admin) {
        // 샘플 시나리오 1: 기본 적재 설정
        PackingScenario scenario1 = new PackingScenario();
        scenario1.setName("기본 적재 설정");
        scenario1.setDescription("일반적인 박스 적재를 위한 기본 설정입니다.");
        scenario1.setUser(admin);
        scenario1.setTruckWidth(1200);
        scenario1.setTruckHeight(800);
        scenario1.setAllowRotate(true);
        scenario1.setMargin(10);

        PackingItem item1 = new PackingItem();
        item1.setScenario(scenario1);
        item1.setName("박스A");
        item1.setWidth(400);
        item1.setHeight(300);
        item1.setQuantity(2);

        PackingItem item2 = new PackingItem();
        item2.setScenario(scenario1);
        item2.setName("박스B");
        item2.setWidth(600);
        item2.setHeight(400);
        item2.setQuantity(1);

        scenario1.setItems(List.of(item1, item2));
        scenarioRepository.save(scenario1);

        // 샘플 시나리오 2: 소형 화물차
        PackingScenario scenario2 = new PackingScenario();
        scenario2.setName("소형 화물차");
        scenario2.setDescription("소형 화물차(1톤) 적재를 위한 설정입니다.");
        scenario2.setUser(admin);
        scenario2.setTruckWidth(1800);
        scenario2.setTruckHeight(1200);
        scenario2.setAllowRotate(true);
        scenario2.setMargin(20);

        PackingItem item3 = new PackingItem();
        item3.setScenario(scenario2);
        item3.setName("소형 박스");
        item3.setWidth(300);
        item3.setHeight(200);
        item3.setQuantity(5);

        PackingItem item4 = new PackingItem();
        item4.setScenario(scenario2);
        item4.setName("중형 박스");
        item4.setWidth(500);
        item4.setHeight(400);
        item4.setQuantity(3);

        scenario2.setItems(List.of(item3, item4));
        scenarioRepository.save(scenario2);

        // 샘플 시나리오 3: 대형 화물차
        PackingScenario scenario3 = new PackingScenario();
        scenario3.setName("대형 화물차");
        scenario3.setDescription("대형 화물차(5톤) 적재를 위한 설정입니다.");
        scenario3.setUser(admin);
        scenario3.setTruckWidth(2400);
        scenario3.setTruckHeight(1600);
        scenario3.setAllowRotate(false);
        scenario3.setMargin(30);

        PackingItem item5 = new PackingItem();
        item5.setScenario(scenario3);
        item5.setName("대형 팔레트");
        item5.setWidth(1200);
        item5.setHeight(1000);
        item5.setQuantity(2);

        PackingItem item6 = new PackingItem();
        item6.setScenario(scenario3);
        item6.setName("중형 팔레트");
        item6.setWidth(800);
        item6.setHeight(600);
        item6.setQuantity(4);

        scenario3.setItems(List.of(item5, item6));
        scenarioRepository.save(scenario3);

        System.out.println("[SAMPLE DATA] Created 3 sample scenarios");
    }
}


