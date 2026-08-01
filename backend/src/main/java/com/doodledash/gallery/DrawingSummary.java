package com.doodledash.gallery;

import java.time.Instant;

public record DrawingSummary(Long id, String title, String author, Instant createdAt) {
    public static DrawingSummary from(Drawing d) {
        return new DrawingSummary(d.getId(), d.getTitle(), d.getAuthor(), d.getCreatedAt());
    }
}
