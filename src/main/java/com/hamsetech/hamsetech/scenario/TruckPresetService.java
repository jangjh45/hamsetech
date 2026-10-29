package com.hamsetech.hamsetech.scenario;

import com.hamsetech.hamsetech.web.ApiExceptions.NotFoundException;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class TruckPresetService {

    private final TruckPresetRepository repository;

    public TruckPresetService(TruckPresetRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<TruckPreset> list() {
        return repository.findAllByOrderBySortOrderAscIdAsc();
    }

    public TruckPreset create(String label, Integer width, Integer height, Integer sortOrder) {
        String name = label.trim();
        if (repository.existsByLabel(name)) {
            throw new IllegalArgumentException("같은 이름의 프리셋이 이미 있습니다");
        }
        return repository.save(new TruckPreset(name, width, height, sortOrder == null ? 0 : sortOrder));
    }

    public TruckPreset update(@NonNull Long id, String label, Integer width, Integer height, Integer sortOrder) {
        TruckPreset preset = find(id);
        String name = label.trim();
        if (repository.existsByLabelAndIdNot(name, id)) {
            throw new IllegalArgumentException("같은 이름의 프리셋이 이미 있습니다");
        }
        preset.setLabel(name);
        preset.setWidth(width);
        preset.setHeight(height);
        preset.setSortOrder(sortOrder == null ? 0 : sortOrder);
        return repository.save(preset);
    }

    public void delete(@NonNull Long id) {
        repository.delete(find(id));
    }

    private TruckPreset find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("프리셋을 찾을 수 없습니다."));
    }
}
