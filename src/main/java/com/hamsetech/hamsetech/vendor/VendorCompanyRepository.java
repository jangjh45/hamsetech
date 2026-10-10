package com.hamsetech.hamsetech.vendor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface VendorCompanyRepository extends JpaRepository<VendorCompany, Long> {
    @Query(value = """
            select v.id from VendorCompany v
            where (:categoryId is null or v.category.id = :categoryId)
              and (:query = ''
                   or lower(v.name) like lower(concat('%', :query, '%'))
                   or lower(coalesce(v.mainPhone, '')) like lower(concat('%', :query, '%'))
                   or lower(coalesce(v.mainEmail, '')) like lower(concat('%', :query, '%'))
                   or exists (
                       select c.id from VendorContact c where c.vendor = v and (
                           lower(c.name) like lower(concat('%', :query, '%'))
                           or lower(coalesce(c.phone, '')) like lower(concat('%', :query, '%'))
                           or lower(coalesce(c.mobile, '')) like lower(concat('%', :query, '%'))
                           or lower(coalesce(c.email, '')) like lower(concat('%', :query, '%'))
                       )
                   ))
            """,
            countQuery = """
            select count(v.id) from VendorCompany v
            where (:categoryId is null or v.category.id = :categoryId)
              and (:query = ''
                   or lower(v.name) like lower(concat('%', :query, '%'))
                   or lower(coalesce(v.mainPhone, '')) like lower(concat('%', :query, '%'))
                   or lower(coalesce(v.mainEmail, '')) like lower(concat('%', :query, '%'))
                   or exists (
                       select c.id from VendorContact c where c.vendor = v and (
                           lower(c.name) like lower(concat('%', :query, '%'))
                           or lower(coalesce(c.phone, '')) like lower(concat('%', :query, '%'))
                           or lower(coalesce(c.mobile, '')) like lower(concat('%', :query, '%'))
                           or lower(coalesce(c.email, '')) like lower(concat('%', :query, '%'))
                       )
                   ))
            """)
    Page<Long> searchIds(@Param("query") String query, @Param("categoryId") Long categoryId, Pageable pageable);

    @EntityGraph(attributePaths = "category")
    List<VendorCompany> findByIdIn(Collection<Long> ids);

    @EntityGraph(attributePaths = "category")
    @Query("select v from VendorCompany v where v.id = :id")
    Optional<VendorCompany> findDetailsById(@Param("id") Long id);
}
