import { expect, test } from 'claude-code/testing'

const spinner = (word: string) => ({
  surface: 'desktop' as const,
  component: 'Spinner' as const,
  requestId: 'main',
  props: { word, message: null, suffix: '…', mode: 'thinking' as const },
})

test('swaps Working for a custom word, keeps real step text', async ($, on) => {
  const seen: string[] = []
  on('ui.render', { component: 'Spinner' }, ($, e) => {
    seen.push(e.props.word)
    return { type: 'Box', props: {}, children: [] }
  })

  await $.ui.render(spinner('Working'))
  await $.ui.render(spinner('Creating notes.md'))

  expect(['Cooking', 'Brewing', 'Tinkering', 'Sorting it', 'One sec', 'Thinking hard']).toContain(seen[0])
  expect(seen[1]).toBe('Creating notes.md')
})
