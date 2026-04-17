// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    unocss: true,
    formatters: true,
    pnpm: true,
    ignores: ['src/assets/edmm-models/**/*.yaml'],
  },
  {
    rules: {
      'indent': 'off',
      'style/indent': 'off',
    },
  },
)
