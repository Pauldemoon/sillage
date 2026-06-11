import ExpoModulesCore
import MusicKit

// Pont MusicKit minimal pour le spike Apple Music :
// autorisation, recherche catalogue, lecture en file, état/position, crossfade.
// La lecture passe par ApplicationMusicPlayer (in-app, n'altère pas l'app Musique).
public class SillageMusicModule: Module {

  private func statusString(_ status: MusicPlayer.PlaybackStatus) -> String {
    switch status {
    case .playing: return "playing"
    case .paused: return "paused"
    case .stopped: return "stopped"
    case .interrupted: return "interrupted"
    case .seekingForward: return "seekingForward"
    case .seekingBackward: return "seekingBackward"
    @unknown default: return "unknown"
    }
  }

  public func definition() -> ModuleDefinition {
    Name("SillageMusic")

    // Statut d'autorisation MusicKit (demande à l'utilisateur si nécessaire).
    AsyncFunction("requestAuthorization") { () async -> String in
      let status = await MusicAuthorization.request()
      switch status {
      case .authorized: return "authorized"
      case .denied: return "denied"
      case .restricted: return "restricted"
      case .notDetermined: return "notDetermined"
      @unknown default: return "unknown"
      }
    }

    // Recherche catalogue (pays du compte utilisateur).
    AsyncFunction("searchSongs") { (term: String, limit: Int) async throws -> [[String: Any?]] in
      var request = MusicCatalogSearchRequest(term: term, types: [Song.self])
      request.limit = min(max(limit, 1), 25)
      let response = try await request.response()
      return response.songs.map { song in
        [
          "id": song.id.rawValue,
          "title": song.title,
          "artist": song.artistName,
          "durationSec": song.duration ?? 0,
          "artwork": song.artwork?.url(width: 600, height: 600)?.absoluteString,
        ]
      }
    }

    // Charge une file de titres (ids catalogue) et lance la lecture.
    AsyncFunction("playSongIds") { (ids: [String]) async throws in
      let musicIds = ids.map { MusicItemID($0) }
      let request = MusicCatalogResourceRequest<Song>(matching: \.id, memberOf: musicIds)
      let response = try await request.response()
      var byId: [String: Song] = [:]
      for song in response.items { byId[song.id.rawValue] = song }
      let songs = ids.compactMap { byId[$0] }
      guard !songs.isEmpty else {
        throw NSError(
          domain: "SillageMusic", code: 404,
          userInfo: [NSLocalizedDescriptionKey: "Aucun titre résolu pour ces ids"])
      }
      let player = ApplicationMusicPlayer.shared
      player.queue = ApplicationMusicPlayer.Queue(for: songs)
      try await player.play()
    }

    AsyncFunction("pausePlayer") { ApplicationMusicPlayer.shared.pause() }

    AsyncFunction("resumePlayer") { () async throws in
      try await ApplicationMusicPlayer.shared.play()
    }

    AsyncFunction("stopPlayer") { ApplicationMusicPlayer.shared.stop() }

    AsyncFunction("skipToNext") { () async throws in
      try await ApplicationMusicPlayer.shared.skipToNextEntry()
    }

    // État instantané — le JS peut poller (suffisant pour le spike).
    Function("getState") { () -> [String: Any?] in
      let player = ApplicationMusicPlayer.shared
      return [
        "status": self.statusString(player.state.playbackStatus),
        "positionSec": player.playbackTime,
        "currentTitle": player.queue.currentEntry?.title,
      ]
    }

    // Crossfade natif entre morceaux (iOS 18+). Renvoie si la plateforme le permet.
    AsyncFunction("setCrossfade") { (seconds: Double) -> Bool in
      if #available(iOS 18.0, *) {
        ApplicationMusicPlayer.shared.transition = .crossfade(duration: seconds)
        return true
      }
      return false
    }
  }
}
