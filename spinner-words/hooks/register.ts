import type { Register } from 'claude-code'

// Add more words here; one is picked at random each time.
const WORDS = ['Cooking', 'Brewing', 'Tinkering', 'Sorting it', 'One sec', 'Thinking hard']

export const register: Register = on => {
  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    if (e.props.word !== 'Working') {
      return next(e)
    }

    const word = WORDS[Math.floor(Math.random() * WORDS.length)]

    return next({ ...e, props: { ...e.props, word } })
  })
}
