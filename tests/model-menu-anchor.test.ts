// 模型菜单重锚定的「成本契约」：滚动 / 视口路径不得查询全文档。
//
// 起因（2026-09-23，店主批准的优化）：本机 18,359 节点时
// `querySelectorAll('[class*="_7KE1Ra_menu"]')` = 0.568ms/次、卡片查询 0.08ms/次。
// 旧版把这些查询挂在 pointerdown/click/resize/scroll 上 ⇒ 菜单关着时每次滚动也白花
// 约 0.65ms/帧（模型流式输出时页面每帧都在滚 —— 60Hz 帧预算的 4%、120Hz 的 8%）。
// 现在查询只在「命中触发器/菜单的交互」后发生，滚动/改变尺寸只对缓存节点重算位置。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC = readFileSync(
  fileURLToPath(new URL('../src/client/effects/model-menu-anchor.ts', import.meta.url)),
  'utf8',
)
const LAYOUT = readFileSync(
  fileURLToPath(new URL('../src/client/styles/layout.css.ts', import.meta.url)),
  'utf8',
)

test('滚动/改变尺寸只重算缓存节点，绝不查询', () => {
  const start = SRC.indexOf('const follow = ')
  const end = SRC.indexOf('const schedule = ', start)
  assert.ok(start > 0 && end > start, 'follow() 未找到')
  assert.ok(!SRC.slice(start, end).includes('querySelector'), 'follow() 里出现了查询')
  assert.match(SRC, /document\.addEventListener\('scroll', onViewportChange, true\)/)
  assert.match(SRC, /window\.addEventListener\('resize', onViewportChange\)/)
})

test('全文档查询只有一个入口，且只在命中触发器/菜单的交互后触发', () => {
  const queries = SRC.match(/querySelectorAll<HTMLElement>\(MODEL_MENU\)/g) ?? []
  assert.equal(queries.length, 1, '菜单查询必须集中在 findMenu() 一处')
  assert.match(
    SRC,
    /target\.closest\(MODEL_TRIGGER\) !== null \|\| target\.closest\(MODEL_MENU\) !== null/,
    '交互路径必须按目标做门控，不能对每次点击都查询',
  )
  for (const event of ['pointerdown', 'keydown', 'focusin', 'click']) {
    assert.ok(SRC.includes(`document.addEventListener('${event}', on`), `${event} 未接入交互路径`)
  }
})

test('菜单能放入视口时贴触发器右缘，越界时回退卡片居中', () => {
  assert.match(SRC, /triggerBox\.right - width/)
  assert.match(SRC, /flush >= GUTTER && flush <= max/)
  assert.match(SRC, /cardBox\.left \+ \(cardBox\.width - width\) \/ 2/)
  const start = SRC.indexOf('const place = ')
  const end = SRC.indexOf('const refresh = ', start)
  assert.ok(!SRC.slice(start, end).includes('querySelector'), 'place() 只能读取缓存锚点')
})

// 手机档「推理等级」面板收窄的选择器契约（2026-10-11）。
//
// 真机量到的两套 DOM（dsh-client-ui-model-selection 0.2.0-rc.2，393×844，真实宿主包）：
//   档位面板  DIV._surface_ri079_1._7KE1Ra_menu[role=menu]
//               > DIV._material_ri079_21
//               > button._7KE1Ra_option[role=menuitemradio]        ← 直接子级
//   模型面板  DIV._surface_ri079_1._7KE1Ra_menu[role=group]
//               > DIV._material_ri079_21
//               > DIV._7KE1Ra_groups.scrollable[role=menu]
//                   > SECTION._group_121p8_1[role=group] > button[role=menuitemradio]
// 宿主按 pane 决定 role（model ⇒ group，其余 ⇒ menu），所以「role=menu + 直接子级
// menuitemradio」两条一起才唯一选中档位面板。只留任一条件都不安全：去掉 role 会命中
// 模型面板内层的 _groups 容器；把直接子级放宽成后代会命中模型面板外壳。
// 实测反例（2026-10-11 独立验证）：`[role="group"]:has([role="menuitemradio"])` 在手机档
// 命中模型面板（248→216px）、档位面板仍是 248px，与预期正好相反；模型面板在本机没有
// input[role="searchbox"]，所以 `:not(:has(input))` 也拦不住。
test('手机档档位面板选择器只命中档位面板', () => {
  const at = LAYOUT.indexOf('Phone reasoning-effort list is compact')
  assert.notEqual(at, -1, '档位面板规则丢失')
  const block = LAYOUT.slice(LAYOUT.lastIndexOf('/*', at), LAYOUT.indexOf('/* --- Fix composer row overflow', at))
  assert.match(block, /@media \(max-width: 767px\) and \(pointer: coarse\)/, '只在手机档生效')
  assert.match(block, /\[class\*="_7KE1Ra_menu"\]\[role="menu"\]/, '档位面板外壳的 role 是 menu')
  assert.match(block, /:has\(> \[role="menuitemradio"\]\)/, '档位面板的 radio 是外壳的直接子级')
  assert.match(block, /min-width: 0 !important/, '宿主 min-width:240px 不收窄就白改')
  // 注释里引用了被实测证伪的写法，所以只对去掉注释的规则体做反向断言。
  const ruleOnly = block.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(ruleOnly, /\[role="group"\]/, 'group 是模型面板，不许再写成 group')
  assert.doesNotMatch(ruleOnly, /:has\(\[role="menuitemradio"\]\)/, '后代匹配会命中模型面板外壳，必须是直接子级')
})
