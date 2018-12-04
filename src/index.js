import { MongoClient, ObjectID } from 'mongodb'
import config from './config/environment'
import numeral from 'numeral'
import Reminder from './reminder'
import { Logger, Email } from 'pu-common'
import CommonUtil from './commonUtil'
import sqs from 'sqs'
import strp from 'stripe'
import randomstring from 'randomstring'
const reminder = new Reminder(config.email.options)
const stripe = strp(config.stripe.key)
const queue = sqs(config.sqs.credentials)
const email = new Email(config.email.options)
let collection

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
      resp = charge.status || 'failed'
  }
  return resp
}

async function updateInvoice (_id, charge) {
  const status = getStatus(charge)
  const res = await collection.findOneAndUpdate({ _id }, { $set: { status }, $inc: {__v: 1}, $push: {attempts: charge} }, { returnOriginal: false })
  return res.value
}

function charge ({id, amount, totalFee, externalCustomerId, externalPaymentMethodId, connectAccount, description, statementDescriptor, metadata, idempotencyKey}) {
  const idempotency = idempotencyKey ? idempotencyKey + id : id
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
      idempotency_key: idempotency
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

async function porcessCharge (invoice, cb) {
  const _id = ObjectID(invoice._id)
  try {
    const param = {
      id: invoice._id,
      amount: invoice.price,
      totalFee: invoice.totalFee,
      externalPaymentMethodId: invoice.paymentDetails.externalPaymentMethodId,
      externalCustomerId: invoice.paymentDetails.externalCustomerId,
      connectAccount: invoice.connectAccount,
      description: invoice.label,
      statementDescriptor: invoice.paymentDetails.statementDescriptor,
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
      },
      idempotencyKey: invoice.idempotencyKey
    }
    const inv = await collection.findOne({ _id })
    if (inv && inv.attempts.length) {
      const attempt = inv.attempts[inv.attempts.length - 1]
      const status = getStatus(attempt)
      if (status === 'paidup' || status === 'submitted') {
        Logger.warning('Invoice had a previous charge: ' + invoice.invoiceId)
        await collection.findOneAndUpdate({ _id }, { $set: { status }, $inc: {__v: 1} }, { returnOriginal: false })
        return
      }
    }
    const chargeRes = await charge(param)
    const res = await updateInvoice(_id, chargeRes)
    Logger.info('Invoice charged successfully:  ' + res.invoiceId)
    email.sendTemplate(res.user.userEmail, config.email.templates.receipt.id, {
      invoiceId: res.invoiceId,
      invoiceURL: config.email.templates.receipt.baseUrl + '/' + res.beneficiaryId,
      orgName: res.organizationName,
      userFirstName: res.user.userFirstName,
      beneficiaryFirstName: res.beneficiaryFirstName,
      beneficiaryLastName: res.beneficiaryLastName,
      productName: res.productName,
      trxAmount: '$' + numeral(res.price).format('0,0.00'),
      trxAccount: `${res.paymentDetails.brand}••••${res.paymentDetails.last4}`,
      trxDesc: res.label,
      invoices: CommonUtil.buildTableInvoice(res)
    })
  } catch (reason) {
    if (reason.type) {
      Logger.warning('Invoice charged failed:  ' + invoice.invoiceId)
      Logger.warning(reason.message)
      let setValues = {status: 'failed'}
      if (reason.code === 'token_in_use' && invoice.paymentDetails.paymentMethodtype === 'bank_account') {
        setValues.status = 'autopay'
        setValues.idempotencyKey = randomstring.generate(5)
      }
      await collection.update({ _id }, { $set: setValues, $inc: {__v: 1}, $push: {attempts: reason} })
    } else {
      Logger.critical('Invoice charged critical failed:  ' + invoice.invoiceId)
      Logger.critical(reason.message)
      await collection.update({ _id }, { $set: {status: 'failed'}, $inc: {__v: 1}, $push: {attempts: {error: reason.message}} })
    }
  } finally {
    cb()
  }
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
        collection = cli.db(config.mongo.db).collection(config.mongo.collection)
        queue.pull(config.sqs.queueName, config.sqs.workers, function (invoice, callback) {
          porcessCharge(invoice, callback)
        })
      }
    })
  } catch (error) {
    return false
  }
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
reminder.start()
