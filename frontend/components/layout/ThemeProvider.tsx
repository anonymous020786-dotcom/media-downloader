'use client'
import { createContext, useContext, useEffect, useState } from 'react'

export type ThemeCategory = 'dark' | 'light' | 'contrast' | 'coding'

export interface ThemeSpec {
  id: string; label: string
  category: ThemeCategory; colorScheme: 'dark' | 'light'
  bg: string; bgSurface: string; bgCard: string; bgCard2: string; bgHover: string
  border: string; borderHover: string
  text: string; text2: string; text3: string; textGhost: string
  brand: string; brandDark: string; brandLight: string; accent: string
}

// ── Compact factory ────────────────────────────────────────────────────────────
function th(
  id: string, label: string, cat: ThemeCategory, cs: 'dark' | 'light',
  bg: string, bgSurface: string, bgCard: string, bgCard2: string, bgHover: string,
  border: string, borderHover: string,
  text: string, text2: string, text3: string, textGhost: string,
  brand: string, brandDark: string, brandLight: string, accent: string,
): ThemeSpec {
  return { id, label, category: cat, colorScheme: cs, bg, bgSurface, bgCard, bgCard2, bgHover, border, borderHover, text, text2, text3, textGhost, brand, brandDark, brandLight, accent }
}

export const THEMES: ThemeSpec[] = [
  // ── Dark ────────────────────────────────────────────────────────────────────
  th('midnight','Midnight','dark','dark','#080c17','#0d1120','#111827','#141d2e','#1a2540','#1c2a3d','#2a3f5e','#f1f5f9','#94a3b8','#475569','#1c2a3d','#6366f1','#4f46e5','#818cf8','#8b5cf6'),
  th('obsidian','Obsidian','dark','dark','#0a0a12','#0f0f1a','#141422','#18182a','#202035','#252535','#353550','#e8e8ff','#9090b8','#505070','#202035','#7c3aed','#6d28d9','#a78bfa','#c026d3'),
  th('amoled','AMOLED','dark','dark','#000000','#050508','#0a0a0f','#0d0d14','#141420','#1a1a28','#252540','#ffffff','#a0a0c0','#505065','#101018','#00d4ff','#0099cc','#66e6ff','#00ff9d'),
  th('charcoal','Charcoal','dark','dark','#1a1a1a','#1f1f1f','#252525','#2a2a2a','#303030','#3a3a3a','#505050','#f0f0f0','#a0a0a0','#606060','#303030','#6366f1','#4f46e5','#818cf8','#8b5cf6'),
  th('slate-night','Slate Night','dark','dark','#0f172a','#141e2e','#1e293b','#243040','#2d3d54','#334155','#475569','#f1f5f9','#94a3b8','#64748b','#1e293b','#38bdf8','#0ea5e9','#7dd3fc','#818cf8'),
  th('navy-deep','Navy Deep','dark','dark','#020b1e','#04112a','#071535','#0a1a40','#0f2050','#142560','#1e3580','#e8f0ff','#8090b8','#405070','#071535','#00d4ff','#00a8e0','#66e0ff','#7c3aed'),
  th('ocean-dark','Ocean Dark','dark','dark','#031520','#041c2c','#062238','#082840','#0e3050','#123860','#1a4a78','#e0f4ff','#80b8d0','#406070','#062238','#06b6d4','#0891b2','#67e8f9','#10b981'),
  th('forest-dark','Forest Dark','dark','dark','#071209','#0a1a0d','#0e2011','#112514','#162d18','#1e3d20','#2a5530','#e0f5e0','#80b885','#406545','#0e2011','#22c55e','#16a34a','#86efac','#06b6d4'),
  th('jungle','Jungle','dark','dark','#040e07','#061410','#081c12','#0b2016','#102a1c','#163a20','#1f5030','#d4f7e0','#70a880','#3a6045','#081c12','#10b981','#059669','#6ee7b7','#22d3ee'),
  th('volcanic','Volcanic','dark','dark','#160404','#1d0606','#240808','#290a0a','#320d0d','#420e0e','#5a1212','#fff0f0','#d08080','#804545','#240808','#ef4444','#dc2626','#fca5a5','#f97316'),
  th('ember','Ember','dark','dark','#110600','#180b00','#200e00','#271200','#301600','#402000','#5a3000','#fff5e0','#d09060','#805535','#200e00','#f97316','#ea580c','#fdba74','#eab308'),
  th('coffee','Coffee','dark','dark','#130906','#1a0e08','#22130c','#281610','#321c14','#3d2418','#52301f','#f5e8d8','#c0987a','#785544','#22130c','#d97706','#b45309','#fcd34d','#ef4444'),
  th('espresso','Espresso','dark','dark','#0d0804','#130c06','#1a1008','#20140a','#28180c','#352015','#4a2c1a','#f0e5d0','#b09070','#70503a','#1a1008','#f59e0b','#d97706','#fde68a','#f43f5e'),
  th('galaxy','Galaxy','dark','dark','#050310','#080518','#0c0820','#0f0b28','#140e35','#1a1245','#251a60','#f0e8ff','#a088c0','#604878','#0c0820','#8b5cf6','#7c3aed','#c4b5fd','#ec4899'),
  th('cosmic','Cosmic','dark','dark','#08041a','#0c0620','#120a2c','#160d35','#1c1045','#25145a','#351a7a','#f0ecff','#a090d0','#6050a0','#120a2c','#a855f7','#9333ea','#d8b4fe','#38bdf8'),
  th('cyberpunk','Cyberpunk','dark','dark','#000510','#000d1c','#001428','#001a32','#00233e','#003060','#004880','#e0f8ff','#60c8d8','#306878','#001428','#00f5d4','#00c9ad','#80ffee','#f700ff'),
  th('synthwave','Synthwave','dark','dark','#1a0533','#1f073c','#280a4a','#2e0d56','#380f68','#4a1080','#62149a','#f0e0ff','#d080f0','#8040a0','#280a4a','#ff2d78','#e0005f','#ff80b0','#7b2fff'),
  th('neon-green','Neon Green','dark','dark','#000500','#000d00','#001500','#001b00','#002400','#003500','#005000','#e0ffe0','#60cc60','#307030','#001500','#00ff41','#00cc30','#80ff90','#00ffff'),
  th('blood-moon','Blood Moon','dark','dark','#0f0408','#180608','#20080c','#280a10','#340c14','#4a1020','#6a1828','#ffe8f0','#d060a0','#803060','#20080c','#dc2626','#b91c1c','#f87171','#db2777'),
  th('aurora','Aurora','dark','dark','#030f0f','#051515','#071c1c','#0a2020','#0e2c2c','#134040','#1c5858','#d4fff8','#70c8b8','#387868','#071c1c','#14b8a6','#0d9488','#5eead4','#22d3ee'),
  th('storm','Storm','dark','dark','#0e1420','#131c2c','#182438','#1c2a40','#223050','#2e3e52','#3c5070','#e8f0f8','#88a0b8','#4a6070','#182438','#60a5fa','#3b82f6','#93c5fd','#c084fc'),
  th('wine','Wine','dark','dark','#110414','#160618','#1e0822','#240a28','#2e0e32','#3e1248','#541862','#f8e0ff','#c070d0','#783888','#1e0822','#c026d3','#a21caf','#e879f9','#f43f5e'),
  th('arctic','Arctic','dark','dark','#04101a','#061524','#081c2e','#0c2238','#102a48','#143a5c','#1c5080','#e8f8ff','#80b8d8','#406888','#081c2e','#0ea5e9','#0284c7','#7dd3fc','#a5f3fc'),
  th('nord','Nord','dark','dark','#2e3440','#3b4252','#434c5e','#4c566a','#566075','#4c566a','#5e6a80','#eceff4','#d8dee9','#b0bec5','#434c5e','#88c0d0','#81a1c1','#a3d4e0','#b48ead'),
  th('dracula','Dracula','dark','dark','#282a36','#2e3045','#343746','#3a3d52','#44476a','#44475a','#6272a4','#f8f8f2','#cdd6f4','#6272a4','#343746','#ff79c6','#ff55b0','#ffaad8','#bd93f9'),
  th('monokai','Monokai','dark','dark','#272822','#2d2e28','#36372e','#3d3e34','#4a4b3f','#4a4a3e','#60604f','#f8f8f2','#cfcfc2','#75715e','#36372e','#a6e22e','#84b324','#c6f256','#66d9e8'),
  th('solarized-dark','Solarized Dark','dark','dark','#002b36','#073642','#0e3f4e','#124856','#1a5264','#284e58','#35656e','#fdf6e3','#93a1a1','#657b83','#0e3f4e','#268bd2','#1e77b4','#7ab8e8','#2aa198'),
  th('tokyo-night','Tokyo Night','dark','dark','#1a1b26','#1f2130','#24263a','#292b40','#313450','#3a3d58','#4e5172','#a9b1d6','#9aa5ce','#565f89','#24263a','#7aa2f7','#5e88e0','#a9c5fd','#bb9af7'),
  th('github-dark','GitHub Dark','dark','dark','#0d1117','#161b22','#21262d','#282e35','#30363d','#30363d','#484f58','#e6edf3','#8b949e','#484f58','#21262d','#58a6ff','#388bfd','#a5c8ff','#3fb950'),
  th('one-dark','One Dark','dark','dark','#282c34','#2c303c','#3e4451','#454d5e','#4b5266','#3e4451','#545c6e','#abb2bf','#9da5b4','#5c6370','#3e4451','#61afef','#4d8fd0','#89cbf5','#c678dd'),
  th('gruvbox','Gruvbox Dark','dark','dark','#282828','#1d2021','#32302f','#3c3836','#504945','#504945','#665c54','#ebdbb2','#d5c4a1','#928374','#32302f','#fb4934','#cc241d','#fb8077','#fabd2f'),
  th('catppuccin-mocha','Catppuccin Mocha','dark','dark','#1e1e2e','#181825','#313244','#45475a','#585b70','#45475a','#6c7086','#cdd6f4','#bac2de','#6c7086','#313244','#cba6f7','#b175e0','#ddb8ff','#89dceb'),
  th('material-ocean','Material Ocean','dark','dark','#0f111a','#151720','#1b1e28','#202330','#262a38','#2e3348','#3c4260','#8f93a2','#717cb4','#464b5d','#1b1e28','#82aaff','#5e89f5','#adc8ff','#c3e88d'),
  th('palenight','Palenight','dark','dark','#292d3e','#2e3248','#343a54','#3a4060','#434a6e','#444a60','#565e7e','#a6accd','#959dcb','#676e95','#343a54','#c792ea','#b070d0','#e0b8ff','#89ddff'),
  th('horizon','Horizon','dark','dark','#1c1e26','#232530','#2a2c39','#303342','#3a3e50','#3e4254','#525770','#d5d8da','#b7bcc8','#6c6f7b','#2a2c39','#e95678','#d04060','#f297ae','#fab795'),

  // ── Light ────────────────────────────────────────────────────────────────────
  th('cloud','Cloud','light','light','#ffffff','#f8fafc','#f1f5f9','#e8eef6','#e2e8f0','#e2e8f0','#cbd5e1','#0f172a','#475569','#94a3b8','#e2e8f0','#6366f1','#4f46e5','#818cf8','#8b5cf6'),
  th('paper','Paper','light','light','#fafaf7','#f5f5f0','#efefea','#e9e9e3','#e0e0d8','#d8d8d0','#c0c0b0','#1a1a10','#505040','#909080','#e0e0d8','#6366f1','#4f46e5','#818cf8','#10b981'),
  th('cream','Cream','light','light','#fffdf0','#faf8e8','#f5f2dc','#eeecd2','#e8e5c5','#dedad8','#c5c0b0','#2a2015','#605840','#a09070','#e8e5c5','#d97706','#b45309','#fcd34d','#10b981'),
  th('ivory','Ivory','light','light','#f8f8f0','#f4f4ea','#eeeee4','#e6e6da','#d8d8cc','#d0d0c0','#b8b8a8','#1e1e10','#525240','#888870','#d8d8cc','#0891b2','#0e7490','#67e8f9','#7c3aed'),
  th('snow','Snow','light','light','#f0f4f8','#e8eef4','#e0e8f0','#d8e0ea','#ced6e0','#c0cad5','#a8b4c0','#0c1825','#3a4a5a','#7a8a9a','#ced6e0','#0ea5e9','#0284c7','#7dd3fc','#8b5cf6'),
  th('sky','Sky Blue','light','light','#e8f4fd','#deeef8','#d0e8f4','#c5e0ef','#b8d8ea','#a0c5e0','#80aac5','#0a2030','#305070','#6090a8','#b8d8ea','#0284c7','#0369a1','#38bdf8','#6366f1'),
  th('mint','Mint','light','light','#f0fdf4','#e8f8ec','#dcf2e4','#d0ebd8','#c4e4cc','#a8d8b8','#88c09a','#0a200f','#254535','#508058','#c4e4cc','#16a34a','#15803d','#86efac','#0891b2'),
  th('lavender','Lavender','light','light','#f5f3ff','#eeeaff','#e5e0fa','#dbd5f5','#d0c8f0','#c0b5e8','#a89ad8','#1e1438','#483a70','#8070a8','#d0c8f0','#7c3aed','#6d28d9','#a78bfa','#db2777'),
  th('rose','Rose Quartz','light','light','#fff1f2','#ffe4e6','#ffd6d8','#ffc8ca','#feb8bc','#fca5a5','#f87171','#2a0a10','#65292e','#a05055','#feb8bc','#f43f5e','#e11d48','#fb7185','#db2777'),
  th('peach','Peach','light','light','#fff7ed','#ffedd5','#fed7aa','#fdba74','#f5b070','#f5a050','#ea8820','#2a1500','#603020','#a06040','#f5b070','#ea580c','#c2410c','#fb923c','#d97706'),
  th('lemon','Lemon','light','light','#fefce8','#fef9c3','#fef08a','#fde047','#facc15','#eab308','#ca8a04','#1a1500','#454010','#806a00','#facc15','#ca8a04','#a16207','#fde047','#16a34a'),
  th('sage','Sage','light','light','#f1f8f2','#e6f2e8','#d8ecdb','#cce4d0','#bddac2','#a8cdb0','#88b590','#0e2010','#284530','#558060','#bddac2','#4d7c0f','#3f6212','#84cc16','#0891b2'),
  th('sand','Sand','light','light','#fdf8ef','#f8f0e0','#f0e4c8','#e8d8b4','#e0cca0','#d5c090','#c0a870','#251800','#564018','#907030','#e0cca0','#92400e','#78350f','#d97706','#6366f1'),
  th('dusk','Dusk','light','light','#fffbf0','#fef5dc','#fcedc4','#f9e4ac','#f5d88e','#eac870','#d4a840','#1a1000','#503e10','#906030','#f5d88e','#d97706','#b45309','#f59e0b','#16a34a'),
  th('blossom','Blossom','light','light','#fdf2f8','#fce7f3','#f9d0e9','#f6b9dd','#f0a0cf','#ec8ac5','#e065b0','#2a0820','#602040','#a05570','#f0a0cf','#db2777','#be185d','#f472b6','#c026d3'),
  th('sea-foam','Sea Foam','light','light','#f0fdfa','#e0f8f3','#ccf2e8','#b8ecdc','#a0e4cc','#80d8b8','#5cc4a0','#0a2018','#204838','#408060','#a0e4cc','#0d9488','#0f766e','#2dd4bf','#0ea5e9'),
  th('stone','Stone','light','light','#f8f7f5','#f0ede8','#e8e4dc','#dedad0','#d5cfc4','#c8c0b0','#b0a898','#1c1810','#505040','#908870','#d5cfc4','#78716c','#57534e','#a8a29e','#0891b2'),
  th('nordic-light','Nordic Light','light','light','#eceff4','#e5e9f0','#d8dee9','#cdd3de','#c5cad5','#b8c0cc','#9ea8b8','#2e3440','#3b4252','#4c566a','#c5cad5','#5e81ac','#4e6d96','#81a1c1','#88c0d0'),
  th('solarized-light','Solarized Light','light','light','#fdf6e3','#eee8d5','#e8dfcc','#e0d5c0','#d5cab0','#c0b090','#a89070','#657b83','#586e75','#839496','#d5cab0','#268bd2','#1e77b4','#6ab5e8','#2aa198'),
  th('gruvbox-light','Gruvbox Light','light','light','#fbf1c7','#f2e5bc','#ebdbb2','#d5c4a1','#c8b690','#bdae93','#a89984','#3c3836','#504945','#7c6f64','#c8b690','#9d0006','#7b0005','#cc241d','#427b58'),
  th('catppuccin-latte','Catppuccin Latte','light','light','#eff1f5','#e6e9ef','#dce0e8','#ccd0da','#bcc0cc','#acb0be','#9099ad','#4c4f69','#5c5f77','#6c6f85','#bcc0cc','#8839ef','#7527d4','#b87fff','#04a5e5'),
  th('one-light','One Light','light','light','#fafafa','#f4f4f4','#ededed','#e8e8e8','#e0e0e0','#d8d8d8','#c0c0c0','#2a2a2a','#505060','#9090a0','#e0e0e0','#4078f2','#2060e8','#7aabff','#a626a4'),
  th('github-light','GitHub Light','light','light','#ffffff','#f6f8fa','#eaeef2','#d0d7de','#d0d7de','#d0d7de','#b1bac4','#1f2328','#57606a','#8c959f','#d0d7de','#0969da','#0450a0','#54aeff','#1a7f37'),
  th('material-light','Material Light','light','light','#fafafa','#f5f5f5','#eeeeee','#e0e0e0','#d6d6d6','#c8c8c8','#b0b0b0','#212121','#616161','#9e9e9e','#d6d6d6','#1565c0','#0d47a1','#5e92f3','#558b2f'),
  th('meadow','Meadow','light','light','#f5fbf2','#ebf6e4','#dcf0d3','#cce9c0','#bde2ad','#a0d090','#7cb87a','#0c200a','#2a4a28','#508050','#bde2ad','#2d6a4f','#1b4332','#52b788','#1890a8'),

  // ── High Contrast ────────────────────────────────────────────────────────────
  th('hc-dark','HC Dark','contrast','dark','#000000','#0a0a0a','#141414','#1e1e1e','#282828','#666666','#aaaaaa','#ffffff','#eeeeee','#aaaaaa','#222222','#ffff00','#e0e000','#ffff80','#00ffff'),
  th('hc-light','HC Light','contrast','light','#ffffff','#f0f0f0','#e0e0e0','#d0d0d0','#c0c0c0','#666666','#000000','#000000','#111111','#444444','#cccccc','#0000cc','#000099','#4444ff','#cc0000'),
  th('hc-blue','HC Blue','contrast','dark','#00008b','#0000a0','#0000b8','#0000d0','#0000e8','#4444ff','#8888ff','#ffffff','#eeeeff','#aaaaff','#0000c0','#00ff00','#00cc00','#80ff80','#ffff00'),
  th('hc-yellow','HC Yellow','contrast','dark','#000000','#0a0a00','#141400','#1e1e00','#2a2a00','#555500','#999900','#ffff00','#eeee00','#aaaa00','#222200','#ffffff','#eeeeee','#ffffff','#00ffff'),
  th('hc-green','HC Green','contrast','dark','#000000','#000a00','#001400','#001e00','#002800','#005500','#009900','#00ff00','#00ee00','#00aa00','#002200','#ffffff','#eeeeee','#ffffff','#00ffff'),

  // ── Coding ───────────────────────────────────────────────────────────────────
  th('monokai-pro','Monokai Pro','coding','dark','#2d2a2e','#302d31','#363337','#3d393e','#444048','#4a454e','#5e5862','#fcfcfa','#c1bfce','#727072','#363337','#ff6188','#e83d6a','#ff97b2','#ffd866'),
  th('atom-dark','Atom Dark','coding','dark','#1d1f27','#22242e','#282b38','#2e3140','#353844','#3a3e52','#4a506c','#c0c5ce','#a7acb5','#65737e','#282b38','#6699cc','#4f7fb8','#98c5f0','#eb606b'),
  th('submarine','Submarine','coding','dark','#1a2a3a','#1f3048','#243650','#2a3d5c','#304568','#3a5070','#4c6888','#c8e8f8','#80b8d8','#405870','#243650','#00bcd4','#0097a7','#4dd0e1','#80cbc4'),
  th('material-darker','Material Darker','coding','dark','#212121','#282828','#303030','#383838','#404040','#484848','#606060','#eeffff','#c3c9d1','#546e7a','#303030','#82aaff','#5e89f5','#adc8ff','#c3e88d'),
  th('everforest','Everforest','coding','dark','#2b3339','#323c41','#3a4348','#414b51','#4a555c','#5c6a72','#7a8c96','#d3c6aa','#9da9a0','#859289','#3a4348','#a7c080','#84a060','#c0d8a0','#83c092'),
  th('kanagawa','Kanagawa','coding','dark','#1f1f28','#252535','#2a2a37','#363646','#40405a','#484862','#5e5e7e','#dcd7ba','#c8c093','#727169','#2a2a37','#7e9cd8','#5e82c0','#98b8f0','#98bb6c'),
  th('nightfox','Nightfox','coding','dark','#192330','#1e2a38','#243040','#2a3848','#304058','#3a4c60','#4e6478','#cdcecf','#aeafb0','#738091','#243040','#719cd6','#5680c0','#9fbae8','#c43e1f'),
  th('rose-pine','Rosé Pine','coding','dark','#191724','#1f1d2e','#26233a','#2d2a42','#363250','#44415a','#56526e','#e0def4','#908caa','#6e6a86','#26233a','#eb6f92','#d35175','#f5a8c5','#9ccfd8'),
  th('oxocarbon','Oxocarbon','coding','dark','#161616','#1c1c1c','#222222','#282828','#2e2e2e','#393939','#525252','#f4f4f4','#c6c6c6','#6f6f6f','#222222','#78a9ff','#5589f5','#a6c5ff','#42be65'),
  th('catppuccin-frappe','Catppuccin Frappé','coding','dark','#303446','#292c3c','#414559','#51576d','#626880','#626880','#737994','#c6d0f5','#b5bfe2','#737994','#414559','#ca9ee6','#b07ece','#e0b8ff','#8caaee'),
]

// ── Apply a theme to the document root ────────────────────────────────────────
function applyTheme(spec: ThemeSpec) {
  const r = document.documentElement
  const vars: [string, string][] = [
    ['--bg',           spec.bg],
    ['--bg-surface',   spec.bgSurface],
    ['--bg-card',      spec.bgCard],
    ['--bg-card-2',    spec.bgCard2],
    ['--bg-hover',     spec.bgHover],
    ['--border',       spec.border],
    ['--border-hover', spec.borderHover],
    ['--border-focus', spec.brand],
    ['--text',         spec.text],
    ['--text-2',       spec.text2],
    ['--text-3',       spec.text3],
    ['--text-ghost',   spec.textGhost],
    ['--brand',        spec.brand],
    ['--brand-dark',   spec.brandDark],
    ['--brand-light',  spec.brandLight],
    ['--accent',       spec.accent],
    ['--shadow-brand', `0 4px 24px ${spec.brand}40`],
    ['--shadow-sm',    spec.colorScheme === 'light' ? '0 1px 3px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.4)'],
    ['--shadow-md',    spec.colorScheme === 'light' ? '0 4px 16px rgba(0,0,0,0.10)' : '0 4px 16px rgba(0,0,0,0.5)'],
    ['--shadow-lg',    spec.colorScheme === 'light' ? '0 8px 40px rgba(0,0,0,0.12)' : '0 8px 40px rgba(0,0,0,0.6)'],
  ]
  for (const [k, v] of vars) r.style.setProperty(k, v)
  r.setAttribute('data-theme', spec.colorScheme)
  r.style.colorScheme = spec.colorScheme
}

// ── Backward-compat accent shim ────────────────────────────────────────────────
export interface Accent { id: string; label: string; brand: string; dark: string; accent: string }
export const ACCENTS: Accent[] = [
  { id: 'indigo',  label: 'Indigo',  brand: '#6366f1', dark: '#4f46e5', accent: '#8b5cf6' },
  { id: 'emerald', label: 'Emerald', brand: '#10b981', dark: '#059669', accent: '#14b8a6' },
  { id: 'rose',    label: 'Rose',    brand: '#f43f5e', dark: '#e11d48', accent: '#fb7185' },
  { id: 'amber',   label: 'Amber',   brand: '#f59e0b', dark: '#d97706', accent: '#f97316' },
  { id: 'cyan',    label: 'Cyan',    brand: '#06b6d4', dark: '#0891b2', accent: '#3b82f6' },
  { id: 'violet',  label: 'Violet',  brand: '#8b5cf6', dark: '#7c3aed', accent: '#d946ef' },
]

// ── Context ───────────────────────────────────────────────────────────────────
interface Ctx {
  themeId: string
  setTheme: (id: string) => void
  theme: 'dark' | 'light'
  toggle: () => void
  accent: string
  setAccent: (id: string) => void
}

const Ctx = createContext<Ctx>({
  themeId: 'midnight', setTheme: () => {},
  theme: 'dark', toggle: () => {},
  accent: 'indigo', setAccent: () => {},
})

export function useTheme() { return useContext(Ctx) }

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState('midnight')

  useEffect(() => {
    const saved = localStorage.getItem('themeId') ?? 'midnight'
    setThemeId(saved)
    const spec = THEMES.find(t => t.id === saved) ?? THEMES[0]
    applyTheme(spec)
  }, [])

  const setTheme = (id: string) => {
    const spec = THEMES.find(t => t.id === id) ?? THEMES[0]
    setThemeId(id)
    localStorage.setItem('themeId', id)
    applyTheme(spec)
  }

  const toggle = () => {
    const spec = THEMES.find(t => t.id === themeId)
    const nextId = spec?.colorScheme === 'light'
      ? (localStorage.getItem('lastDark') ?? 'midnight')
      : (localStorage.getItem('lastLight') ?? 'cloud')
    const nextSpec = THEMES.find(t => t.id === nextId) ?? THEMES[0]
    if (spec) localStorage.setItem(spec.colorScheme === 'dark' ? 'lastDark' : 'lastLight', themeId)
    setThemeId(nextId)
    localStorage.setItem('themeId', nextId)
    applyTheme(nextSpec)
  }

  const spec = THEMES.find(t => t.id === themeId) ?? THEMES[0]
  const theme = spec.colorScheme
  const accent = 'indigo'
  const setAccent = (_id: string) => { /* no-op: themes control brand color */ }

  return (
    <Ctx.Provider value={{ themeId, setTheme, theme, toggle, accent, setAccent }}>
      {children}
    </Ctx.Provider>
  )
}
