package com.doodledash.game;

import java.util.List;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ConcurrentHashMap;

public class Room {
    private final String code;
    private final List<Player> players = new CopyOnWriteArrayList<>();
    private final Set<String> correctGuessers = ConcurrentHashMap.newKeySet();

    private int drawerIndex = -1;
    private String currentWord;
    private long roundStartedAt;
    private ScheduledFuture<?> roundTimer;
    private ScheduledFuture<?> nextRoundTimer;

    public Room(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public List<Player> getPlayers() {
        return players;
    }

    public int getDrawerIndex() {
        return drawerIndex;
    }

    public void setDrawerIndex(int drawerIndex) {
        this.drawerIndex = drawerIndex;
    }

    public Player getDrawer() {
        if (drawerIndex < 0 || drawerIndex >= players.size()) return null;
        return players.get(drawerIndex);
    }

    public String getCurrentWord() {
        return currentWord;
    }

    public void setCurrentWord(String currentWord) {
        this.currentWord = currentWord;
    }

    public long getRoundStartedAt() {
        return roundStartedAt;
    }

    public void setRoundStartedAt(long roundStartedAt) {
        this.roundStartedAt = roundStartedAt;
    }

    public Set<String> getCorrectGuessers() {
        return correctGuessers;
    }

    public synchronized void setRoundTimer(ScheduledFuture<?> timer) {
        if (this.roundTimer != null) this.roundTimer.cancel(false);
        this.roundTimer = timer;
    }

    public synchronized void setNextRoundTimer(ScheduledFuture<?> timer) {
        if (this.nextRoundTimer != null) this.nextRoundTimer.cancel(false);
        this.nextRoundTimer = timer;
    }

    public synchronized void cancelTimers() {
        if (roundTimer != null) roundTimer.cancel(false);
        if (nextRoundTimer != null) nextRoundTimer.cancel(false);
    }

    public Player findPlayer(String id) {
        for (Player p : players) {
            if (p.getId().equals(id)) return p;
        }
        return null;
    }

    public int indexOf(String id) {
        for (int i = 0; i < players.size(); i++) {
            if (players.get(i).getId().equals(id)) return i;
        }
        return -1;
    }
}
