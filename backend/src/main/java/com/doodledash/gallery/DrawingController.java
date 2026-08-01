package com.doodledash.gallery;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/drawings")
public class DrawingController {

    private final DrawingRepository repository;

    public DrawingController(DrawingRepository repository) {
        this.repository = repository;
    }

    @PostMapping
    public ResponseEntity<?> save(@RequestBody SaveDrawingRequest request) {
        if (request.title() == null || request.title().isBlank()
                || request.image_data() == null || request.image_data().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "title and image_data are required"));
        }

        Drawing drawing = new Drawing();
        drawing.setTitle(request.title());
        drawing.setAuthor((request.author() == null || request.author().isBlank()) ? "Anonymous" : request.author());
        drawing.setImageData(request.image_data());

        Drawing saved = repository.save(drawing);
        return ResponseEntity.ok(Map.of("id", saved.getId()));
    }

    @GetMapping
    public List<DrawingSummary> list() {
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .map(DrawingSummary::from)
                .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        return repository.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Not found")));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        repository.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
