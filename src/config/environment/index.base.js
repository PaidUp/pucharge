import _ from 'lodash'
import develop from './develop'
import production from './production'
import test from './test'
import stage from './stage'

const envs = {
  develop,
  production,
  test,
  stage
}

// All configurations will extend these options
// ============================================
let all = {
  sqs: {
    credentials: {
      access: 'AKIAJRCEYTHLPFLTZW6Q',
      secret: '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',
      region: 'us-east-1'
    },
    workers: 2,
    queueName: 'invoice-dev'
  },
  stripe: {
    key: 'sk_test_wE4QBHe2SZH9wZ6uMZliup0g'
  }
}

if (process.env.NODE_ENV) {
  all = _.merge(
    all,
    envs[process.env.NODE_ENV] || {})
}

// Export the config object based on the NODE_ENV
// ==============================================
export default all
