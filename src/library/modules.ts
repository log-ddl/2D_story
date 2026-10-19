// Thư viện module SVG gốc (style chibi: viền #2b2233, màu phẳng).
// Quy ước: data-anchor = điểm đặt; mặc định là đáy giữa viewBox.
// Mũ/đồ đội đầu: hệ tọa độ đầu, tâm (0,0), bán kính đầu = 100.
// Đạo cụ cầm tay: gốc (0,0) là chỗ nắm, vật hướng lên trên.

const O = "#2b2233";
const S = `stroke="${O}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;

export interface ModuleDef {
  id: string;
  label: string;
  kind: "headwear" | "hand" | "prop" | "scenery" | "map" | "rig";
  tags: string[];
  svg: string;
}

export const BUILTIN_MODULES: ModuleDef[] = [
  // ───────── Đồ đội đầu ─────────
  {
    id: "crown",
    label: "Vương miện",
    kind: "headwear",
    tags: ["emperor", "king", "royal", "vua", "hoàng đế"],
    svg: `<svg viewBox="-100 -200 200 140" data-anchor="0 0"><g ${S}>
      <path d="M-66 -74 L-74 -150 L-40 -112 L0 -168 L40 -112 L74 -150 L66 -74 Z" fill="#f2c14e"/>
      <path d="M-70 -92 Q0 -104 70 -92 L68 -68 Q0 -80 -68 -68 Z" fill="#e0a526"/>
      <circle cx="0" cy="-128" r="11" fill="#e84a5f"/>
      <circle cx="-74" cy="-152" r="8" fill="#f7d774"/>
      <circle cx="74" cy="-152" r="8" fill="#f7d774"/>
      <circle cx="0" cy="-170" r="8" fill="#f7d774"/>
      <circle cx="-36" cy="-82" r="6" fill="#4aa3df"/>
      <circle cx="36" cy="-82" r="6" fill="#4aa3df"/>
    </g></svg>`,
  },
  {
    id: "helmet_roman",
    label: "Mũ lính La Mã",
    kind: "headwear",
    tags: ["soldier", "legion", "lính", "roman"],
    svg: `<svg viewBox="-130 -230 260 260" data-anchor="0 0"><g ${S}>
      <path d="M-40 -150 Q0 -230 40 -150 L30 -110 Q0 -150 -30 -110 Z" fill="#c8553d"/>
      <path d="M-112 -20 Q-118 -128 0 -132 Q118 -128 112 -20 Q100 -36 82 -38 L82 -60 Q0 -78 -82 -60 L-82 -38 Q-100 -36 -112 -20 Z" fill="#b9c0c9"/>
      <path d="M-92 -58 Q0 -82 92 -58" fill="none"/>
      <path d="M-112 -22 L-104 40 Q-86 54 -78 36 L-82 -38 Z" fill="#9aa3ad"/>
      <path d="M112 -22 L104 40 Q86 54 78 36 L82 -38 Z" fill="#9aa3ad"/>
      <circle cx="-94" cy="0" r="5" fill="#f2c14e"/><circle cx="94" cy="0" r="5" fill="#f2c14e"/>
    </g></svg>`,
  },
  {
    id: "helmet_barbarian",
    label: "Mũ chiến binh man tộc",
    kind: "headwear",
    tags: ["barbarian", "germanic", "odoacer", "man tộc"],
    svg: `<svg viewBox="-130 -220 260 200" data-anchor="0 0"><g ${S}>
      <path d="M-104 -50 Q-100 -150 0 -196 Q100 -150 104 -50 Z" fill="#a7aeb6"/>
      <path d="M0 -196 L0 -50" fill="none"/>
      <path d="M-60 -170 Q-30 -120 -40 -50 M60 -170 Q30 -120 40 -50" fill="none" stroke-width="5"/>
      <path d="M-112 -62 Q0 -86 112 -62 L110 -36 Q0 -60 -110 -36 Z" fill="#c9a227"/>
      <circle cx="-70" cy="-50" r="5" fill="#2b2233"/><circle cx="0" cy="-60" r="5" fill="#2b2233"/><circle cx="70" cy="-50" r="5" fill="#2b2233"/>
    </g></svg>`,
  },
  {
    id: "laurel",
    label: "Vòng nguyệt quế",
    kind: "headwear",
    tags: ["laurel", "senator", "caesar", "nguyệt quế"],
    svg: `<svg viewBox="-130 -150 260 120" data-anchor="0 0"><g ${S} stroke-width="4">
      <path d="M-104 -60 Q0 -118 104 -60" fill="none" stroke="#3f7a3a" stroke-width="8"/>
      <ellipse cx="-92" cy="-78" rx="18" ry="9" fill="#6cbf5a" transform="rotate(-50 -92 -78)"/>
      <ellipse cx="-66" cy="-96" rx="18" ry="9" fill="#6cbf5a" transform="rotate(-35 -66 -96)"/>
      <ellipse cx="-36" cy="-108" rx="18" ry="9" fill="#6cbf5a" transform="rotate(-15 -36 -108)"/>
      <ellipse cx="92" cy="-78" rx="18" ry="9" fill="#6cbf5a" transform="rotate(50 92 -78)"/>
      <ellipse cx="66" cy="-96" rx="18" ry="9" fill="#6cbf5a" transform="rotate(35 66 -96)"/>
      <ellipse cx="36" cy="-108" rx="18" ry="9" fill="#6cbf5a" transform="rotate(15 36 -108)"/>
      <ellipse cx="-102" cy="-50" rx="16" ry="8" fill="#6cbf5a" transform="rotate(-80 -102 -50)"/>
      <ellipse cx="102" cy="-50" rx="16" ry="8" fill="#6cbf5a" transform="rotate(80 102 -50)"/>
    </g></svg>`,
  },
  {
    id: "hood",
    label: "Mũ trùm",
    kind: "headwear",
    tags: ["hood", "monk", "peasant", "trùm"],
    svg: `<svg viewBox="-140 -150 280 260" data-anchor="0 0"><g ${S}>
      <path d="M-122 90 Q-140 -140 0 -136 Q140 -140 122 90 L96 90 Q110 -100 0 -104 Q-110 -100 -96 90 Z" fill="var(--main, #7a6a58)"/>
    </g></svg>`,
  },

  // ───────── Module hiện đại / đa năng ─────────
  { id: "desk", label: "Bàn làm việc", kind: "prop", tags: ["desk", "office", "school", "bàn"], svg: `<svg viewBox="-220 -200 440 200"><g ${S}>
      <rect x="-210" y="-190" width="420" height="34" rx="8" fill="#b07a4a"/>
      <rect x="-190" y="-156" width="30" height="156" fill="#8a5a33"/><rect x="160" y="-156" width="30" height="156" fill="#8a5a33"/>
      <rect x="40" y="-156" width="110" height="90" fill="#a06a3c"/><circle cx="95" cy="-110" r="7" fill="#f2c14e"/></g></svg>` },
  { id: "chair", label: "Ghế", kind: "prop", tags: ["chair", "ghế"], svg: `<svg viewBox="-80 -230 160 230"><g ${S}>
      <rect x="-60" y="-226" width="120" height="110" rx="18" fill="#4aa3df"/><rect x="-66" y="-120" width="132" height="30" rx="10" fill="#3d87bb"/>
      <rect x="-56" y="-92" width="16" height="92" fill="#5b6876"/><rect x="40" y="-92" width="16" height="92" fill="#5b6876"/></g></svg>` },
  { id: "laptop", label: "Laptop", kind: "prop", tags: ["laptop", "computer", "máy tính"], svg: `<svg viewBox="-110 -140 220 140"><g ${S}>
      <path d="M-80 -136 H80 L76 -26 H-76 Z" fill="#5b6876"/><rect x="-66" y="-122" width="132" height="84" rx="4" fill="#7cc6f2"/>
      <path d="M-104 -26 H104 L94 0 H-94 Z" fill="#9aa7b4"/></g></svg>` },
  { id: "lamp", label: "Đèn cây", kind: "prop", tags: ["lamp", "đèn"], svg: `<svg viewBox="-70 -380 140 380"><g ${S}>
      <path d="M-60 -300 L-34 -376 H34 L60 -300 Z" fill="#f2c14e"/><rect x="-6" y="-300" width="12" height="280" fill="#5b6876"/>
      <ellipse cx="0" cy="-12" rx="50" ry="14" fill="#5b6876"/></g></svg>` },
  { id: "bookshelf", label: "Kệ sách", kind: "scenery", tags: ["bookshelf", "library", "kệ sách"], svg: `<svg viewBox="-160 -460 320 460"><g ${S}>
      <rect x="-150" y="-450" width="300" height="450" fill="#a06a3c"/>
      <path d="M-150 -330 H150 M-150 -210 H150 M-150 -90 H150" fill="none" stroke-width="8"/>
      <rect x="-130" y="-430" width="22" height="96" fill="#e84a5f"/><rect x="-104" y="-420" width="26" height="86" fill="#4aa3df"/><rect x="-74" y="-426" width="20" height="92" fill="#6cbf5a"/><rect x="30" y="-418" width="30" height="84" fill="#f2c14e"/>
      <rect x="-120" y="-306" width="28" height="92" fill="#9b7be0"/><rect x="-88" y="-300" width="22" height="86" fill="#f2c14e"/><rect x="60" y="-310" width="26" height="96" fill="#e84a5f"/><rect x="90" y="-296" width="22" height="82" fill="#4aa3df"/>
      <rect x="-40" y="-190" width="30" height="96" fill="#6cbf5a"/><rect x="-6" y="-180" width="24" height="86" fill="#e84a5f"/><rect x="80" y="-186" width="26" height="92" fill="#9b7be0"/></g></svg>` },
  { id: "whiteboard", label: "Bảng trắng / màn hình", kind: "scenery", tags: ["board", "screen", "class", "bảng", "màn hình"], svg: `<svg viewBox="-300 -520 600 520"><g ${S}>
      <rect x="-290" y="-510" width="580" height="340" rx="14" fill="#5b6876"/><rect x="-266" y="-486" width="532" height="292" rx="8" fill="#f7f9fb"/>
      <path d="M-200 -420 H60 M-200 -370 H120 M-200 -320 H20" fill="none" stroke="#9aa7b4" stroke-width="10"/>
      <rect x="-20" y="-170" width="40" height="170" fill="#5b6876"/><rect x="-140" y="-20" width="280" height="20" rx="8" fill="#5b6876"/></g></svg>` },
  { id: "news_desk", label: "Bàn tin tức", kind: "scenery", tags: ["news", "studio", "anchor", "tin tức"], svg: `<svg viewBox="-360 -240 720 240"><g ${S}>
      <path d="M-350 -230 H350 L320 0 H-320 Z" fill="#2f4a7a"/><path d="M-350 -230 H350 V-196 H-350 Z" fill="#ff7a1a"/>
      <rect x="-120" y="-160" width="240" height="70" rx="10" fill="#1d2f52"/><path d="M-80 -125 H80" fill="none" stroke="#ffffff" stroke-width="10"/></g></svg>` },
  { id: "car", label: "Ô tô", kind: "prop", tags: ["car", "vehicle", "xe"], svg: `<svg viewBox="-230 -200 460 200"><g ${S}>
      <path d="M-210 -50 V-100 Q-200 -120 -150 -124 L-100 -186 H90 L150 -124 Q200 -120 212 -100 V-50 Z" fill="#e84a5f"/>
      <path d="M-84 -170 H-10 V-124 H-128 Z M10 -170 H80 L124 -124 H10 Z" fill="#a8dcf5"/>
      <circle cx="-120" cy="-46" r="40" fill="#2b2233"/><circle cx="-120" cy="-46" r="16" fill="#9aa7b4"/>
      <circle cx="120" cy="-46" r="40" fill="#2b2233"/><circle cx="120" cy="-46" r="16" fill="#9aa7b4"/>
      <rect x="196" y="-96" width="20" height="16" fill="#ffe08a"/></g></svg>` },
  { id: "tree_pine", label: "Cây thông", kind: "scenery", tags: ["tree", "pine", "forest", "cây", "thông"], svg: `<svg viewBox="-110 -420 220 420"><g ${S}>
      <rect x="-14" y="-60" width="28" height="60" fill="#6b4226"/>
      <path d="M0 -416 L70 -300 H34 L90 -190 H44 L104 -60 H-104 L-44 -190 H-90 L-34 -300 H-70 Z" fill="#2f7a4a"/></g></svg>` },
  { id: "rock", label: "Tảng đá", kind: "prop", tags: ["rock", "stone", "đá"], svg: `<svg viewBox="-130 -110 260 110"><g ${S}>
      <path d="M-120 0 Q-120 -70 -60 -94 Q0 -116 60 -90 Q124 -66 120 0 Z" fill="#9aa1ad"/><path d="M-40 -70 Q-10 -84 20 -72" fill="none" stroke="#c4cad3" stroke-width="7"/></g></svg>` },
  { id: "rocket", label: "Tên lửa", kind: "prop", tags: ["rocket", "space", "tên lửa", "vũ trụ"], svg: `<svg viewBox="-110 -470 220 470"><g ${S}>
      <path d="M-50 -60 Q-70 -300 0 -460 Q70 -300 50 -60 Z" fill="#f7f9fb"/><circle cx="0" cy="-300" r="34" fill="#4aa3df"/>
      <path d="M-50 -170 L-104 -40 L-50 -60 Z M50 -170 L104 -40 L50 -60 Z" fill="#e84a5f"/>
      <path d="M-30 -60 Q0 30 30 -60 Z" fill="#ff9f1c"/></g></svg>` },
  { id: "signpost", label: "Biển chỉ đường", kind: "prop", tags: ["sign", "biển", "chỉ đường"], svg: `<svg viewBox="-140 -330 280 330"><g ${S}>
      <rect x="-10" y="-300" width="20" height="300" fill="#8a5a33"/>
      <path d="M-10 -290 H110 L134 -262 L110 -234 H-10 Z" fill="#f2c14e"/><path d="M10 -210 H-110 L-134 -182 L-110 -154 H10 Z" fill="#6cbf5a"/></g></svg>` },
  { id: "sofa", label: "Ghế sofa", kind: "prop", tags: ["sofa", "home", "nhà"], svg: `<svg viewBox="-230 -200 460 200"><g ${S}>
      <rect x="-190" y="-196" width="380" height="110" rx="30" fill="#9b7be0"/><rect x="-220" y="-120" width="440" height="90" rx="30" fill="#b59af0"/>
      <rect x="-200" y="-30" width="20" height="30" fill="#5b3b26"/><rect x="180" y="-30" width="20" height="30" fill="#5b3b26"/></g></svg>` },
  { id: "flask", label: "Bình thí nghiệm", kind: "prop", tags: ["science", "lab", "flask", "khoa học"], svg: `<svg viewBox="-80 -200 160 200"><g ${S}>
      <path d="M-22 -196 H22 V-130 L72 -14 Q78 0 60 0 H-60 Q-78 0 -72 -14 L-22 -130 Z" fill="#e6f6ff"/>
      <path d="M-46 -70 H46 L68 -16 Q72 -6 60 -6 H-60 Q-72 -6 -68 -16 Z" fill="#6cbf5a" stroke-width="4"/>
      <circle cx="-14" cy="-40" r="8" fill="#ffffff" stroke="none"/><circle cx="16" cy="-56" r="5" fill="#ffffff" stroke="none"/></g></svg>` },
  { id: "globe", label: "Quả địa cầu", kind: "prop", tags: ["globe", "world", "earth", "địa cầu"], svg: `<svg viewBox="-90 -230 180 230"><g ${S}>
      <circle cx="0" cy="-140" r="80" fill="#4aa3df"/>
      <path d="M-50 -180 Q-20 -200 0 -170 Q-30 -150 -40 -120 Q-70 -130 -50 -180 Z M20 -120 Q50 -140 60 -100 Q30 -80 20 -120 Z" fill="#6cbf5a" stroke-width="4"/>
      <rect x="-8" y="-60" width="16" height="44" fill="#8a5a33"/><rect x="-50" y="-20" width="100" height="20" rx="8" fill="#8a5a33"/></g></svg>` },
  // ───────── Nhân vật SVG có khung xương (mẫu cho bộ não) ─────────
  {
    id: "robot_rig",
    label: "Robot (khung xương)",
    kind: "rig",
    tags: ["robot", "rig", "máy"],
    svg: `<svg viewBox="-150 -440 300 450" data-anchor="0 0"><g ${S}>
      <g id="leg_L" data-pivot="-30 -88"><rect x="-46" y="-92" width="32" height="80" rx="10" fill="#9aa7b4"/><rect x="-58" y="-18" width="50" height="20" rx="8" fill="#5b6876"/></g>
      <g id="leg_R" data-pivot="30 -88"><rect x="14" y="-92" width="32" height="80" rx="10" fill="#9aa7b4"/><rect x="8" y="-18" width="50" height="20" rx="8" fill="#5b6876"/></g>
      <g id="arm_L" data-pivot="-78 -212"><rect x="-96" y="-222" width="30" height="92" rx="14" fill="#b9c4cf"/><circle cx="-82" cy="-124" r="17" fill="#f2c14e"/></g>
      <g id="body" data-pivot="0 -84">
        <rect x="-74" y="-236" width="148" height="156" rx="26" fill="#d6dee6"/>
        <rect x="-44" y="-206" width="88" height="62" rx="12" fill="#4aa3df"/>
        <circle cx="-22" cy="-118" r="9" fill="#e84a5f"/><circle cx="4" cy="-118" r="9" fill="#f2c14e"/><circle cx="30" cy="-118" r="9" fill="#6cbf5a"/>
      </g>
      <g id="arm_R" data-pivot="78 -212"><rect x="66" y="-222" width="30" height="92" rx="14" fill="#b9c4cf"/><circle cx="82" cy="-124" r="17" fill="#f2c14e"/></g>
      <g id="head" data-pivot="0 -232">
        <path d="M0 -390 V-424" fill="none"/><circle cx="0" cy="-430" r="12" fill="#e84a5f"/>
        <rect x="-92" y="-392" width="184" height="152" rx="40" fill="#e6ecf2"/>
        <rect x="-70" y="-366" width="140" height="94" rx="26" fill="#2b3a4a"/>
        <g id="eyes_open"><circle cx="-32" cy="-322" r="15" fill="#7ef0ff" stroke="none"/><circle cx="32" cy="-322" r="15" fill="#7ef0ff" stroke="none"/></g>
        <g id="eyes_closed"><path d="M-46 -320 H-18 M18 -320 H46" fill="none" stroke="#7ef0ff" stroke-width="7"/></g>
        <g id="mouth_closed"><path d="M-20 -290 Q0 -280 20 -290" fill="none" stroke="#7ef0ff" stroke-width="6"/></g>
        <g id="mouth_open"><rect x="-18" y="-296" width="36" height="16" rx="7" fill="#7ef0ff" stroke="none"/></g>
        <circle cx="-96" cy="-316" r="14" fill="#9aa7b4"/><circle cx="96" cy="-316" r="14" fill="#9aa7b4"/>
      </g>
    </g></svg>`,
  },
  // ───────── Đạo cụ cầm tay ─────────
  {
    id: "sword",
    label: "Kiếm",
    kind: "hand",
    tags: ["sword", "weapon", "kiếm", "gladius"],
    svg: `<svg viewBox="-40 -200 80 240" data-anchor="0 0"><g ${S}>
      <path d="M-14 -40 L-14 -170 L0 -196 L14 -170 L14 -40 Z" fill="#dfe5ea"/>
      <path d="M0 -178 L0 -50" fill="none" stroke="#b9c0c9" stroke-width="4"/>
      <rect x="-34" y="-44" width="68" height="14" rx="6" fill="#c9a227"/>
      <rect x="-9" y="-30" width="18" height="44" rx="6" fill="#6b4226"/>
      <circle cx="0" cy="20" r="11" fill="#c9a227"/>
    </g></svg>`,
  },
  {
    id: "spear",
    label: "Giáo",
    kind: "hand",
    tags: ["spear", "pilum", "giáo"],
    svg: `<svg viewBox="-30 -330 60 420" data-anchor="0 0"><g ${S}>
      <rect x="-7" y="-270" width="14" height="350" rx="6" fill="#8a5a33"/>
      <path d="M0 -330 L18 -268 L-18 -268 Z" fill="#dfe5ea"/>
    </g></svg>`,
  },
  {
    id: "scroll",
    label: "Cuộn giấy",
    kind: "hand",
    tags: ["scroll", "letter", "decree", "cuộn", "chiếu"],
    svg: `<svg viewBox="-80 -60 160 100" data-anchor="0 0"><g ${S}>
      <rect x="-60" y="-40" width="120" height="60" fill="#f5e6c4"/>
      <path d="M-44 -22 H44 M-44 -6 H30" fill="none" stroke-width="4" stroke="#b89c6a"/>
      <rect x="-72" y="-48" width="16" height="76" rx="8" fill="#c99a5b"/>
      <rect x="56" y="-48" width="16" height="76" rx="8" fill="#c99a5b"/>
    </g></svg>`,
  },
  {
    id: "shield",
    label: "Khiên tròn",
    kind: "hand",
    tags: ["shield", "khiên"],
    svg: `<svg viewBox="-80 -80 160 160" data-anchor="0 0"><g ${S}>
      <circle cx="0" cy="0" r="70" fill="var(--accent, #c8553d)"/>
      <circle cx="0" cy="0" r="50" fill="none" stroke-width="5"/>
      <circle cx="0" cy="0" r="18" fill="#c9a227"/>
      <path d="M0 -70 V-18 M0 18 V70 M-70 0 H-18 M18 0 H70" fill="none" stroke-width="5"/>
    </g></svg>`,
  },
  {
    id: "coin_bag",
    label: "Túi vàng",
    kind: "hand",
    tags: ["gold", "money", "pension", "coins", "vàng", "tiền"],
    svg: `<svg viewBox="-80 -20 160 160" data-anchor="0 0"><g ${S}>
      <path d="M-20 10 Q-80 50 -60 110 Q0 140 60 110 Q80 50 20 10 Z" fill="#c99a5b"/>
      <path d="M-26 8 Q0 -4 26 8 L20 22 Q0 14 -20 22 Z" fill="#a8783f"/>
      <circle cx="0" cy="74" r="22" fill="#f2c14e"/>
      <path d="M0 62 V86 M-8 68 H8" fill="none" stroke-width="4"/>
    </g></svg>`,
  },
  {
    id: "torch",
    label: "Đuốc",
    kind: "hand",
    tags: ["torch", "fire", "đuốc"],
    svg: `<svg viewBox="-40 -170 80 230" data-anchor="0 0"><g ${S}>
      <path d="M0 -168 Q34 -120 18 -96 Q0 -80 -18 -96 Q-34 -120 0 -168 Z" fill="#ff9f1c"/>
      <path d="M0 -140 Q14 -112 6 -100 Q0 -96 -6 -100 Q-14 -112 0 -140 Z" fill="#ffe066" stroke-width="3"/>
      <rect x="-9" y="-96" width="18" height="140" rx="6" fill="#8a5a33"/>
    </g></svg>`,
  },
  {
    id: "staff",
    label: "Gậy",
    kind: "hand",
    tags: ["staff", "cane", "gậy"],
    svg: `<svg viewBox="-30 -300 60 380" data-anchor="0 0"><g ${S}>
      <rect x="-7" y="-260" width="14" height="330" rx="7" fill="#8a5a33"/>
      <circle cx="0" cy="-270" r="18" fill="#f2c14e"/>
    </g></svg>`,
  },

  // ───────── Cảnh vật ─────────
  {
    id: "column",
    label: "Cột đá",
    kind: "scenery",
    tags: ["column", "palace", "temple", "cột"],
    svg: `<svg viewBox="-75 -900 150 900"><g ${S}>
      <rect x="-70" y="-60" width="140" height="60" fill="#c9c3d6"/>
      <rect x="-60" y="-82" width="120" height="26" fill="#ddd8e6"/>
      <rect x="-48" y="-820" width="96" height="740" fill="#e6e1ee"/>
      <path d="M-24 -810 V-90 M0 -810 V-90 M24 -810 V-90" fill="none" stroke="#b8b0c9" stroke-width="5"/>
      <rect x="-62" y="-846" width="124" height="28" fill="#ddd8e6"/>
      <path d="M-74 -896 H74 L64 -846 H-64 Z" fill="#c9c3d6"/>
      <circle cx="-58" cy="-860" r="14" fill="#ddd8e6"/><circle cx="58" cy="-860" r="14" fill="#ddd8e6"/>
    </g></svg>`,
  },
  {
    id: "throne_giant",
    label: "Ngai vàng khổng lồ",
    kind: "scenery",
    tags: ["throne", "emperor", "ngai", "vua"],
    svg: `<svg viewBox="-280 -760 560 760"><g ${S}>
      <path d="M-210 -620 Q-210 -740 0 -752 Q210 -740 210 -620 L210 -230 H-210 Z" fill="#f2c14e"/>
      <path d="M-160 -600 Q-160 -690 0 -700 Q160 -690 160 -600 L160 -250 H-160 Z" fill="#6c3fb0"/>
      <path d="M-120 -560 Q0 -610 120 -560 M-120 -460 Q0 -510 120 -460 M-120 -360 Q0 -410 120 -360" fill="none" stroke="#8a5fcf" stroke-width="5"/>
      <circle cx="0" cy="-718" r="20" fill="#e84a5f"/>
      <circle cx="-180" cy="-700" r="12" fill="#f7d774"/><circle cx="180" cy="-700" r="12" fill="#f7d774"/>
      <rect x="-270" y="-330" width="90" height="250" rx="22" fill="#e0a526"/>
      <rect x="180" y="-330" width="90" height="250" rx="22" fill="#e0a526"/>
      <circle cx="-225" cy="-336" r="34" fill="#f2c14e"/><circle cx="225" cy="-336" r="34" fill="#f2c14e"/>
      <path d="M-200 -270 H200 V-200 H-200 Z" fill="#8a5fcf"/>
      <path d="M-230 -200 H230 L216 -80 H-216 Z" fill="#f2c14e"/>
      <path d="M-200 -80 L-210 0 H-150 L-140 -80 Z M200 -80 L210 0 H150 L140 -80 Z" fill="#e0a526"/>
      <path d="M-160 -150 H160" fill="none" stroke="#c98f1c" stroke-width="5"/>
    </g></svg>`,
  },
  {
    id: "curtain",
    label: "Rèm",
    kind: "scenery",
    tags: ["curtain", "drape", "rèm"],
    svg: `<svg viewBox="0 -1000 260 1000" data-anchor="0 -1000"><g ${S}>
      <path d="M0 -1000 H250 Q200 -700 120 -560 Q90 -520 110 -470 Q60 -480 40 -520 Q0 -600 0 -700 Z" fill="#8f2d56"/>
      <path d="M60 -990 Q80 -760 60 -560 M140 -990 Q140 -800 100 -600" fill="none" stroke="#6d1f42" stroke-width="5"/>
      <path d="M0 -1000 H260 V-940 H0 Z" fill="#f2c14e"/>
      <circle cx="105" cy="-505" r="16" fill="#f2c14e"/>
    </g></svg>`,
  },
  {
    id: "carpet",
    label: "Thảm đỏ",
    kind: "scenery",
    tags: ["carpet", "thảm"],
    svg: `<svg viewBox="-300 -480 600 480"><g ${S}>
      <path d="M-110 -480 H110 L290 0 H-290 Z" fill="#c8353d"/>
      <path d="M-86 -470 L-250 -8 M86 -470 L250 -8" fill="none" stroke="#f2c14e" stroke-width="7"/>
    </g></svg>`,
  },
  {
    id: "window_arch",
    label: "Cửa sổ vòm",
    kind: "scenery",
    tags: ["window", "cửa sổ"],
    svg: `<svg viewBox="-110 -380 220 380"><g ${S}>
      <path d="M-100 0 V-260 Q-100 -376 0 -376 Q100 -376 100 -260 V0 Z" fill="#3a2a66"/>
      <path d="M-76 -6 V-256 Q-76 -350 0 -350 Q76 -350 76 -256 V-6 Z" fill="#7cc6f2"/>
      <path d="M0 -350 V-6 M-76 -180 H76" fill="none"/>
      <circle cx="-30" cy="-290" r="22" fill="#fff6c9" stroke="none"/>
    </g></svg>`,
  },
  {
    id: "door_open",
    label: "Cổng mở",
    kind: "scenery",
    tags: ["door", "gate", "open", "cổng", "cửa"],
    svg: `<svg viewBox="-320 -820 640 820"><g ${S}>
      <path d="M-300 0 V-560 Q-300 -812 0 -812 Q300 -812 300 -560 V0 Z" fill="#c9b48a"/>
      <path d="M-220 0 V-540 Q-220 -730 0 -730 Q220 -730 220 -540 V0 Z" fill="#fff1c4"/>
      <path d="M-220 0 V-540 Q-220 -610 -190 -650 L-120 -620 V40 Z" fill="#8a5a33"/>
      <path d="M220 0 V-540 Q220 -610 190 -650 L120 -620 V40 Z" fill="#8a5a33"/>
      <circle cx="-140" cy="-300" r="10" fill="#f2c14e"/><circle cx="140" cy="-300" r="10" fill="#f2c14e"/>
      <path d="M-60 -730 L0 -790 L60 -730" fill="none"/>
    </g></svg>`,
  },
  {
    id: "door_closed",
    label: "Cổng đóng",
    kind: "scenery",
    tags: ["door", "gate", "closed", "cổng"],
    svg: `<svg viewBox="-320 -820 640 820"><g ${S}>
      <path d="M-300 0 V-560 Q-300 -812 0 -812 Q300 -812 300 -560 V0 Z" fill="#c9b48a"/>
      <path d="M-220 0 V-540 Q-220 -730 0 -730 Q220 -730 220 -540 V0 Z" fill="#8a5a33"/>
      <path d="M0 -730 V0 M-220 -400 H220 M-220 -160 H220" fill="none"/>
      <circle cx="-30" cy="-300" r="12" fill="#f2c14e"/><circle cx="30" cy="-300" r="12" fill="#f2c14e"/>
    </g></svg>`,
  },
  {
    id: "tent",
    label: "Lều trại",
    kind: "scenery",
    tags: ["tent", "camp", "army", "lều", "trại"],
    svg: `<svg viewBox="-200 -300 400 300"><g ${S}>
      <path d="M-190 0 L0 -280 L190 0 Z" fill="#efe0bf"/>
      <path d="M0 -280 L-60 0 H60 Z" fill="#c9b48a"/>
      <path d="M0 -150 L-30 0 H30 Z" fill="#5a3b26"/>
      <path d="M-120 -100 L120 -100" fill="none" stroke="#c9a46c" stroke-width="5"/>
      <path d="M0 -280 V-320" fill="none"/>
      <path d="M0 -322 L40 -308 L0 -296 Z" fill="#c8353d"/>
    </g></svg>`,
  },
  {
    id: "standard",
    label: "Cờ hiệu La Mã",
    kind: "scenery",
    tags: ["flag", "banner", "standard", "cờ"],
    svg: `<svg viewBox="-80 -520 160 520"><g ${S}>
      <rect x="-6" y="-500" width="12" height="500" fill="#8a5a33"/>
      <path d="M-60 -440 H60 V-300 L0 -270 L-60 -300 Z" fill="#c8353d"/>
      <path d="M-30 -400 H30 M-20 -360 H20" fill="none" stroke="#f2c14e" stroke-width="7"/>
      <path d="M-70 -460 H70" fill="none" stroke-width="8"/>
      <circle cx="0" cy="-500" r="18" fill="#f2c14e"/>
    </g></svg>`,
  },
  {
    id: "campfire",
    label: "Lửa trại",
    kind: "scenery",
    tags: ["fire", "camp", "lửa"],
    svg: `<svg viewBox="-90 -160 180 160"><g ${S}>
      <path d="M-70 -10 L70 -40 M-70 -40 L70 -10" fill="none" stroke="#8a5a33" stroke-width="18"/>
      <path d="M0 -150 Q60 -80 36 -36 Q0 -10 -36 -36 Q-60 -80 0 -150 Z" fill="#ff9f1c"/>
      <path d="M0 -100 Q26 -60 14 -40 Q0 -32 -14 -40 Q-26 -60 0 -100 Z" fill="#ffe066" stroke-width="4"/>
    </g></svg>`,
  },
  {
    id: "hill",
    label: "Đồi",
    kind: "scenery",
    tags: ["hill", "đồi"],
    svg: `<svg viewBox="-500 -260 1000 260"><g ${S}>
      <path d="M-500 0 Q-300 -260 0 -230 Q300 -260 500 0 Z" fill="var(--accent, #9cc96b)"/>
    </g></svg>`,
  },
  {
    id: "cypress",
    label: "Cây bách",
    kind: "scenery",
    tags: ["tree", "cypress", "cây"],
    svg: `<svg viewBox="-60 -420 120 420"><g ${S}>
      <rect x="-10" y="-50" width="20" height="50" fill="#8a5a33"/>
      <path d="M0 -416 Q60 -260 46 -100 Q30 -40 0 -40 Q-30 -40 -46 -100 Q-60 -260 0 -416 Z" fill="#3f7a3a"/>
      <path d="M0 -360 Q24 -240 14 -110" fill="none" stroke="#5a9a4e" stroke-width="5"/>
    </g></svg>`,
  },
  {
    id: "palm",
    label: "Cây cọ",
    kind: "scenery",
    tags: ["tree", "palm", "cọ", "sea"],
    svg: `<svg viewBox="-200 -520 400 520"><g ${S}>
      <path d="M-14 0 Q-30 -250 10 -440 L30 -436 Q2 -250 16 0 Z" fill="#a8783f"/>
      <path d="M20 -440 Q-80 -520 -190 -430 Q-90 -470 20 -440 Z" fill="#4f9a45"/>
      <path d="M20 -440 Q120 -530 200 -420 Q100 -470 20 -440 Z" fill="#4f9a45"/>
      <path d="M20 -440 Q-60 -420 -130 -330 Q-50 -410 20 -440 Z" fill="#5fae52"/>
      <path d="M20 -440 Q100 -420 160 -320 Q80 -410 20 -440 Z" fill="#5fae52"/>
      <path d="M20 -440 Q10 -520 -40 -560 Q30 -520 20 -440 Z" fill="#5fae52"/>
    </g></svg>`,
  },
  {
    id: "bush",
    label: "Bụi cây",
    kind: "scenery",
    tags: ["bush", "bụi"],
    svg: `<svg viewBox="-110 -110 220 110"><g ${S}>
      <path d="M-100 0 Q-110 -60 -60 -70 Q-50 -110 0 -100 Q50 -110 60 -70 Q110 -60 100 0 Z" fill="#5fae52"/>
    </g></svg>`,
  },
  {
    id: "villa",
    label: "Biệt thự La Mã",
    kind: "scenery",
    tags: ["villa", "house", "biệt thự", "naples"],
    svg: `<svg viewBox="-360 -480 720 480"><g ${S}>
      <rect x="-330" y="-300" width="660" height="300" fill="#f5ead2"/>
      <path d="M-360 -300 L0 -470 L360 -300 Z" fill="#d1603d"/>
      <path d="M-300 -330 L0 -450 L300 -330" fill="none" stroke="#a8462b" stroke-width="5"/>
      <rect x="-250" y="-260" width="40" height="260" fill="#ffffff"/>
      <rect x="-130" y="-260" width="40" height="260" fill="#ffffff"/>
      <rect x="90" y="-260" width="40" height="260" fill="#ffffff"/>
      <rect x="210" y="-260" width="40" height="260" fill="#ffffff"/>
      <path d="M-50 0 V-170 Q0 -220 50 -170 V0 Z" fill="#8a5a33"/>
      <rect x="-200" y="-200" width="60" height="70" fill="#7cc6f2"/>
      <rect x="140" y="-200" width="60" height="70" fill="#7cc6f2"/>
    </g></svg>`,
  },
  {
    id: "temple_front",
    label: "Đền thờ",
    kind: "scenery",
    tags: ["temple", "forum", "đền"],
    svg: `<svg viewBox="-380 -640 760 640"><g ${S}>
      <rect x="-360" y="-60" width="720" height="60" fill="#d9d2c3"/>
      <rect x="-330" y="-100" width="660" height="40" fill="#e8e2d4"/>
      <rect x="-300" y="-470" width="50" height="370" fill="#f3efe6"/>
      <rect x="-170" y="-470" width="50" height="370" fill="#f3efe6"/>
      <rect x="-40" y="-470" width="50" height="370" fill="#f3efe6"/>
      <rect x="90" y="-470" width="50" height="370" fill="#f3efe6"/>
      <rect x="220" y="-470" width="50" height="370" fill="#f3efe6"/>
      <rect x="-340" y="-510" width="680" height="40" fill="#e8e2d4"/>
      <path d="M-360 -510 L0 -636 L360 -510 Z" fill="#f3efe6"/>
      <path d="M-280 -530 L0 -610 L280 -530 Z" fill="#e8e2d4"/>
    </g></svg>`,
  },
  {
    id: "house_block",
    label: "Nhà phố cổ",
    kind: "scenery",
    tags: ["house", "city", "nhà"],
    svg: `<svg viewBox="-160 -380 320 380"><g ${S}>
      <rect x="-150" y="-300" width="300" height="300" fill="#e9c79a"/>
      <path d="M-165 -300 H165 L130 -370 H-130 Z" fill="#d1603d"/>
      <rect x="-110" y="-250" width="60" height="70" fill="#5a3b26"/>
      <rect x="50" y="-250" width="60" height="70" fill="#5a3b26"/>
      <rect x="-40" y="-130" width="80" height="130" fill="#8a5a33"/>
    </g></svg>`,
  },
  {
    id: "city_wall",
    label: "Tường thành",
    kind: "scenery",
    tags: ["wall", "city", "ravenna", "fortress", "thành"],
    svg: `<svg viewBox="-560 -560 1120 560"><g ${S}>
      <path d="M-540 0 V-340 H-500 V-380 H-450 V-340 H-400 V-380 H-350 V-340 H-300 V-380 H-250 V-340 H250 V-380 H300 V-340 H350 V-380 H400 V-340 H450 V-380 H500 V-340 H540 V0 Z" fill="#d9c49a"/>
      <path d="M-200 0 V-470 H-180 V-520 H-140 V-490 H-100 V-520 H-60 V-470 H-60 V0 Z" fill="#cdb589"/>
      <path d="M200 0 V-470 H180 V-520 H140 V-490 H100 V-520 H60 V-470 H60 V0 Z" fill="#cdb589"/>
      <path d="M-60 0 V-200 Q0 -280 60 -200 V0 Z" fill="#5a3b26"/>
      <path d="M-480 -260 H-420 M-460 -180 H-380 M380 -240 H460 M420 -160 H500 M-320 -120 H-260 M280 -100 H340" fill="none" stroke="#b89c6a" stroke-width="5"/>
      <rect x="-150" y="-400" width="40" height="60" rx="20" fill="#2b2233"/>
      <rect x="110" y="-400" width="40" height="60" rx="20" fill="#2b2233"/>
    </g></svg>`,
  },
  {
    id: "sun",
    label: "Mặt trời",
    kind: "scenery",
    tags: ["sun", "mặt trời"],
    svg: `<svg viewBox="-110 -110 220 220" data-anchor="0 0"><g ${S}>
      <circle cx="0" cy="0" r="80" fill="#ffd166"/>
      <circle cx="-26" cy="-22" r="20" fill="#ffe8a3" stroke="none"/>
    </g></svg>`,
  },
  {
    id: "cloud",
    label: "Mây",
    kind: "scenery",
    tags: ["cloud", "mây"],
    svg: `<svg viewBox="-150 -100 300 100"><g ${S}>
      <path d="M-140 0 Q-150 -50 -96 -52 Q-80 -96 -20 -88 Q20 -110 64 -76 Q130 -80 136 -30 Q150 0 120 0 Z" fill="#ffffff"/>
    </g></svg>`,
  },
  {
    id: "coin_pile",
    label: "Đống vàng",
    kind: "prop",
    tags: ["gold", "coins", "treasure", "vàng", "tiền"],
    svg: `<svg viewBox="-200 -160 400 160"><g ${S}>
      <path d="M-190 0 Q-120 -150 0 -150 Q120 -150 190 0 Z" fill="#f2c14e"/>
      <ellipse cx="-80" cy="-60" rx="26" ry="12" fill="#f7d774"/>
      <ellipse cx="20" cy="-100" rx="26" ry="12" fill="#f7d774"/>
      <ellipse cx="90" cy="-40" rx="26" ry="12" fill="#f7d774"/>
      <ellipse cx="-20" cy="-30" rx="26" ry="12" fill="#f7d774"/>
    </g></svg>`,
  },
  {
    id: "chest",
    label: "Rương",
    kind: "prop",
    tags: ["chest", "treasure", "rương"],
    svg: `<svg viewBox="-130 -190 260 190"><g ${S}>
      <rect x="-120" y="-110" width="240" height="110" rx="10" fill="#a8783f"/>
      <path d="M-120 -110 Q-120 -186 0 -186 Q120 -186 120 -110 Z" fill="#8a5a33"/>
      <path d="M-120 -110 H120 M-70 -180 V0 M70 -180 V0" fill="none" stroke="#c9a227" stroke-width="10"/>
      <rect x="-18" y="-126" width="36" height="40" rx="6" fill="#f2c14e"/>
    </g></svg>`,
  },
  {
    id: "amphora",
    label: "Bình gốm",
    kind: "prop",
    tags: ["vase", "amphora", "bình"],
    svg: `<svg viewBox="-70 -220 140 220"><g ${S}>
      <path d="M-24 -200 H24 V-170 Q70 -140 60 -60 Q50 0 0 0 Q-50 0 -60 -60 Q-70 -140 -24 -170 Z" fill="#d1603d"/>
      <path d="M-24 -180 Q-60 -180 -50 -130 M24 -180 Q60 -180 50 -130" fill="none"/>
      <path d="M-56 -90 H56" fill="none" stroke="#2b2233" stroke-width="10"/>
    </g></svg>`,
  },
  {
    id: "city_marker",
    label: "Điểm thành phố",
    kind: "map",
    tags: ["marker", "city", "map"],
    svg: `<svg viewBox="-30 -30 60 60" data-anchor="0 0"><g ${S} stroke-width="5">
      <circle cx="0" cy="0" r="18" fill="#e84a5f"/>
      <circle cx="0" cy="0" r="7" fill="#ffffff"/>
    </g></svg>`,
  },
  {
    id: "mountain_icon",
    label: "Núi (bản đồ)",
    kind: "map",
    tags: ["mountain", "map", "núi"],
    svg: `<svg viewBox="-50 -70 100 70"><g ${S} stroke-width="5">
      <path d="M-46 0 L0 -66 L46 0 Z" fill="#b49a6a"/>
      <path d="M-15 -44 L0 -66 L15 -44 L6 -38 L0 -46 L-6 -38 Z" fill="#ffffff" stroke-width="3"/>
    </g></svg>`,
  },
  {
    id: "map_italy",
    label: "Bản đồ Ý",
    kind: "map",
    tags: ["map", "italy", "rome", "ravenna", "bản đồ", "ý"],
    svg: `<svg viewBox="0 0 1000 1250" data-anchor="500 625"><g ${S} stroke-width="7">
      <path d="M110 250 L180 120 L330 90 L480 80 L610 130 L560 180 L520 230 L515 330 L560 400 L605 455 L680 555 L735 600 L805 640 L790 680 L870 720 L960 790 L980 835 L940 830 L870 790 L830 810 L860 870 L820 930 L770 1010 L760 1060 L720 1072 L715 1000 L740 940 L700 900 L640 805 L585 745 L520 680 L445 605 L380 530 L330 455 L300 385 L240 300 L170 320 L120 300 Z" fill="#e9d29a"/>
      <path d="M560 1090 L780 1080 L740 1210 L640 1170 L560 1140 Z" fill="#e9d29a"/>
      <path d="M190 650 L290 640 L300 760 L280 900 L200 910 L180 780 Z" fill="#e9d29a"/>
      <path d="M230 480 L270 470 L275 560 L240 620 L215 560 Z" fill="#e9d29a"/>
      <path d="M200 200 Q380 150 540 170" fill="none" stroke="#b49a6a" stroke-width="5" stroke-dasharray="0"/>
    </g></svg>`,
  },
];

/** Vị trí thành phố trên map_italy (tọa độ module, gốc ở anchor 500,625) */
export const ITALY_CITIES: Record<string, [number, number]> = {
  Roma: [445 - 500, 605 - 625],
  Ravenna: [520 - 500, 335 - 625],
  Napoli: [585 - 500, 745 - 625],
  Milano: [250 - 500, 230 - 625],
  Venezia: [520 - 500, 230 - 625],
};
