package com.hamsetech.hamsetech.scenario;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TruckPresetRepository extends JpaRepository<TruckPreset, Long> {

    List<TruckPreset> findAllByOrderBySortOrderAscIdAsc();

    boolean existsByLabel(String label);

    boolean existsByLabelAndIdNot(String label, Long id);
}
