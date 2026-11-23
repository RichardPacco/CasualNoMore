// Gerado por scripts/fetch-console-icons.mjs: não editar à mão.
// Ícones dos consoles do RetroAchievements, por ID do console.
const CONSOLE_ICON_ASSETS = {
    1: require("../../../assets/images/consoles/1.png"), // Genesis/Mega Drive
    2: require("../../../assets/images/consoles/2.png"), // Nintendo 64
    3: require("../../../assets/images/consoles/3.png"), // SNES/Super Famicom
    4: require("../../../assets/images/consoles/4.png"), // Game Boy
    5: require("../../../assets/images/consoles/5.png"), // Game Boy Advance
    6: require("../../../assets/images/consoles/6.png"), // Game Boy Color
    7: require("../../../assets/images/consoles/7.png"), // NES/Famicom
    8: require("../../../assets/images/consoles/8.png"), // PC Engine/TurboGrafx-16
    9: require("../../../assets/images/consoles/9.png"), // Sega CD
    10: require("../../../assets/images/consoles/10.png"), // 32X
    11: require("../../../assets/images/consoles/11.png"), // Master System
    12: require("../../../assets/images/consoles/12.png"), // PlayStation
    13: require("../../../assets/images/consoles/13.png"), // Atari Lynx
    14: require("../../../assets/images/consoles/14.png"), // Neo Geo Pocket
    15: require("../../../assets/images/consoles/15.png"), // Game Gear
    16: require("../../../assets/images/consoles/16.png"), // GameCube
    17: require("../../../assets/images/consoles/17.png"), // Atari Jaguar
    18: require("../../../assets/images/consoles/18.png"), // Nintendo DS
    19: require("../../../assets/images/consoles/19.png"), // Wii
    20: require("../../../assets/images/consoles/20.png"), // Wii U
    21: require("../../../assets/images/consoles/21.png"), // PlayStation 2
    22: require("../../../assets/images/consoles/22.png"), // Xbox
    23: require("../../../assets/images/consoles/23.png"), // Magnavox Odyssey 2
    24: require("../../../assets/images/consoles/24.png"), // Pokemon Mini
    25: require("../../../assets/images/consoles/25.png"), // Atari 2600
    26: require("../../../assets/images/consoles/26.png"), // DOS
    27: require("../../../assets/images/consoles/27.png"), // Arcade
    28: require("../../../assets/images/consoles/28.png"), // Virtual Boy
    29: require("../../../assets/images/consoles/29.png"), // MSX
    30: require("../../../assets/images/consoles/30.png"), // Commodore 64
    31: require("../../../assets/images/consoles/31.png"), // ZX81
    32: require("../../../assets/images/consoles/32.png"), // Oric
    33: require("../../../assets/images/consoles/33.png"), // SG-1000
    34: require("../../../assets/images/consoles/34.png"), // VIC-20
    35: require("../../../assets/images/consoles/35.png"), // Amiga
    36: require("../../../assets/images/consoles/36.png"), // Atari ST
    37: require("../../../assets/images/consoles/37.png"), // Amstrad CPC
    38: require("../../../assets/images/consoles/38.png"), // Apple II
    39: require("../../../assets/images/consoles/39.png"), // Saturn
    40: require("../../../assets/images/consoles/40.png"), // Dreamcast
    41: require("../../../assets/images/consoles/41.png"), // PlayStation Portable
    42: require("../../../assets/images/consoles/42.png"), // Philips CD-i
    43: require("../../../assets/images/consoles/43.png"), // 3DO Interactive Multiplayer
    44: require("../../../assets/images/consoles/44.png"), // ColecoVision
    45: require("../../../assets/images/consoles/45.png"), // Intellivision
    46: require("../../../assets/images/consoles/46.png"), // Vectrex
    47: require("../../../assets/images/consoles/47.png"), // PC-8000/8800
    48: require("../../../assets/images/consoles/48.png"), // PC-9800
    49: require("../../../assets/images/consoles/49.png"), // PC-FX
    50: require("../../../assets/images/consoles/50.png"), // Atari 5200
    51: require("../../../assets/images/consoles/51.png"), // Atari 7800
    52: require("../../../assets/images/consoles/52.png"), // Sharp X68000
    53: require("../../../assets/images/consoles/53.png"), // WonderSwan
    54: require("../../../assets/images/consoles/54.png"), // Cassette Vision
    55: require("../../../assets/images/consoles/55.png"), // Super Cassette Vision
    56: require("../../../assets/images/consoles/56.png"), // Neo Geo CD
    57: require("../../../assets/images/consoles/57.png"), // Fairchild Channel F
    58: require("../../../assets/images/consoles/58.png"), // FM Towns
    59: require("../../../assets/images/consoles/59.png"), // ZX Spectrum
    60: require("../../../assets/images/consoles/60.png"), // Game & Watch
    61: require("../../../assets/images/consoles/61.png"), // Nokia N-Gage
    62: require("../../../assets/images/consoles/62.png"), // Nintendo 3DS
    63: require("../../../assets/images/consoles/63.png"), // Watara Supervision
    64: require("../../../assets/images/consoles/64.png"), // Sharp X1
    65: require("../../../assets/images/consoles/65.png"), // TIC-80
    66: require("../../../assets/images/consoles/66.png"), // Thomson TO8
    67: require("../../../assets/images/consoles/67.png"), // PC-6000
    68: require("../../../assets/images/consoles/68.png"), // Sega Pico
    69: require("../../../assets/images/consoles/69.png"), // Mega Duck
    70: require("../../../assets/images/consoles/70.png"), // Zeebo
    71: require("../../../assets/images/consoles/71.png"), // Arduboy
    72: require("../../../assets/images/consoles/72.png"), // WASM-4
    73: require("../../../assets/images/consoles/73.png"), // Arcadia 2001
    74: require("../../../assets/images/consoles/74.png"), // Interton VC 4000
    75: require("../../../assets/images/consoles/75.png"), // Elektor TV Games Computer
    76: require("../../../assets/images/consoles/76.png"), // PC Engine CD/TurboGrafx-CD
    77: require("../../../assets/images/consoles/77.png"), // Atari Jaguar CD
    78: require("../../../assets/images/consoles/78.png"), // Nintendo DSi
    79: require("../../../assets/images/consoles/79.png"), // TI-83
    80: require("../../../assets/images/consoles/80.png"), // Uzebox
    81: require("../../../assets/images/consoles/81.png"), // Famicom Disk System
    82: require("../../../assets/images/consoles/82.png"), // PlayStation 3
    102: require("../../../assets/images/consoles/102.png"), // Standalone
};

export default CONSOLE_ICON_ASSETS;
