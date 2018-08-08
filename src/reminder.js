import { Logger, Email } from 'pu-common'
import schedule from 'node-schedule'
import { MongoClient } from 'mongodb'
import config from './config/environment'
import moment from 'moment'
import numeral from 'numeral'

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

function buildTableInvoice (invoice) {
  let row = `<tr>
  <td>${invoice.label}</td>
  <td>${moment(invoice.dateCharge).format('MM-DD-YYYY')}</td>
  <td>$${numeral(invoice.price).format('0,0.00')}</td>
  <td>${invoice.paymentDetails.brand}••••${invoice.paymentDetails.last4}</td>
  <td>${capitalize(invoice.status)}</td></tr>`
  return `<table style="width: 100%; font-style: normal; font-variant-ligatures: normal; font-variant-caps: normal; font-weight: 300; font-family: helvetica, arial, sans-serif; font-size: 14px; color: rgb(102, 102, 102);">
    <thead>
      <tr>
        <th style="font-weight: bold">Description</th>
        <th style="font-weight: bold">Date</th>
        <th style="font-weight: bold">Price</th>
        <th style="font-weight: bold">Account</th>
        <th style="font-weight: bold">Status</th>
      </tr>
    </thead>
    <tbody>
      ${row}
    </tbody>
    </table>`
}

function capitalize (value) {
  return value.replace(
    /\w\S*/g,
    function (txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    }
  )
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
            invoices: buildTableInvoice(invoice)
          })
          Logger.info('Send reminder invoice: ' + invoice.invoiceId)
        })
      }).catch(reason => {
        Logger.warning(reason)
      })
    })
  }
}
