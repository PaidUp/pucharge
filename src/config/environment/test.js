// Development specific configuration
// ==================================
module.exports = {
  port: process.env.PORT || 9001,
  mongo: {
    url: 'mongodb://pudevelop:xEbiMFBtX48ObFgC@pu-dev-shard-00-00-4nodg.mongodb.net:27017,pu-dev-shard-00-01-4nodg.mongodb.net:27017,pu-dev-shard-00-02-4nodg.mongodb.net:27017/develop?ssl=true&replicaSet=pu-dev-shard-0&authSource=admin',
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
  }
}
