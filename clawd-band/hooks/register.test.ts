import { expect, test } from 'claude-code/testing'

const pass = () => ({ type: 'Box', props: {}, children: [] }) as any

const band = (surface: 'desktop' | 'terminal') =>
  ({
    surface,
    component: 'AbovePrompt',
    requestId: 'band',
    props: { hasSurvey: false, maxRows: 10, bodyColumns: 80 },
  }) as any

test('desktop: Clawd stands still when idle', async ($, on) => {
  on('ui.render', pass)
  const tree: any = await $.ui.render(band('desktop'))
  const [left, right] = tree.children
  const clawd = right.children[right.children.length - 1]
  expect(clawd.props.alt).toBe('Clawd: Idle')
  expect(clawd.props.source).not.toContain('<animate')
  expect(left.children[0].props.alt).toBe('Clock')
})

test('desktop: an Edit call plays Typing while it runs', async ($, on) => {
  let during = ''
  on('ui.render', pass)
  on('tool.call', async () => {
    during = JSON.stringify(await $.ui.render(band('desktop')))
    return { result: 'ok', text: 'ok' } as any
  })
  await $.tool.call({ tool: 'Edit', file_path: 'a.txt', old_string: 'a', new_string: 'b' } as any)
  expect(during).toContain('Clawd: Typing')
})

test('desktop: a failed Bash call plays Oops', async ($, on) => {
  on('ui.render', pass)
  on('tool.call', () => ({ result: 'boom', text: 'boom', isError: true }) as any)
  await $.tool.call({ tool: 'Bash', command: 'false' } as any)
  expect(JSON.stringify(await $.ui.render(band('desktop')))).toContain('Clawd: Oops')
})

test('terminal: block Clawd above the prompt', async ($, on) => {
  on('ui.render', pass)
  expect(JSON.stringify(await $.ui.render(band('terminal')))).toContain('▝▜█████▛▘')
})

test('desktop: an Edit call shows the Editing status', async ($, on) => {
  let during = ''
  on('ui.render', pass)
  on('tool.call', async () => {
    during = JSON.stringify(await $.ui.render(band('desktop')))
    return { result: 'ok', text: 'ok' } as any
  })
  await $.tool.call({ tool: 'Edit', file_path: 'src/app/main.ts', old_string: 'a', new_string: 'b' } as any)
  expect(during).toContain('Status: Editing')
})

test('desktop: idle shows the Idle status', async ($, on) => {
  on('ui.render', pass)
  expect(JSON.stringify(await $.ui.render(band('desktop')))).toContain('Status: Idle')
})
