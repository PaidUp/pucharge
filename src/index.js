import { MongoClient, ObjectID } from 'mongodb'
import config from './config/environment'
import sqs from 'sqs'
import strp from 'stripe'
const stripe = strp(config.stripe.key)
const queue = sqs(config.sqs.credentials)

function updateInvoice (invoice, charge) {
  return new Promise((resolve, reject) => {
    let client
    charge.created = new Date()
    try {
      MongoClient.connect(config.mongo.url, (err, cli) => {
        client = cli
        if (err) return reject(err)
        const col = client.db(config.mongo.db).collection(config.mongo.collection)
        col.updateOne({ _id: ObjectID(invoice) }, { $set: {status: charge.status}, $inc: {__v: 1}, $push: {attempts: charge} }, function (err, r) {
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

function charge ({amount, paidupFee, externalCustomerId, externalPaymentMethodId, connectAccount, description, statementDescriptor, metadata}) {
  return new Promise((resolve, reject) => {
    stripe.charges.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      source: externalPaymentMethodId, // cardId
      customer: externalCustomerId, // cus_xx
      destination: connectAccount, // acc_xx
      description: description,
      application_fee: Math.round(paidupFee * 100),
      statement_descriptor: statementDescriptor,
      metadata
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
  queue.pull(config.sqs.queueName, config.sqs.workers, function (invoice, callback) {
    const param = {
      amount: invoice.price,
      paidupFee: invoice.paidupFee,
      externalPaymentMethodId: invoice.paymentDetails.externalPaymentMethodId,
      externalCustomerId: invoice.paymentDetails.externalCustomerId,
      connectAccount: invoice.connectAccount,
      description: invoice.label,
      statementDescriptor: invoice.paymentDetails.statementDescriptor,
      metadata: {
        _invoice: invoice._id,
        _order: invoice.orderId,
        invoiceId: invoice.invoiceId,
        userId: invoice.user.userId
      }
    }
    charge(param)
      .then(charge => updateInvoice(invoice._id, charge))
      .then(res => {
        callback()
      })
      .catch(reason => {
        if (reason.type) {
          updateInvoice(invoice._id, {
            type: reason.type,
            message: reason.message,
            code: reason.code,
            statusCode: reason.statusCode,
            status: 'failed'
          }).then(res => callback()).catch(reason => callback())
        } else {
          updateInvoice(invoice._id, {
            error: reason,
            status: 'failed'
          }).then(res => callback()).catch(reason => callback())
        }
      })
  })
}

pull()
