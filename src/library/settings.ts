// Bối cảnh = composition các module SVG theo lớp độ sâu + phần tử procedural.
// Tọa độ thế giới 1080×1920 (9:16).

import { SettingSpec, type SettingInput } from "../schema";

const marks5 = (groundY: number) => ({
  A: { x: 540, y: groundY + 20, scale: 1.55 },
  B: { x: 225, y: groundY + 110, scale: 1.6 },
  C: { x: 855, y: groundY + 110, scale: 1.6 },
  D: { x: 330, y: groundY + 300, scale: 1.8 },
  E: { x: 750, y: groundY + 300, scale: 1.8 },
});

const RAW: SettingInput[] = [
  {
    id: "throne_room",
    name: "Điện ngai vàng",
    seats: ["A"],
    tags: ["throne", "palace", "emperor", "court", "ngai", "cung điện", "hoàng đế", "vua"],
    base_lighting: "day",
    layers: [
      {
        depth: 0.5,
        fill: "#4b3384",
        procedural: [
          { type: "bricks", count: 0, color: "#563c95" },
          { type: "stars", count: 26, color: "#f7d774", area: [0, 0, 1080, 900] },
        ],
        items: [
          { module: "window_arch", x: 540, y: 820, scale: 1.1, flip: false, rot: 0 },
          { module: "curtain", x: -20, y: 0, scale: 1, flip: false, rot: 0 },
          { module: "curtain", x: 1100, y: 0, scale: 1, flip: true, rot: 0 },
        ],
      },
      {
        depth: 0.8,
        ground: { y: 1380, color: "#cfae7a", edge: "#a98a58" },
        procedural: [{ type: "tiles", count: 6, color: "#b8955f" }],
        items: [
          { module: "column", x: 120, y: 1400, scale: 1.05, flip: false, rot: 0 },
          { module: "column", x: 960, y: 1400, scale: 1.05, flip: false, rot: 0 },
          { module: "carpet", x: 540, y: 1920, scale: 1.25, flip: false, rot: 0 },
          { module: "throne_giant", x: 540, y: 1500, scale: 1.25, flip: false, rot: 0 },
        ],
      },
    ],
    marks: {
      A: { x: 540, y: 1196, scale: 1.5 },
      B: { x: 210, y: 1600, scale: 1.6 },
      C: { x: 870, y: 1600, scale: 1.6 },
      D: { x: 320, y: 1780, scale: 1.8 },
      E: { x: 760, y: 1780, scale: 1.8 },
    },
    text_zone: { x: 540, y: 300 },
  },
  {
    id: "palace_gate",
    name: "Cổng cung điện",
    tags: ["door", "gate", "palace", "enter", "cổng", "cửa", "mở"],
    base_lighting: "day",
    layers: [
      { depth: 0.5, fill: "#efe2c4", procedural: [{ type: "bricks", count: 0, color: "#e2d2ae" }], items: [] },
      {
        depth: 0.8,
        ground: { y: 1400, color: "#cfae7a", edge: "#a98a58" },
        procedural: [{ type: "tiles", count: 6, color: "#b8955f" }],
        items: [
          { module: "column", x: 110, y: 1420, scale: 1.05, flip: false, rot: 0 },
          { module: "column", x: 970, y: 1420, scale: 1.05, flip: false, rot: 0 },
          { module: "door_open", x: 540, y: 1410, scale: 1.15, flip: false, rot: 0 },
          { module: "carpet", x: 540, y: 1920, scale: 1.1, flip: false, rot: 0 },
        ],
      },
    ],
    marks: marks5(1440),
    text_zone: { x: 540, y: 300 },
  },
  {
    id: "army_camp",
    name: "Doanh trại",
    tags: ["army", "camp", "soldier", "tent", "war", "quân", "lính", "trại", "đất"],
    base_lighting: "day",
    layers: [
      {
        depth: 0.3,
        sky: ["#8fd0f5", "#e6f6ff"],
        procedural: [{ type: "clouds", count: 4 }],
        items: [{ module: "sun", x: 860, y: 330, scale: 1, flip: false, rot: 0 }],
      },
      {
        depth: 0.55,
        items: [
          { module: "hill", x: 230, y: 1250, scale: 1.1, flip: false, rot: 0 },
          { module: "hill", x: 850, y: 1270, scale: 1.2, flip: false, rot: 0 },
        ],
      },
      {
        depth: 0.8,
        ground: { y: 1240, color: "#e8c88a", edge: "#c9a46c" },
        items: [
          { module: "tent", x: 170, y: 1300, scale: 1, flip: false, rot: 0 },
          { module: "tent", x: 900, y: 1290, scale: 0.9, flip: false, rot: 0 },
          { module: "tent", x: 560, y: 1250, scale: 0.7, flip: false, rot: 0 },
          { module: "standard", x: 360, y: 1330, scale: 1, flip: false, rot: 0 },
          { module: "standard", x: 740, y: 1320, scale: 0.9, flip: false, rot: 0 },
        ],
      },
    ],
    marks: marks5(1440),
    text_zone: { x: 540, y: 520 },
  },
  {
    id: "map_italy",
    name: "Bản đồ Ý",
    focus_y: 960,
    tags: ["map", "italy", "march", "route", "bản đồ", "hành quân", "ravenna", "rome"],
    base_lighting: "day",
    layers: [
      {
        depth: 0.4,
        fill: "#7fb8d8",
        procedural: [{ type: "waves", count: 18, color: "#9ccbe4" }],
        items: [],
      },
      {
        depth: 0.8,
        items: [
          { module: "map_italy", x: 540, y: 960, scale: 1.0, flip: false, rot: 0 },
          { module: "mountain_icon", x: 330, y: 650, scale: 0.9, flip: false, rot: 0 },
          { module: "mountain_icon", x: 430, y: 610, scale: 0.8, flip: false, rot: 0 },
          { module: "mountain_icon", x: 580, y: 610, scale: 0.8, flip: false, rot: 0 },
          { module: "mountain_icon", x: 600, y: 880, scale: 0.8, flip: false, rot: 0 },
          { module: "mountain_icon", x: 680, y: 990, scale: 0.8, flip: false, rot: 0 },
          { module: "city_marker", x: 560, y: 670, scale: 1, flip: false, rot: 0 },
          { module: "label:RAVENNA", x: 640, y: 640, scale: 1, flip: false, rot: 0 },
          { module: "city_marker", x: 485, y: 940, scale: 1, flip: false, rot: 0 },
          { module: "label:ROMA", x: 400, y: 935, scale: 1, flip: false, rot: 0 },
          { module: "city_marker", x: 625, y: 1080, scale: 1, flip: false, rot: 0 },
          { module: "label:NAPOLI", x: 710, y: 1110, scale: 1, flip: false, rot: 0 },
        ],
      },
    ],
    marks: {
      A: { x: 540, y: 1560, scale: 0.85 },
      B: { x: 230, y: 1580, scale: 0.85 },
      C: { x: 850, y: 1580, scale: 0.85 },
      D: { x: 340, y: 1640, scale: 0.95 },
      E: { x: 740, y: 1640, scale: 0.95 },
    },
    text_zone: { x: 540, y: 260 },
  },
  {
    id: "seaside_villa",
    name: "Biệt thự ven biển",
    tags: ["villa", "sea", "beach", "retire", "naples", "biển", "biệt thự", "nghỉ hưu"],
    base_lighting: "day",
    layers: [
      {
        depth: 0.3,
        sky: ["#7cc6f2", "#fff3d6"],
        procedural: [{ type: "clouds", count: 3 }],
        items: [{ module: "sun", x: 200, y: 360, scale: 1.1, flip: false, rot: 0 }],
      },
      {
        depth: 0.5,
        ground: { y: 1050, color: "#3d8fc7", edge: "#2f78ab" },
        procedural: [{ type: "waves", count: 10, color: "#69addb", area: [0, 1050, 1080, 1250] }],
        items: [],
      },
      {
        depth: 0.8,
        ground: { y: 1250, color: "#f2d89b", edge: "#d9bb78" },
        items: [
          { module: "villa", x: 600, y: 1280, scale: 0.95, flip: false, rot: 0 },
          { module: "cypress", x: 150, y: 1300, scale: 1.1, flip: false, rot: 0 },
          { module: "cypress", x: 230, y: 1290, scale: 0.9, flip: false, rot: 0 },
          { module: "palm", x: 980, y: 1330, scale: 1, flip: false, rot: 0 },
          { module: "amphora", x: 320, y: 1350, scale: 0.8, flip: false, rot: 0 },
        ],
      },
    ],
    marks: marks5(1460),
    text_zone: { x: 540, y: 560 },
  },
  {
    id: "city_walls",
    name: "Tường thành Ravenna",
    tags: ["city", "wall", "siege", "ravenna", "fortress", "thành", "vây"],
    base_lighting: "dusk",
    layers: [
      { depth: 0.3, sky: ["#f2a65a", "#ffe3b0"], procedural: [{ type: "clouds", count: 3 }], items: [] },
      {
        depth: 0.7,
        ground: { y: 1300, color: "#c9a46c", edge: "#a98a58" },
        items: [{ module: "city_wall", x: 540, y: 1320, scale: 0.98, flip: false, rot: 0 }],
      },
      { depth: 0.9, items: [{ module: "standard", x: 140, y: 1520, scale: 1, flip: false, rot: 0 }, { module: "bush", x: 960, y: 1500, scale: 1, flip: false, rot: 0 }] },
    ],
    marks: marks5(1470),
    text_zone: { x: 540, y: 380 },
  },
  {
    id: "forum",
    name: "Quảng trường La Mã",
    tags: ["rome", "forum", "city", "history", "founder", "la mã", "thành phố", "lịch sử"],
    base_lighting: "day",
    layers: [
      { depth: 0.3, sky: ["#9fd6f5", "#fff6df"], procedural: [{ type: "clouds", count: 3 }], items: [] },
      {
        depth: 0.6,
        items: [
          { module: "house_block", x: 120, y: 1230, scale: 0.9, flip: false, rot: 0 },
          { module: "house_block", x: 960, y: 1230, scale: 0.9, flip: true, rot: 0 },
          { module: "temple_front", x: 540, y: 1230, scale: 1.05, flip: false, rot: 0 },
        ],
      },
      {
        depth: 0.85,
        ground: { y: 1220, color: "#e2cfa5", edge: "#c9b48a" },
        procedural: [{ type: "tiles", count: 5, color: "#cdb589" }],
        items: [{ module: "amphora", x: 120, y: 1420, scale: 0.9, flip: false, rot: 0 }],
      },
    ],
    marks: marks5(1440),
    text_zone: { x: 540, y: 330 },
  },
  {
    id: "city_street",
    name: "Phố hiện đại",
    tags: ["city", "street", "modern", "town", "phố", "thành phố", "hiện đại", "car"],
    base_lighting: "day",
    layers: [
      { depth: 0.3, sky: ["#8fd0f5", "#e6f6ff"], procedural: [{ type: "clouds", count: 3 }] },
      { depth: 0.55, procedural: [{ type: "skyline", count: 0, y: 1260, color: "#7a86a6", color2: "#66729a" }] },
      { depth: 0.85, ground: { y: 1260, color: "#c9ccd6", edge: "#9aa1ad" }, procedural: [{ type: "road", count: 0 }], items: [{ module: "signpost", x: 120, y: 1340 }, { module: "tree_pine", x: 960, y: 1320, scale: 0.9 }] },
    ],
    marks: marks5(1440),
    text_zone: { x: 540, y: 420 },
  },
  {
    id: "forest",
    name: "Khu rừng",
    tags: ["forest", "woods", "nature", "rừng", "thiên nhiên"],
    base_lighting: "day",
    layers: [
      { depth: 0.3, sky: ["#a7dcf2", "#effaf2"], procedural: [{ type: "clouds", count: 2 }] },
      { depth: 0.5, procedural: [{ type: "forest", count: 14, y: 1240, color: "#5b9a5a", color2: "#6aa866" }] },
      { depth: 0.85, ground: { y: 1260, color: "#9cc96b", edge: "#7aa84f" }, items: [{ module: "rock", x: 860, y: 1360 }, { module: "bush", x: 160, y: 1330 }, { module: "tree_pine", x: 60, y: 1380, scale: 1.2 }] },
    ],
    marks: marks5(1440),
    text_zone: { x: 540, y: 420 },
  },
  {
    id: "mountain_valley",
    name: "Thung lũng núi",
    tags: ["mountain", "valley", "hike", "núi", "thung lũng"],
    base_lighting: "day",
    layers: [
      { depth: 0.25, sky: ["#7fb7ec", "#fde9d0"], items: [{ module: "sun", x: 820, y: 420 }] },
      { depth: 0.45, procedural: [{ type: "mountains", count: 6, y: 1220 }] },
      { depth: 0.85, ground: { y: 1240, color: "#a9cf7a", edge: "#86ad57" }, items: [{ module: "tree_pine", x: 140, y: 1340 }, { module: "tree_pine", x: 960, y: 1330, scale: 0.85 }] },
    ],
    marks: marks5(1440),
    text_zone: { x: 540, y: 380 },
  },
  {
    id: "desert",
    name: "Sa mạc",
    tags: ["desert", "sand", "egypt", "sa mạc", "cát"],
    base_lighting: "day",
    layers: [
      { depth: 0.25, sky: ["#ffc46b", "#ffe9c4"], items: [{ module: "sun", x: 300, y: 400, scale: 1.3 }] },
      { depth: 0.7, procedural: [{ type: "dunes", count: 0, y: 1260 }] },
      { depth: 0.85, items: [{ module: "rock", x: 900, y: 1420 }] },
    ],
    marks: marks5(1440),
    text_zone: { x: 540, y: 420 },
  },
  {
    id: "outer_space",
    name: "Không gian vũ trụ",
    tags: ["space", "universe", "planet", "rocket", "vũ trụ", "hành tinh"],
    base_lighting: "day",
    layers: [
      { depth: 0.2, sky: ["#0f1030", "#2a1f5a"], procedural: [{ type: "stars", count: 90, color: "#ffffff", area: [0, 0, 1080, 1920] }] },
      { depth: 0.45, procedural: [{ type: "planets", count: 3, area: [0, 200, 1080, 900] }] },
      { depth: 0.85, items: [{ module: "rocket", x: 860, y: 1500, scale: 0.9 }] },
    ],
    marks: { A: { x: 540, y: 1520, scale: 1.4 }, B: { x: 240, y: 1560, scale: 1.4 }, C: { x: 840, y: 1560, scale: 1.4 }, D: { x: 360, y: 1700, scale: 1.6 }, E: { x: 720, y: 1700, scale: 1.6 } },
    text_zone: { x: 540, y: 380 },
  },
  {
    id: "classroom",
    name: "Lớp học",
    tags: ["class", "school", "teacher", "lesson", "lớp học", "trường", "giáo viên", "bài học"],
    base_lighting: "day",
    layers: [
      { depth: 0.5, fill: "#f3e7c9", procedural: [{ type: "wallpaper", count: 0, color: "rgba(255,255,255,0.25)", color2: "#d9c49a" }], items: [{ module: "whiteboard", x: 540, y: 1180, scale: 1.1 }, { module: "bookshelf", x: 90, y: 1280, scale: 0.9 }, { module: "globe", x: 980, y: 1300, scale: 0.9 }] },
      { depth: 0.85, ground: { y: 1280, color: "#c99a62", edge: "#a87a45" }, procedural: [{ type: "planks", count: 0 }], items: [{ module: "desk", x: 800, y: 1520, scale: 0.9 }] },
    ],
    marks: marks5(1460),
    text_zone: { x: 540, y: 300 },
  },
  {
    id: "office",
    name: "Văn phòng",
    tags: ["office", "work", "company", "văn phòng", "công ty", "computer"],
    base_lighting: "day",
    layers: [
      { depth: 0.5, fill: "#dfe8ef", procedural: [{ type: "wallpaper", count: 0, color: "rgba(255,255,255,0.35)", color2: "#b9c4cf" }], items: [{ module: "window_arch", x: 260, y: 1150, scale: 0.9 }, { module: "bookshelf", x: 900, y: 1280, scale: 0.9 }, { module: "lamp", x: 640, y: 1280 }] },
      { depth: 0.85, ground: { y: 1280, color: "#8f9aa8", edge: "#6f7a88" }, items: [{ module: "desk", x: 300, y: 1560 }, { module: "laptop", x: 300, y: 1370, scale: 0.8 }, { module: "chair", x: 520, y: 1580, scale: 0.9 }] },
    ],
    marks: marks5(1460),
    text_zone: { x: 540, y: 300 },
  },
  {
    id: "news_studio",
    name: "Trường quay tin tức",
    tags: ["news", "studio", "report", "anchor", "tin tức", "bản tin", "phóng sự"],
    base_lighting: "day",
    layers: [
      { depth: 0.3, sky: ["#14234a", "#2f4a7a"], procedural: [{ type: "rays", count: 14, color: "#3c5a92" }] },
      { depth: 0.6, items: [{ module: "whiteboard", x: 540, y: 1080, scale: 1.2 }] },
      { depth: 0.85, ground: { y: 1420, color: "#1d2f52", edge: "#0f1a33" }, items: [{ module: "news_desk", x: 540, y: 1700, scale: 1.2 }] },
    ],
    marks: { A: { x: 540, y: 1520, scale: 1.35 }, B: { x: 260, y: 1520, scale: 1.3 }, C: { x: 820, y: 1520, scale: 1.3 }, D: { x: 300, y: 1800, scale: 1.6 }, E: { x: 780, y: 1800, scale: 1.6 } },
    text_zone: { x: 540, y: 560 },
  },
  {
    id: "living_room",
    name: "Phòng khách",
    tags: ["home", "house", "family", "living room", "nhà", "gia đình", "phòng khách"],
    base_lighting: "day",
    layers: [
      { depth: 0.5, fill: "#f6d7b8", procedural: [{ type: "wallpaper", count: 0, color: "rgba(255,255,255,0.3)", color2: "#e2b98f" }], items: [{ module: "window_arch", x: 760, y: 1150, scale: 0.9 }, { module: "lamp", x: 140, y: 1290 }] },
      { depth: 0.85, ground: { y: 1290, color: "#b07a4a", edge: "#8a5a33" }, procedural: [{ type: "planks", count: 0 }], items: [{ module: "sofa", x: 420, y: 1420 }] },
    ],
    marks: marks5(1470),
    text_zone: { x: 540, y: 320 },
  },
  {
    id: "title_card",
    name: "Nền tiêu đề",
    tags: ["title", "question", "intro", "outro", "cta", "tiêu đề", "câu hỏi"],
    base_lighting: "day",
    layers: [
      { depth: 0.3, sky: ["#ffcf6b", "#ff8a5c"], procedural: [{ type: "rays", count: 18, color: "#ffe29a" }], items: [] },
      { depth: 0.8, ground: { y: 1500, color: "#f5b25f", edge: "#d98f3e" }, items: [] },
    ],
    marks: marks5(1520),
    text_zone: { x: 540, y: 480 },
  },
  {
    id: "river_estuary",
    name: "Cửa sông / mặt nước rộng",
    tags: ["river", "sea", "water", "estuary", "navy", "fleet", "sông", "cửa sông", "bạch đằng", "thủy chiến", "biển"],
    base_lighting: "day",
    layers: [
      {
        depth: 0.25,
        sky: ["#8cccf2", "#fdf0d5"],
        procedural: [{ type: "clouds", count: 3 }],
        items: [{ module: "sun", x: 840, y: 360, scale: 1.05, flip: false, rot: 0 }],
      },
      {
        depth: 0.45,
        procedural: [{ type: "mountains", count: 5, y: 1120, color: "#5d8277", color2: "#486b62" }],
        items: [],
      },
      {
        depth: 0.7,
        ground: { y: 1120, color: "#2b6cb0", edge: "#215387" },
        procedural: [{ type: "waves", count: 14, color: "#68b5dc", area: [0, 1140, 1080, 1460] }],
        items: [],
      },
      {
        depth: 0.88,
        ground: { y: 1440, color: "#23568f", edge: "#1b4473" },
        procedural: [{ type: "waves", count: 12, color: "#5aa3d0", area: [0, 1460, 1080, 1820] }],
        items: [
          { module: "rock", x: 70, y: 1620, scale: 1.15, flip: false, rot: 0 },
          { module: "rock", x: 1010, y: 1640, scale: 1.05, flip: true, rot: 0 },
        ],
      },
    ],
    marks: {
      A: { x: 540, y: 1460, scale: 1.2 },
      B: { x: 240, y: 1500, scale: 1.22 },
      C: { x: 840, y: 1500, scale: 1.22 },
      D: { x: 330, y: 1580, scale: 1.32 },
      E: { x: 750, y: 1580, scale: 1.32 },
    },
    text_zone: { x: 540, y: 400 },
  },
  {
    id: "river_stakes",
    name: "Lòng sông / trận địa cọc",
    tags: ["river", "stakes", "ambush", "trap", "battle", "bạch đằng", "bãi cọc", "cọc gỗ", "sông", "thủy chiến"],
    base_lighting: "dusk",
    layers: [
      {
        depth: 0.25,
        sky: ["#e88d5a", "#fce1b6"],
        procedural: [{ type: "clouds", count: 3 }],
        items: [],
      },
      {
        depth: 0.45,
        procedural: [{ type: "mountains", count: 6, y: 1120, color: "#4e6766", color2: "#3b5252" }],
        items: [],
      },
      {
        depth: 0.75,
        ground: { y: 1120, color: "#265985", edge: "#1d4567" },
        procedural: [{ type: "waves", count: 16, color: "#5ca6ce", area: [0, 1140, 1080, 1480] }],
        items: [
          { module: "wooden_stakes", x: 250, y: 1420, scale: 0.85, flip: false, rot: 0 },
          { module: "wooden_stakes", x: 830, y: 1430, scale: 0.9, flip: true, rot: 0 },
        ],
      },
      {
        depth: 0.9,
        ground: { y: 1460, color: "#1d466b", edge: "#153552" },
        procedural: [{ type: "waves", count: 14, color: "#4d94bd", area: [0, 1480, 1080, 1820] }],
        items: [
          { module: "rock", x: 70, y: 1640, scale: 1.2, flip: false, rot: 0 },
          { module: "rock", x: 1010, y: 1650, scale: 1.1, flip: true, rot: 0 },
        ],
      },
    ],
    marks: {
      A: { x: 540, y: 1460, scale: 1.2 },
      B: { x: 240, y: 1500, scale: 1.22 },
      C: { x: 840, y: 1500, scale: 1.22 },
      D: { x: 330, y: 1580, scale: 1.32 },
      E: { x: 750, y: 1580, scale: 1.32 },
    },
    text_zone: { x: 540, y: 380 },
  },
];

export const BUILTIN_SETTINGS: SettingSpec[] = RAW.map((s) => SettingSpec.parse(s));
