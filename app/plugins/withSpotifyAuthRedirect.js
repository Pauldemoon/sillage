const { withAppDelegate, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// react-native-spotify-remote needs the iOS AppDelegate to forward the
// OAuth redirect (sillage://spotify-auth?code=...) to its native auth SDK.
// Expo's generated AppDelegate doesn't do this, so the redirect would be
// treated by expo-router as an "Unmatched Route" and the SDK would never
// receive its code. This plugin wires it into every (EAS) build.

const RETURN_LINE =
  "return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)";

const SPOTIFY_GUARD =
  "if let spotifyAuth = RNSpotifyRemoteAuth.sharedInstance(),\n" +
  "       spotifyAuth.application(app, open: url, options: options) {\n" +
  "      return true\n" +
  "    }\n" +
  "    ";

const BRIDGING_IMPORT = "#import <RNSpotifyRemote/RNSpotifyRemoteAuth.h>";

function withAppDelegateRedirect(config) {
  return withAppDelegate(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes("RNSpotifyRemoteAuth.sharedInstance()")) {
      return cfg; // already patched
    }
    if (!contents.includes(RETURN_LINE)) {
      throw new Error(
        "[withSpotifyAuthRedirect] openURL return line not found in AppDelegate.swift — the template changed, update the plugin.",
      );
    }
    cfg.modResults.contents = contents.replace(
      RETURN_LINE,
      SPOTIFY_GUARD + RETURN_LINE,
    );
    return cfg;
  });
}

function withBridgingImport(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const headers = [];
      (function walk(dir) {
        for (const name of fs.readdirSync(dir)) {
          if (name === "Pods" || name === "build") continue;
          const p = path.join(dir, name);
          if (fs.statSync(p).isDirectory()) walk(p);
          else if (name.endsWith("-Bridging-Header.h")) headers.push(p);
        }
      })(iosRoot);

      if (headers.length === 0) {
        throw new Error(
          "[withSpotifyAuthRedirect] No *-Bridging-Header.h found to expose RNSpotifyRemoteAuth to Swift.",
        );
      }
      for (const file of headers) {
        let h = fs.readFileSync(file, "utf8");
        if (!h.includes(BRIDGING_IMPORT)) {
          fs.writeFileSync(file, h.trimEnd() + "\n" + BRIDGING_IMPORT + "\n");
        }
      }
      return cfg;
    },
  ]);
}

module.exports = function withSpotifyAuthRedirect(config) {
  config = withAppDelegateRedirect(config);
  config = withBridgingImport(config);
  return config;
};
