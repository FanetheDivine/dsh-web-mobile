import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function layoutSource(): string {
  return readFileSync(join(root, 'src/client/styles/layout.css.ts'), 'utf8')
}

// The 0.1.6-alpha.2 header adaptation block must be inert on pre-alpha.2
// hosts: only _headerLeading/_crumbCurrent/_crumbSeg/_headerCorner are
// alpha.2-only classes, so every cross-generation anchor in the block
// (_titleCluster/_crumbs/_headerActions/_headerUtilities/tablist/QsffPG_/
// ZKlsPq_/:first-child chains) has to sit behind a header:has existence gate.
test('every selector in the alpha.2 header block carries the _headerLeading generation gate', () => {
  const source = layoutSource()
  const start = source.indexOf('0.1.6-alpha.2 session-header adaptation')
  assert.ok(start > 0, 'alpha.2 header section marker not found')
  const end = source.indexOf('/* --- Settings dialog on mobile ---', start)
  assert.ok(end > start, 'settings section marker not found after the header block')
  const lines = source.slice(start, end).split('\n')
  const offenders = lines
    .filter((line) => line.includes('[data-phase] header'))
    .filter((line) => !line.includes('header:has([class*="_headerLeading"])'))
  assert.deepEqual(offenders, [], 'ungated cross-generation selectors in the alpha.2 block')
  const gates = lines.filter((line) => line.includes('header:has([class*="_headerLeading"])')).length
  assert.ok(gates >= 30, `expected the full gated block, found only ${gates} gates`)
})

// 0.2.0-rc.x moved the leading seat out of the title row and made it the
// header's own first grid column (grid-template-columns: auto minmax(0,1fr),
// seat grid-area 1/1, title row grid-column 2). The 32px seat that keeps the
// title clear of the toggle used to be titleRow's own content-box offset; on
// that generation it degrades into "grid column 1 happens to be 32px", so any
// rule that collapses the seat takes the title with it — measured on
// 0.2.0-rc.2: crumbs x=8 under the toggle at (8,6,28x28), i.e. the same failure
// the 2026-09-22 real-device run recorded on 0.1.6. The seat must therefore be
// carried by the title row itself. Behaviour is pinned at runtime by scene 4 of
// scripts/probes/header-files-pin-probe.mjs.
test('the 0.2.0 grid header carries its seat on the title row, not on the seat box', () => {
  const source = layoutSource()
  const grid = '[data-phase] header:has([class*="_headerLeading"]):has(> [data-conversation-header-leading])'
  assert.ok(source.includes(grid), 'the 0.2.0 grid-header gate is missing')
  const titleRule = source.slice(source.indexOf(`${grid} [class*="_titleRow"] {`))
  assert.ok(titleRule.startsWith(grid), 'title-row seat rule not found')
  const declarations = titleRule.slice(0, 240)
  assert.ok(declarations.includes('padding-left: 32px !important'), 'title row must carry the 32px seat')
  assert.ok(declarations.includes('box-sizing: border-box !important'), 'border-box keeps the seat inside column 2')
  assert.ok(source.includes(`${grid} > [data-conversation-header-leading] {`), 'the seat box itself must be zeroed')
  assert.ok(
    source.includes('[data-slot="conversation.header.leading"] {'),
    'the leading slot must be hidden by slot name, not by a :last-child chain',
  )
})

// The old position:static containment has higher specificity than the new
// absolute chip rules; with both !important, specificity decides (not source
// order), so on alpha.2 it must be excluded or the chips never leave the row.
test('the static containment rule is excluded on alpha.2 so absolute chips win', () => {
  assert.ok(
    layoutSource().includes(
      'header:not(:has([class*="_headerLeading"])) [class*="_headerActions"] [class*="_root"]',
    ),
    'static containment rule must carry the alpha.2 exclusion gate',
  )
})

// rc hosts render the input.left seat but ship no input[type=file] (intake is
// paste/drop only there); without this hide the control is a dead button.
test('the file-upload control hides itself where the host has no file input', () => {
  assert.ok(layoutSource().includes(':not(:has(input[type=file])) [data-mobile-nav="file-upload"]'))
})

// alpha.2 renamed the hero-empty marker; both hide rules must coexist.
test('the hero empty-header hide covers both generation markers', () => {
  const source = layoutSource()
  assert.ok(source.includes('header[class*="_headerHidden"]'))
  assert.ok(source.includes('header[class*="headerBlank"]'))
})
