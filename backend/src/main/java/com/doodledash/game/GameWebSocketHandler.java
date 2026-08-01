package com.doodledash.game;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private static final String[] WORDS = {
            "apple", "banana", "guitar", "rocket", "castle", "dragon", "bicycle",
            "umbrella", "penguin", "volcano", "sandwich", "octopus", "rainbow",
            "skateboard", "telescope", "lighthouse", "butterfly", "mountain",
            "campfire", "submarine", "cactus", "dinosaur", "pirate", "robot",
            "snowman", "waterfall", "jellyfish", "kangaroo", "helicopter", "wizard"
    };

    private static final int ROUND_SECONDS = 60;
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final ObjectMapper mapper = new ObjectMapper();
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, String> sessionRoom = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        sessions.put(session.getId(), session);
        sendTo(session, "connected", Map.of("id", session.getId()));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        JsonNode node = mapper.readTree(message.getPayload());
        String type = node.path("type").asText();
        JsonNode payload = node.path("payload");

        switch (type) {
            case "create-room" -> onCreateRoom(session, payload);
            case "join-room" -> onJoinRoom(session, payload);
            case "start-game" -> onStartGame(session);
            case "draw-stroke" -> onDrawStroke(session, payload);
            case "clear-canvas" -> onClearCanvas(session);
            case "guess" -> onGuess(session, payload);
            default -> { /* unknown message type, ignore */ }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
        String roomCode = sessionRoom.remove(session.getId());
        if (roomCode == null) return;

        Room room = rooms.get(roomCode);
        if (room == null) return;

        int idx = room.indexOf(session.getId());
        if (idx == -1) return;

        boolean wasDrawer = idx == room.getDrawerIndex();
        room.getPlayers().remove(idx);

        if (room.getPlayers().isEmpty()) {
            room.cancelTimers();
            rooms.remove(roomCode);
            return;
        }

        broadcast(room, "player-list", playerListPayload(room));

        if (wasDrawer) {
            room.setDrawerIndex(room.getDrawerIndex() - 1);
            startRound(room);
        }
    }

    // ---- Handlers ----

    private void onCreateRoom(WebSocketSession session, JsonNode payload) throws IOException {
        String roomCode = makeRoomCode();
        Room room = new Room(roomCode);
        rooms.put(roomCode, room);
        joinRoom(session, room, payload.path("name").asText("Player"));
    }

    private void onJoinRoom(WebSocketSession session, JsonNode payload) throws IOException {
        String roomCode = payload.path("roomCode").asText("").toUpperCase().trim();
        Room room = rooms.get(roomCode);
        if (room == null) {
            sendTo(session, "join-error", Map.of("message", "Room not found. Check the code and try again."));
            return;
        }
        joinRoom(session, room, payload.path("name").asText("Player"));
    }

    private void joinRoom(WebSocketSession session, Room room, String name) throws IOException {
        Player player = new Player(session.getId(), (name == null || name.isBlank()) ? "Player" : name);
        room.getPlayers().add(player);
        sessionRoom.put(session.getId(), room.getCode());

        sendTo(session, "joined-room", Map.of("roomCode", room.getCode(), "players", publicPlayerList(room)));
        broadcast(room, "player-list", playerListPayload(room));

        if (room.getCurrentWord() != null) {
            Player drawer = room.getDrawer();
            sendTo(session, "round-start", Map.of(
                    "drawerId", drawer.getId(),
                    "drawerName", drawer.getName(),
                    "wordLength", room.getCurrentWord().length(),
                    "seconds", ROUND_SECONDS
            ));
        }
    }

    private void onStartGame(WebSocketSession session) {
        String roomCode = sessionRoom.get(session.getId());
        if (roomCode == null) return;
        Room room = rooms.get(roomCode);
        if (room == null || room.getCurrentWord() != null) return;
        startRound(room);
    }

    private void onDrawStroke(WebSocketSession session, JsonNode payload) throws IOException {
        String roomCode = sessionRoom.get(session.getId());
        if (roomCode == null) return;
        Room room = rooms.get(roomCode);
        if (room == null) return;
        broadcastExcept(room, session.getId(), "draw-stroke", mapper.convertValue(payload, Map.class));
    }

    private void onClearCanvas(WebSocketSession session) throws IOException {
        String roomCode = sessionRoom.get(session.getId());
        if (roomCode == null) return;
        Room room = rooms.get(roomCode);
        if (room == null) return;
        broadcastExcept(room, session.getId(), "clear-canvas", Map.of());
    }

    private void onGuess(WebSocketSession session, JsonNode payload) throws IOException {
        String roomCode = sessionRoom.get(session.getId());
        if (roomCode == null) return;
        Room room = rooms.get(roomCode);
        if (room == null || room.getCurrentWord() == null) return;

        Player player = room.findPlayer(session.getId());
        if (player == null) return;

        Player drawer = room.getDrawer();
        if (drawer != null && drawer.getId().equals(session.getId())) return; // drawer can't guess

        String guess = payload.path("text").asText("").trim();
        boolean correct = guess.equalsIgnoreCase(room.getCurrentWord());

        if (correct && room.getCorrectGuessers().add(session.getId())) {
            double secondsElapsed = (System.currentTimeMillis() - room.getRoundStartedAt()) / 1000.0;
            int points = Math.max(10, (int) Math.round(100 - secondsElapsed));
            player.addScore(points);
            drawer.addScore(20);

            broadcast(room, "chat-message", Map.of("system", true, "text", player.getName() + " guessed the word! (+" + points + ")"));
            broadcast(room, "player-list", playerListPayload(room));

            int guessersNeeded = room.getPlayers().size() - 1;
            if (room.getCorrectGuessers().size() >= guessersNeeded && guessersNeeded > 0) {
                endRound(room);
            }
        } else {
            broadcast(room, "chat-message", Map.of("system", false, "name", player.getName(), "text", guess));
        }
    }

    // ---- Round lifecycle ----

    private void startRound(Room room) {
        if (room.getPlayers().isEmpty()) return;

        room.setDrawerIndex((room.getDrawerIndex() + 1) % room.getPlayers().size());
        Player drawer = room.getDrawer();
        String word = WORDS[random.nextInt(WORDS.length)];
        room.setCurrentWord(word);
        room.getCorrectGuessers().clear();
        room.setRoundStartedAt(System.currentTimeMillis());

        broadcast(room, "round-start", Map.of(
                "drawerId", drawer.getId(),
                "drawerName", drawer.getName(),
                "wordLength", word.length(),
                "seconds", ROUND_SECONDS
        ));

        WebSocketSession drawerSession = sessions.get(drawer.getId());
        if (drawerSession != null) {
            try {
                sendTo(drawerSession, "your-word", Map.of("word", word));
            } catch (IOException ignored) {
            }
        }

        room.setRoundTimer(scheduler.schedule(() -> endRound(room), ROUND_SECONDS, TimeUnit.SECONDS));
    }

    private void endRound(Room room) {
        room.setRoundTimer(null);
        broadcast(room, "round-end", Map.of("word", room.getCurrentWord(), "scores", publicPlayerList(room)));
        room.setCurrentWord(null);
        room.setNextRoundTimer(scheduler.schedule(() -> startRound(room), 4, TimeUnit.SECONDS));
    }

    // ---- Helpers ----

    private String makeRoomCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                sb.append(CODE_CHARS.charAt(random.nextInt(CODE_CHARS.length())));
            }
            code = sb.toString();
        } while (rooms.containsKey(code));
        return code;
    }

    private List<Map<String, Object>> publicPlayerList(Room room) {
        return room.getPlayers().stream()
                .map(p -> (Map<String, Object>) (Map<String, ?>) Map.of("id", p.getId(), "name", p.getName(), "score", p.getScore()))
                .collect(Collectors.toList());
    }

    private Map<String, Object> playerListPayload(Room room) {
        return Map.of("players", publicPlayerList(room));
    }

    private void sendTo(WebSocketSession session, String type, Object payload) throws IOException {
        ObjectNode node = mapper.createObjectNode();
        node.put("type", type);
        node.set("payload", mapper.valueToTree(payload));
        synchronized (session) {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(mapper.writeValueAsString(node)));
            }
        }
    }

    private void broadcast(Room room, String type, Object payload) {
        for (Player p : room.getPlayers()) {
            WebSocketSession s = sessions.get(p.getId());
            if (s != null) {
                try {
                    sendTo(s, type, payload);
                } catch (IOException ignored) {
                }
            }
        }
    }

    private void broadcastExcept(Room room, String exceptId, String type, Object payload) {
        for (Player p : room.getPlayers()) {
            if (p.getId().equals(exceptId)) continue;
            WebSocketSession s = sessions.get(p.getId());
            if (s != null) {
                try {
                    sendTo(s, type, payload);
                } catch (IOException ignored) {
                }
            }
        }
    }
}
