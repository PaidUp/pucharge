import { Logger, Email } from 'pu-common'
import schedule from 'node-schedule'
import { MongoClient } from 'mongodb'
import config from './config/environment'
import CommonUtil from './commonUtil'

const dayMs = 86400000

function getInvoices (invoice, charge) {
  return new Promise((resolve, reject) => {
    const ms = new Date().getTime() + (dayMs * config.email.templates.reminder.days)
    const floorDate = new Date(ms)
    const topDate = new Date(ms + dayMs)
    let client
    try {
      MongoClient.connect(config.mongo.url, (err, cli) => {
        client = cli
        if (err) return reject(err)
        const col = client.db(config.mongo.db).collection(config.mongo.collection)
        col.find({'status': 'autopay', 'dateCharge': {'$gte': floorDate, '$lt': topDate}}).toArray((err, docs) => {
          if (err) return reject(err)
          client.close()
          resolve(docs)
        })
      })
    } catch (error) {
      client.close()
      reject(error)
    }
  })
}

export default class Reminder {
  constructor ({ apiKey, fromName, fromEmail }) {
    this.email = new Email({ apiKey, fromName, fromEmail })
  }

  start () {
    this.cron = schedule.scheduleJob(config.email.templates.reminder.cron, () => {
      Logger.info('Start invoice remainder')
      getInvoices().then(docs => {
        docs.forEach(invoice => {
          this.email.sendTemplate(invoice.user.userEmail, config.email.templates.reminder.id, {
            invoiceId: invoice.invoiceId,
            invoiceURL: config.email.templates.reminder.baseUrl + '/' + invoice.beneficiaryId,
            orgName: invoice.organizationName,
            userFirstName: invoice.user.userFirstName,
            beneficiaryFirstName: invoice.beneficiaryFirstName,
            beneficiaryLastName: invoice.beneficiaryLastName,
            productName: invoice.productName,
            invoices: CommonUtil.buildTableInvoice(invoice)
          })
          Logger.info('Send reminder invoice: ' + invoice.invoiceId)
        })
      }).catch(reason => {
        Logger.warning(reason)
      })
    })
  }
}
