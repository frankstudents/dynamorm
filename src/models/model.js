import AWS from 'aws-sdk'


const docClient = new AWS.DynamoDB.DocumentClient({
  region: 'eu-west-1'
})

export class Model {
  constructor(fields, initialValues={}) {
    if (typeof fields !== 'object' || fields === null) {
      throw new Error('No fields object provided!')
    }

    this.fields = fields
    this.set(initialValues)
  }

  get(...fields) {
    const fieldNames = fields.length ? fields : Object.keys(this.fields)
    const values = {}

    for (const fieldName of fieldNames) {
      if (!this.fields.hasOwnProperty(fieldName)) {
        throw new Error(`Field ${fieldName} not found.`)
      }
      values[fieldName] = this.fields[fieldName].value
    }

    return values
  }

  getValidationErrors() {
    return Object.entries(this.fields).map((f) => {
      const name = f[0]
      const field = f[1]
      return (
        field.validate() ?
        null :
        {
          name,
          errors: field.getValidationErrors(),
          value: field.value
        }
      )
    }).filter((f) => f !== null)
  }

  getFieldValues() {
    const fields = {}
    for (const field of Object.entries(this.fields)) {
      fields[field[0]] = field[1].value
    }
    return fields
  }


  set(fieldValues) {
    for (const fv of Object.entries(fieldValues)) {
      const name = fv[0]
      const value = fv[1]
      if (this.fields.hasOwnProperty(name)) {
        this.fields[name].value = value
      } else {
        throw new Error('No such field: ' + name)
      }
    }
    return this
  }

  validate() {
    return this.getValidationErrors().length === 0
  }

}

export class DbModel extends Model {
  static dbGet(options={}) {
    const { key } = options
    if (!key) {
      throw new Error('No key provided')
    }
    delete options.key

    const params = {
      TableName: this.getTableName(),
      Key: key,
      ...options
    }

    return docClient.get(params).promise()
      .then((resp) => (
        resp.Item
      ))
  }

  static getTableName() {
    const prefix = [process.env.project, process.env.stage]
      .filter((p) => p !== undefined)
      .join('-')
    return this.tableName || `${prefix}-${this.name}`
  }

  constructor(fields, initialValues={}) {
    super(fields, initialValues)
    const partitionKey = Object.entries(fields).find((f) => (
      f[1].partitionKey || f[1].hashKey
    ))

    const sortKey = Object.entries(fields).find((f) => (
      f[1].sortKey
    ))

    this.primaryKey = { partitionKey, sortKey }
  }

  dbSave(options={}) {
    const params = {
      TableName: this.constructor.getTableName(),
      Item: this.getFieldValues(),
      ReturnValues: 'NONE',
      ...options
    }

    return new Promise((resolve, reject) => {
      if (this.validate()) {
        return docClient.put(params).promise()
          .then((data) => {
            return resolve(data)
          })
          .catch((error) => {
            return reject(error)
          })
      }
      return reject('Invalid field data')
    })
  }

}

