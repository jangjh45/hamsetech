package com.hamsetech.hamsetech.scenario;

import com.hamsetech.hamsetech.web.ApiExceptions.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 적재함 프리셋 관리 테스트.
 *
 * 프리셋은 시나리오가 참조하지 않고 치수를 복사해 가지므로, 여기서는 이름 중복과
 * 없는 항목 처리만 본다.
 */
@ExtendWith(MockitoExtension.class)
class TruckPresetServiceTest {

    @Mock private TruckPresetRepository repository;

    private TruckPresetService service;

    @BeforeEach
    void setUp() {
        service = new TruckPresetService(repository);
    }

    private TruckPreset preset(long id, String label) {
        TruckPreset p = new TruckPreset(label, 2830, 1630, 0);
        ReflectionTestUtils.setField(p, "id", id);
        return p;
    }

    @Test
    @DisplayName("목록은 정렬 순서대로 내려준다")
    void listUsesSortOrder() {
        List<TruckPreset> presets = List.of(preset(1L, "1톤 카고"), preset(2L, "5톤 카고"));
        when(repository.findAllByOrderBySortOrderAscIdAsc()).thenReturn(presets);

        assertThat(service.list()).isEqualTo(presets);
    }

    @Test
    @DisplayName("이름 앞뒤 공백을 지우고 저장한다")
    void createTrimsLabel() {
        when(repository.existsByLabel("3톤 카고")).thenReturn(false);
        when(repository.save(any(TruckPreset.class))).thenAnswer(inv -> inv.getArgument(0));

        TruckPreset saved = service.create("  3톤 카고 ", 3500, 1800, null);

        assertThat(saved.getLabel()).isEqualTo("3톤 카고");
        assertThat(saved.getSortOrder()).isZero();
    }

    @Test
    @DisplayName("같은 이름의 프리셋이 있으면 생성하지 않는다")
    void createRejectsDuplicateLabel() {
        when(repository.existsByLabel("1톤 카고")).thenReturn(true);

        assertThatThrownBy(() -> service.create("1톤 카고", 2830, 1630, 0))
                .isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("수정할 때 자기 이름은 중복으로 보지 않는다")
    void updateExcludesSelfFromDuplicateCheck() {
        TruckPreset existing = preset(1L, "1톤 카고");
        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.existsByLabelAndIdNot("1톤 카고", 1L)).thenReturn(false);
        when(repository.save(any(TruckPreset.class))).thenAnswer(inv -> inv.getArgument(0));

        TruckPreset updated = service.update(1L, "1톤 카고", 2900, 1650, 2);

        assertThat(updated.getWidth()).isEqualTo(2900);
        assertThat(updated.getHeight()).isEqualTo(1650);
        assertThat(updated.getSortOrder()).isEqualTo(2);
    }

    @Test
    @DisplayName("다른 프리셋과 이름이 겹치면 수정하지 않는다")
    void updateRejectsLabelOwnedByAnother() {
        when(repository.findById(1L)).thenReturn(Optional.of(preset(1L, "1톤 카고")));
        when(repository.existsByLabelAndIdNot("5톤 카고", 1L)).thenReturn(true);

        assertThatThrownBy(() -> service.update(1L, "5톤 카고", 2830, 1630, 0))
                .isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("없는 프리셋을 수정하거나 지우면 404다")
    void missingPresetIsNotFound() {
        when(repository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(9L, "x", 1, 1, 0)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.delete(9L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("프리셋을 지운다")
    void deleteRemovesPreset() {
        TruckPreset existing = preset(3L, "5톤 장축");
        when(repository.findById(3L)).thenReturn(Optional.of(existing));

        service.delete(3L);

        verify(repository).delete(eq(existing));
    }
}
