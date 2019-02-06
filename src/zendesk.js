import config from '@/config/environment'
import zendesk from 'node-zendesk'

const client = zendesk.createClient({
  username: config.zendesk.username,
  token: config.zendesk.token,
  remoteUri: `https://${config.zendesk.subdomain}.zendesk.com/api/v2`
})
const ticketReasonCategoryId = config.zendesk.customFields.ticketReasonCategory
const balanceId = config.zendesk.customFields.balance
const paymentLinkId = config.zendesk.customFields.paymentLink
const invoiceIdId = config.zendesk.customFields.invoiceId

function getSubject (invoice) {
  return `Your ${invoice.organizationName} payment for ${invoice.beneficiaryFirstName + ' ' + invoice.beneficiaryLastName} was declined today.`
}

function getBody (invoice) {
  return `
  <div>
    <div>Hey ${invoice.user.userFirstName},</div>
    <br />
    <div>Your ${invoice.organizationName} payment for ${invoice.price} was declined today.</div>
    <div>&nbsp;</div>
    <div>If you have received a new payment account and need to update your payment information, you can do so online by following the steps outlined below. If your form of payment is still valid, please ensure that sufficient funds are available for the transaction and then retry the transaction.</div>
    <div>&nbsp;</div>
    <div>IMPORTANT: Do not visit the "Pay New Invoice" section but rather view the failed invoice from the "Player Payment History" section.</div>
    <div>&nbsp;</div>
    <div>Visit this help article: How do I retry a failed payment?</div>
    <div>&nbsp;</div>
    <div>1. Visit <a href="${invoice.invoiceId}" target="_blank" rel="noopener">${invoice.invoiceId}</a> and login to your account</div>
    <div>2. Hit "FIX" on the failed invoice and retry the payment on the same payment account or add a new payment account and hit "RETRY"</div>
    <div>&nbsp;</div>
    <div>If you have any questions or issues, please let me know.</div>
    <div>&nbsp;</div>
    <div>Thanks.</div>
  </div>
  `
}

export default class Zendesk {
  static ticketsCreate (invoice) {
    const subject = getSubject(invoice)
    const comment = getBody(invoice)
    const requesterEmail = invoice.user.userEmail
    const requesterName = invoice.user.userFirstNamee + '' + invoice.user.userLastName
    const balance = invoice.price
    const invoiceId = invoice.invoiceId

    return new Promise((resolve, reject) => {
      let customFields = [
        { id: ticketReasonCategoryId, value: 'ticket_category_payment_failed_new_card' },
        { id: balanceId, value: balance },
        { id: paymentLinkId, value: invoiceId },
        { id: invoiceIdId, value: invoiceId }
      ]

      client.tickets.create({
        ticket: {
          subject,
          requester: {
            email: requesterEmail,
            name: requesterName
          },
          comment: {
            html_body: comment
          },
          // status,
          // priority: ticketPriority,
          assignee: config.zendesk.assignee,
          // tags: ticketTags,
          isPublic: true,
          custom_fields: customFields
        }
      }, (error, req, result) => {
        if (error) return reject(error)
        resolve(result)
      })
    })
  }

  static search (queryStr) {
    return new Promise((resolve, reject) => {
      client.search.query(queryStr, (error, req, results) => {
        if (error) return reject(error)
        resolve(results)
      })
    })
  }

  static ticketsUpdate (id, values) {
    return new Promise((resolve, reject) => {
      client.tickets.update(id, values, (error, data) => {
        if (error) return reject(error)
        resolve(data)
      })
    })
  }
}
