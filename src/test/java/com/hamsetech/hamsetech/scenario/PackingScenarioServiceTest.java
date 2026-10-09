package com.hamsetech.hamsetech.scenario;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.web.ApiExceptions.ForbiddenException;
import com.hamsetech.hamsetech.web.ApiExceptions.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 적재 시나리오 소유권·무결성 테스트.
 *
 * 예전에 이 로직은 컨트롤러에 일곱 벌로 복사돼 있었다. 지금은 한 클래스로 모였고,
 * 그 과정에서 남은 것이 소유권 확인과 이Integrity 두 가지다.
 *
 * 특히 여섯 가지를 본다.
 * - 남의 시나리오가 403을 받는다. 본문 없는 403이면 client.ts가 토큰 만료로 읽고
 *   사용자를 로그아웃시켰다. 지금은 code=FORBIDDEN이 실린다.
 * - 없는 시나리오는 404다. 존재 여부를 숨기려면 404가 맞지만 여기선 403을 유지한다.
 * - 이름은 사용자 안에서만 겹칠 수 있다.
 * - 수정은 자기 이름을 뺀 채로 중복을 본다. 그러지 않으면 자기 이름이 중복이 된다.
 * - 아이템 목록을 갈아킬 때 컬렉션 인스턴스를 새로 만들지 않는다. orphanRemoval이
 *   붙어 있어 새로 만들면 지워진 행이 남는다.
 * - 목록의 인덱스가 곧 적재 순서다. 드래그로 정렬한 결과가 여기서 저장된다.
 */
@ExtendWith(MockitoExtension.class)
class PackingScenarioServiceTest {

    @Mock private PackingScenarioRepository scenarioRepository;
    @Mock private SecurityUtils securityUtils;

    private PackingScenarioService service;

    @BeforeEach
    void setUp() {
        service = new PackingScenarioService(scenarioRepository, securityUtils);
    }

    private UserAccount user(long id, String username) {
        UserAccount u = new UserAccount();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername(username);
        return u;
    }

    private PackingScenario scenario(UserAccount owner, String name) {
        PackingScenario s = new PackingScenario();
        ReflectionTestUtils.setField(s, "id", 1L);
        s.setUser(owner);
        s.setName(name);
        s.setItems(new ArrayList<>());
        return s;
    }

    private PackingScenarioService.ItemSpec spec(String name, int w, int h, int qty) {
        return new PackingScenarioService.ItemSpec(name, w, h, qty);
    }

    @Test
    @DisplayName("남의 시나리오는 403으로 막는다")
    void refusesOthersScenario() {
        when(scenarioRepository.findById(1L)).thenReturn(Optional.of(scenario(user(2, "lee"), "남의")));
        when(securityUtils.currentUser()).thenReturn(user(1, "kim"));

        // 본문 없는 403이면 client.ts가 토큰 만료로 읽어 사용자를 로그아웃시킨다.
        assertThatThrownBy(() -> service.get(1L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("남의 시나리오를 고치거나 지우면 막는다")
    void refusesMutatingOthersScenario() {
        when(scenarioRepository.findById(1L)).thenReturn(Optional.of(scenario(user(2, "lee"), "남의")));
        when(securityUtils.currentUser()).thenReturn(user(1, "kim"));

        assertThatThrownBy(() -> service.delete(1L)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.toggleFavorite(1L)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.update(1L, "이름", null, 1, 1, true, 0, false, List.of()))
                .isInstanceOf(ForbiddenException.class);

        verify(scenarioRepository, never()).save(any());
        verify(scenarioRepository, never()).delete(any());
    }

    @Test
    @DisplayName("없는 시나리오는 404")
    void refusesMissingScenario() {
        when(scenarioRepository.findById(1L)).thenReturn(Optional.empty());

        // 403으로 주면 남의 것과 없는 것을 구별해 준다.
        assertThatThrownBy(() -> service.get(1L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("본인의 시나리오는 볼 수 있다")
    void readsOwnScenario() {
        PackingScenario mine = scenario(user(1, "kim"), "내 것");
        when(scenarioRepository.findById(1L)).thenReturn(Optional.of(mine));
        when(securityUtils.currentUser()).thenReturn(user(1, "kim"));

        assertThat(service.get(1L)).isSameAs(mine);
    }

    @Test
    @DisplayName("같은 이름이 있으면 만들지 않는다")
    void refusesDuplicateName() {
        when(securityUtils.currentUser()).thenReturn(user(1, "kim"));
        when(scenarioRepository.existsByUserAndName(any(), any())).thenReturn(true);

        // 이름은 사용자 안에서만 겹치면 된다.
        assertThatThrownBy(() -> service.create("중복", null, 1200, 800, true, 0, false, List.of()))
                .isInstanceOf(IllegalArgumentException.class);

        verify(scenarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("수정할 때 자기 이름은 중복이 아니다")
    void updateExcludesSelfFromDuplicateCheck() {
        PackingScenario mine = scenario(user(1, "kim"), "원래 이름");
        when(scenarioRepository.findById(1L)).thenReturn(Optional.of(mine));
        when(securityUtils.currentUser()).thenReturn(user(1, "kim"));
        when(scenarioRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // 이름이 같으면 exists를 아예 묻지 않는다. 묻는다면 자기 이름이 중복이 된다.
        service.update(1L, "원래 이름", null, 1200, 800, true, 0, false, List.of());

        assertThat(mine.getName()).isEqualTo("원래 이름");
        verify(scenarioRepository, never()).existsByUserAndName(any(), any());
    }

    @Test
    @DisplayName("이름을 바꿀 때 남의 것과 겹치면 막는다")
    void updateRefusesTakenName() {
        PackingScenario mine = scenario(user(1, "kim"), "원래 이름");
        when(scenarioRepository.findById(1L)).thenReturn(Optional.of(mine));
        when(securityUtils.currentUser()).thenReturn(user(1, "kim"));
        when(scenarioRepository.existsByUserAndName(any(), any())).thenReturn(true);

        assertThatThrownBy(() -> service.update(1L, "남의 이름", null, 1200, 800, true, 0, false, List.of()))
                .isInstanceOf(IllegalArgumentException.class);

        verify(scenarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("아이템을 지우면 컬렉션 인스턴스를 그대로 유지한다")
    void replaceItemsKeepsCollectionInstance() {
        // orphanRemoval이 붙어 있어 새로 만들면 지워진 행이 DB에 남는다.
        PackingScenario mine = scenario(user(1, "kim"), "내 것");
        List<PackingItem> originalList = mine.getItems();
        originalList.add(new PackingItem());
        when(scenarioRepository.findById(1L)).thenReturn(Optional.of(mine));
        when(securityUtils.currentUser()).thenReturn(user(1, "kim"));
        when(scenarioRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(1L, "내 것", null, 1200, 800, true, 0, false, List.of());

        assertThat(mine.getItems()).isSameAs(originalList);
        assertThat(mine.getItems()).isEmpty();
    }

    @Test
    @DisplayName("아이템 순서가 목록 인덱스로 저장된다")
    void itemsKeepListOrder() {
        PackingScenario mine = scenario(user(1, "kim"), "내 것");
        when(scenarioRepository.findById(1L)).thenReturn(Optional.of(mine));
        when(securityUtils.currentUser()).thenReturn(user(1, "kim"));
        when(scenarioRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // 드래그로 정렬한 결과가 이 순서로 적재된다.
        service.update(1L, "내 것", null, 1200, 800, true, 0, false, List.of(
                spec("박스", 400, 300, 2),
                spec("드럼", 200, 200, 1),
                spec("팔레트", 600, 400, 1)));

        assertThat(mine.getItems()).hasSize(3);
        assertThat(mine.getItems().get(0).getName()).isEqualTo("박스");
        assertThat(mine.getItems().get(0).getSortOrder()).isZero();
        assertThat(mine.getItems().get(2).getName()).isEqualTo("팔레트");
        assertThat(mine.getItems().get(2).getSortOrder()).isEqualTo(2);
    }

    @Test
    @DisplayName("값을 안 보내면 회전·마진은 기본값으로 채운다")
    void appliesDefaults() {
        PackingScenario mine = scenario(user(1, "kim"), "내 것");
        when(scenarioRepository.findById(1L)).thenReturn(Optional.of(mine));
        when(securityUtils.currentUser()).thenReturn(user(1, "kim"));
        when(scenarioRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(1L, "내 것", null, 1200, 800, null, null, false, List.of());

        // 회전은 켜고 마진은 0이 기본이다. null로 두면 계산이 곤란해진다.
        assertThat(mine.getAllowRotate()).isTrue();
        assertThat(mine.getMargin()).isZero();
    }

    @Test
    @DisplayName("즐겨찾기를 눌러마다 반전된다")
    void togglesFavorite() {
        PackingScenario mine = scenario(user(1, "kim"), "내 것");
        mine.setIsFavorite(false);
        when(scenarioRepository.findById(1L)).thenReturn(Optional.of(mine));
        when(securityUtils.currentUser()).thenReturn(user(1, "kim"));
        when(scenarioRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.toggleFavorite(1L);
        assertThat(mine.getIsFavorite()).isTrue();

        service.toggleFavorite(1L);
        assertThat(mine.getIsFavorite()).isFalse();
    }

    @Test
    @DisplayName("목록·즐겨찾기·검색은 모두 내 것만 부른다")
    void queriesAreScopedToMe() {
        UserAccount me = user(1, "kim");
        when(securityUtils.currentUser()).thenReturn(me);
        when(scenarioRepository.findByUserOrderByCreatedAtDesc(me)).thenReturn(List.of());
        when(scenarioRepository.findByUserAndIsFavoriteTrueOrderByUpdatedAtDesc(me)).thenReturn(List.of());
        when(scenarioRepository.findByUserAndNameOrDescriptionContainingIgnoreCase(any(), any()))
                .thenReturn(List.of());

        service.listMine();
        service.listFavorites();
        service.search("출고");

        // 남의 시나리오가 섞이면 적재 계획이 새벽마다 뒤바뀐다.
        verify(scenarioRepository).findByUserOrderByCreatedAtDesc(me);
        verify(scenarioRepository).findByUserAndIsFavoriteTrueOrderByUpdatedAtDesc(me);
    }

    @Test
    @DisplayName("검색어가 null이면 빈 문자열로 친다")
    void searchHandlesNullQuery() {
        UserAccount me = user(1, "kim");
        when(securityUtils.currentUser()).thenReturn(me);

        service.search(null);

        // null을 그대로 넘기면 쿼리가 null LIKE가 되어 아무것도 안 나온다.
        verify(scenarioRepository).findByUserAndNameOrDescriptionContainingIgnoreCase(me, "");
    }
}