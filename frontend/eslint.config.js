import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      // flat config 전용 항목을 써야 한다. configs['recommended-latest']는
      // eslintrc 형식이라 plugins가 배열로 들어 있어 flat config에서 로드가 깨진다.
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // 의도적으로 비운 catch는 허용한다. 로깅 실패까지 삼키는 자리가 있다(api/client.ts).
      'no-empty': ['error', { allowEmptyCatch: true }],
      // _로 시작하는 이름은 "안 쓴다"고 밝힌 것이므로 통과시킨다
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // ── 아래는 CI를 붙이는 시점에 이미 코드에 있던 위반이라 warn으로 둔다.
      //    새로 생기는 위반은 눈에 띄되 빌드를 막지는 않는다.
      //    정리하면서 하나씩 error로 되돌릴 것.
      '@typescript-eslint/no-explicit-any': 'warn', // 58건, 대부분 catch (e: any)
      '@typescript-eslint/no-empty-object-type': 'warn', // 1건
      'react-hooks/set-state-in-effect': 'warn', // 4건
      'react-hooks/refs': 'warn', // 5건
      'react-refresh/only-export-components': 'warn', // 2건
    },
  },
])
