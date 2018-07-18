import { MongoClient, ObjectID } from 'mongodb'
import config from './config/environment'
import { Logger } from 'pu-common'
import sqs from 'sqs'
import strp from 'stripe'
const stripe = strp(config.stripe.key)
const queue = sqs(config.sqs.credentials)

Logger.setConfig(config.logger)

function getStatus (charge) {
  let resp
  switch (charge.status) {
    case 'succeeded':
      resp = 'paidup'
      break
    case 'pending':
      resp = 'submitted'
      break
    default:
      resp = charge.status
  }
  return resp
}

function updateInvoice (invoice, charge) {
  return new Promise((resolve, reject) => {
    let client
    let status = getStatus(charge)
    charge.created = new Date()
    try {
      MongoClient.connect(config.mongo.url, (err, cli) => {
        client = cli
        if (err) return reject(err)
        const col = client.db(config.mongo.db).collection(config.mongo.collection)
        col.updateOne({ _id: ObjectID(invoice) }, { $set: { status }, $inc: {__v: 1}, $push: {attempts: charge} }, function (err, r) {
          if (err) return reject(err)
          client.close()
          resolve(r)
        })
      })
    } catch (error) {
      client.close()
      reject(error)
    }
  })
}

function charge ({amount, totalFee, externalCustomerId, externalPaymentMethodId, connectAccount, description, statementDescriptor, metadata, paymentMethodtype, attempts}) {
  let idempotencyKey = paymentMethodtype === 'bank_account' ? metadata._invoice + attempts : metadata._invoice
  return new Promise((resolve, reject) => {
    stripe.charges.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      source: externalPaymentMethodId, // cardId
      customer: externalCustomerId, // cus_xx
      destination: connectAccount, // acc_xx
      description: description,
      application_fee: Math.round(totalFee * 100),
      statement_descriptor: statementDescriptor,
      metadata
    }, {
      idempotency_key: idempotencyKey
    }, function (err, charge) {
      if (err) {
        err.invoice = metadata._invoice
        return reject(err)
      }
      charge.invoice = metadata._invoice
      return resolve(charge)
    })
  })
}

function pull () {
  Logger.info('Starting Charge Invoice ' + process.env.NODE_ENV)
  try {
    MongoClient.connect(config.mongo.url, (err, cli) => {
      if (err) {
        Logger.info('Error connected to db ' + err)
        return false
      } else {
        Logger.info('Db test connection to db: ' + config.mongo.db)
        cli.close()
      }
    })
  } catch (error) {
    return false
  }

  queue.pull(config.sqs.queueName, config.sqs.workers, function (invoice, callback) {
    const param = {
      amount: invoice.price,
      totalFee: invoice.totalFee,
      externalPaymentMethodId: invoice.paymentDetails.externalPaymentMethodId,
      externalCustomerId: invoice.paymentDetails.externalCustomerId,
      connectAccount: invoice.connectAccount,
      description: invoice.label,
      statementDescriptor: invoice.paymentDetails.statementDescriptor,
      paymentMethodtype: invoice.paymentDetails.paymentMethodtype,
      attempts: invoice.attempts.length,
      metadata: {
        organizationId: invoice.organizationId,
        organizationName: invoice.organizationName,
        productId: invoice.productId,
        productName: invoice.productName,
        beneficiaryId: invoice.beneficiaryId,
        beneficiaryFirstName: invoice.beneficiaryFirstName,
        beneficiaryLastName: invoice.beneficiaryLastName,
        totalFee: invoice.totalFee,
        paidupFee: invoice.paidupFee,
        stripeFee: invoice.stripeFee,
        _invoice: invoice._id,
        _order: invoice.orderId,
        invoiceId: invoice.invoiceId,
        userId: invoice.user.userId,
        userFirstName: invoice.user.userFirstName,
        userLastName: invoice.user.userLastName,
        userEmail: invoice.user.userEmail
      }
    }
    charge(param)
      .then(charge => updateInvoice(invoice._id, charge))
      .then(res => {
        Logger.info('Invoice charged successfully:  ' + invoice.invoiceId)
        callback()
      })
      .catch(reason => {
        if (reason.type) {
          Logger.warning('Invoice charged failed:  ' + invoice.invoiceId)
          Logger.warning(reason)
          updateInvoice(invoice._id, {
            type: reason.type,
            message: reason.message,
            code: reason.code,
            statusCode: reason.statusCode,
            status: 'failed'
          }).then(res => callback()).catch(reason => callback())
        } else {
          Logger.critical('Invoice charged critical failed:  ' + invoice.invoiceId)
          Logger.critical(reason)
          updateInvoice(invoice._id, {
            error: reason,
            status: 'failed'
          }).then(res => callback()).catch(reason => callback())
        }
      })
  })
}

process.on('exit', (cb) => {
  Logger.info('bye......')
})

process.on('unhandledRejection', (err) => {
  throw err
})
process.on('uncaughtException', (err) => {
  Logger.critical(err)
  if (process.env.NODE_ENV === 'test') {
    process.exit(1)
  }
})

pull()
