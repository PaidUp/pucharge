import moment from 'moment'
import numeral from 'numeral'

function capitalize (value) {
  return value.replace(
    /\w\S*/g,
    function (txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    }
  )
}

export default class CommonUtil {
  static buildTableInvoice (invoice) {
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
}
