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
  mongo: {
    url: 'mongodb+srv://pudevelop:xEbiMFBtX48ObFgC@pu-dev-4nodg.mongodb.net/develop?retryWrites=true',
    db: 'develop',
    collection: 'pu_commerce_invoices'
  },
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
  },
  logger: {
    projectId: 'gothic-talent-192920',
    logName: 'pu-charge-local-log',
    metadata: {resource: {type: 'global'}}
  },
  email: {
    options: {
      apiKey: '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',
      fromName: 'Support',
      fromEmail: 'support@getpaidup.com'
    },
    templates: {
      reminder: {
        id: '6d32adf5-2b25-48ae-a816-31ee49abc2e0',
        baseUrl: 'http://localhost:8080/players',
        days: 8,
        cron: '0 0 10 * * *'
      },
      receipt: {
        id: 'dc44ef75-2a41-49c3-a811-7f28a0ea9a38',
        baseUrl: 'http://localhost:8080/players'
      }
    }
  },
  zendesk: {
    urlBaseLink: 'http://localhost:8080/players',
    username: 'ricardo@getpaidup.com',
    token: '6ON1frWgVv8acTGZNnabBMjj500JZA8vmGK2rNeb',
    subdomain: 'getpaidup1478060212',
    assignee: '14532798047',
    customFields: {
      ticketReasonCategory: '48042408',
      balance: '56485848',
      paymentLink: '80373287',
      invoiceId: '360014425333'
    }
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
