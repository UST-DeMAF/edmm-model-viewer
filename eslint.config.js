// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    unocss: true,
    formatters: true,
    pnpm: true,
  },
  {
    rules: {
      'indent': 'off',
      'style/indent': 'off',
    },
  },
)
