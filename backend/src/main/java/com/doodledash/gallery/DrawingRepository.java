package com.doodledash.gallery;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DrawingRepository extends JpaRepository<Drawing, Long> {
    List<Drawing> findAllByOrderByCreatedAtDesc();
}
