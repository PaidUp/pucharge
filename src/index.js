import { MongoClient } from 'mongodb'
import config from './config/environment'
import sqs from 'sqs'
import strp from 'stripe'
const stripe = strp(config.stripe.key)
const queue = sqs(config.sqs.credentials)

function updateInvoice (charge) {
  return new Promise((resolve, reject) => {
    try {
      MongoClient.connect(config.mongo.url, (err, db) => {
        if (err) return reject(err)
        resolve(db)
      })
    } catch (error) {
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
      if (err) return reject(err)
      return resolve(charge)
    })
  })
}

function pull () {
  queue.pull(config.sqs.queueName, config.sqs.workers, function (invoice, callback) {
    const param = {
      amount: invoice.price,
      paidupFee: invoice.paidupFee,
      externalCustomerId: invoice.paymentDetails.externalPaymentMethodId,
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
      .then(charge => updateInvoice(charge))
      .then(res => callback())
      .catch(reason => {
        console.log(reason)
        callback()
      })
  })
}

pull()
