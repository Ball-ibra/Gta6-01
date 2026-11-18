# Ball-ibra/Gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ball-ibra/Gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ball-ibra/Gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Grand Heist: Sunset City** — a top-down open-world crime game in the spirit of GTA, built for make.fun's "Make GTA 6" bounty, $1,666 in USDC. Drive around a living city, take on jobs, earn cash, and outrun the Sunset City PD as your wanted level climbs.

## The game

Sunset City is a 2400×1800 grid of avenues and streets: buildings, parks, sidewalks, pedestrians, traffic, and a bay along the south edge. You start on foot — grab any parked car (or steal one from traffic, if you don't mind the heat) and get to work.

- **On foot and in cars** — walk the sidewalks, press E to get in and out of cars, drive with acceleration, braking, steering and a handbrake. Cars collide with buildings, traffic and the police.
- **Wanted system** — stealing a car, hitting a pedestrian or smashing into traffic raises your wanted level (1–5 stars). Police cars chase and ram you; lay low and the stars fall one by one. Get pinned by the cops and you're BUSTED; let your health hit zero and you're WASTED.
- **Missions** — three repeatable job types with markers on the map: taxi pickups and drop-offs against the clock, package deliveries, and getaways where you lose the cops and then reach the hideout. Every finished job pays cash.
- **HUD and minimap** — cash, wanted stars, health, speed, the current mission and its timer, plus a live minimap showing you, the police and the mission marker.
- **Sound** — a generated WebAudio engine hum, a two-tone police siren, and bleeps for pickups, crashes and paydays. No audio files. M mutes.
- **Screens** — title screen with the controls, pause (P or Esc), game over (BUSTED / WASTED) and restart (R). Everything runs from plain static files in `game/`: no libraries, no network requests, it loads offline in a desktop browser.

## Controls

| Key | Action |
| --- | --- |
| W / A / S / D or arrows | Move on foot, drive the car |
| E | Enter / exit a car |
| Space | Handbrake |
| P or Esc | Pause |
| R | Restart |
| M | Mute |
| Enter | Start the game |

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080.

The screenshots in `screenshots/` are reproducible: `?shot=start&seed=1` shows the title screen, `?shot=play&seed=1` mid-action gameplay, and `?shot=end&seed=1` the game-over screen.

---

<sub>Entered on [make.fun](https://make.fun/?ref=wn6mtt7s&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
