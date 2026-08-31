package com.hamsetech.hamsetech.scenario;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.web.ApiExceptions.ForbiddenException;
import com.hamsetech.hamsetech.web.ApiExceptions.NotFoundException;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 적재 시나리오.
 *
 * 예전에는 이 로직이 전부 컨트롤러에 있었다. 일곱 개 메서드가 저마다
 * "인증 확인 → 사용자 조회 → 시나리오 조회 → 소유자 확인"을 복사해 두고 있었고,
 * 소유자가 아닐 때는 본문 없는 403을 돌려줬다 — client.ts는 그걸 토큰 만료로 읽고
 * 사용자를 로그아웃시킨다.
 */
@Service
@Transactional
public class PackingScenarioService {

    private final PackingScenarioRepository scenarioRepository;
    private final SecurityUtils securityUtils;

    public PackingScenarioService(PackingScenarioRepository scenarioRepository,
                                  SecurityUtils securityUtils) {
        this.scenarioRepository = scenarioRepository;
        this.securityUtils = securityUtils;
    }

    @Transactional(readOnly = true)
    public List<PackingScenario> listMine() {
        return scenarioRepository.findByUserOrderByCreatedAtDesc(securityUtils.currentUser());
    }

    @Transactional(readOnly = true)
    public List<PackingScenario> listFavorites() {
        return scenarioRepository.findByUserAndIsFavoriteTrueOrderByUpdatedAtDesc(securityUtils.currentUser());
    }

    @Transactional(readOnly = true)
    public List<PackingScenario> search(String query) {
        return scenarioRepository.findByUserAndNameOrDescriptionContainingIgnoreCase(
                securityUtils.currentUser(), query == null ? "" : query);
    }

    @Transactional(readOnly = true)
    public PackingScenario get(@NonNull Long id) {
        return requireOwned(id);
    }

    public PackingScenario create(String name, String description, Integer truckWidth, Integer truckHeight,
                                  Boolean allowRotate, Integer margin, Boolean preserveOrder,
                                  List<ItemSpec> items) {
        UserAccount user = securityUtils.currentUser();
        if (scenarioRepository.existsByUserAndName(user, name)) {
            throw new IllegalArgumentException("같은 이름의 시나리오가 이미 있습니다");
        }

        PackingScenario scenario = new PackingScenario();
        scenario.setUser(user);
        apply(scenario, name, description, truckWidth, truckHeight, allowRotate, margin, preserveOrder);

        // 새 시나리오는 items 컬렉션이 아직 없다
        scenario.setItems(new java.util.ArrayList<>());
        replaceItems(scenario, items);

        return scenarioRepository.save(scenario);
    }

    public PackingScenario update(@NonNull Long id, String name, String description,
                                  Integer truckWidth, Integer truckHeight, Boolean allowRotate,
                                  Integer margin, Boolean preserveOrder, List<ItemSpec> items) {
        PackingScenario scenario = requireOwned(id);

        // 이름 중복 확인에서 자기 자신은 뺀다
        if (!scenario.getName().equals(name)
                && scenarioRepository.existsByUserAndName(scenario.getUser(), name)) {
            throw new IllegalArgumentException("같은 이름의 시나리오가 이미 있습니다");
        }

        apply(scenario, name, description, truckWidth, truckHeight, allowRotate, margin, preserveOrder);
        replaceItems(scenario, items);

        return scenarioRepository.save(scenario);
    }

    public PackingScenario toggleFavorite(@NonNull Long id) {
        PackingScenario scenario = requireOwned(id);
        scenario.setIsFavorite(!scenario.getIsFavorite());
        return scenarioRepository.save(scenario);
    }

    public void delete(@NonNull Long id) {
        scenarioRepository.delete(requireOwned(id));
    }

    /** 컨트롤러의 요청 DTO를 그대로 받지 않도록, 서비스가 아는 형태로 한 겹 둔다. */
    public record ItemSpec(String name, Integer width, Integer height, Integer quantity) {}

    private void apply(PackingScenario scenario, String name, String description,
                       Integer truckWidth, Integer truckHeight, Boolean allowRotate,
                       Integer margin, Boolean preserveOrder) {
        scenario.setName(name);
        scenario.setDescription(description);
        scenario.setTruckWidth(truckWidth);
        scenario.setTruckHeight(truckHeight);
        scenario.setAllowRotate(allowRotate != null ? allowRotate : true);
        scenario.setMargin(margin != null ? margin : 0);
        scenario.setPreserveOrder(preserveOrder);
    }

    /**
     * 아이템을 통째로 갈아끼운다. 목록의 인덱스가 곧 적재 순서다.
     *
     * orphanRemoval이 붙어 있으므로 컬렉션 인스턴스를 새로 만들지 않고 제자리에서
     * 비웠다 채워야 지워진 행이 실제로 삭제된다.
     */
    private void replaceItems(PackingScenario scenario, List<ItemSpec> specs) {
        List<PackingItem> items = scenario.getItems();
        items.clear();
        for (int index = 0; index < specs.size(); index++) {
            ItemSpec spec = specs.get(index);
            PackingItem item = new PackingItem();
            item.setScenario(scenario);
            item.setName(spec.name());
            item.setWidth(spec.width());
            item.setHeight(spec.height());
            item.setQuantity(spec.quantity());
            item.setSortOrder(index);
            items.add(item);
        }
    }

    /**
     * 내 시나리오만 꺼낸다.
     *
     * 남의 시나리오에는 403을 준다. 존재 여부를 감추려면 404가 맞지만, 예전부터
     * 403이었고 시나리오 id를 훑어 남의 것을 세는 것이 이 시스템에서 의미 있는
     * 정보는 아니라 동작을 바꾸지 않는다. 달라진 것은 본문에 code=FORBIDDEN이
     * 실린다는 점뿐이다.
     */
    private PackingScenario requireOwned(@NonNull Long id) {
        PackingScenario scenario = scenarioRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("시나리오를 찾을 수 없습니다."));
        if (!scenario.getUser().getId().equals(securityUtils.currentUser().getId())) {
            throw new ForbiddenException("본인의 시나리오만 볼 수 있습니다.");
        }
        return scenario;
    }
}
