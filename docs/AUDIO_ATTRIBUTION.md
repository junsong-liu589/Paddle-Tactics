# Audio notes

The browser game uses six original, lightweight Web Audio arrangements declared in `apps/web/src/lib/music-player.ts`. The score is synthesized locally with oscillators; no music files or runtime audio APIs are downloaded, and playback has no service or API cost.

| Scene        | Track names             |
| ------------ | ----------------------- |
| Menu         | 开球之前 · 球馆晨光     |
| Player setup | 赛前热身 · 选择你的打法 |
| Match        | 赛点拉锯 · 最后一板     |

Track tempos, notes, chords, and volume are project-owned code. Playback begins after the first user gesture to respect browser audio policies. The Settings page can mute music and change its volume; both preferences persist in local storage.

## Mood research

The soundtrack direction was compared against Pixabay's table-tennis and sports-music search results. For example, Pixabay lists [Energetic Sports Music by Tunetank](https://pixabay.com/music/electronic-energetic-sports-music-348430/) as a 1:28 sports track and marks it free under the Pixabay Content License. Its page also marks the recording Content ID Registered. No third-party audio from that page is included in this game; the six arrangements above are original procedural compositions.

Pixabay's [license summary](https://pixabay.com/service/license-summary/) permits free use and adaptations subject to prohibited standalone distribution and other rights. This project uses the search only as mood research and does not redistribute Pixabay content.
