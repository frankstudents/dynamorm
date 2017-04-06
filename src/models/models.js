import AWS from 'aws-sdk'


const docClient = new AWS.DynamoDB.DocumentClient({
  region: 'eu-west-1'
})

export class Model {
  constructor(schema={}, initialValues={}) {
    // Commented out because of babel bug
		/*
		if (new.target === Model) {
      throw new TypeError('Cannot construct Model instances directly')
    }
		*/
    this._schema = schema
    this.populate(initialValues)
  }

  populate(values) {
    for (const v of Object.entries(values)) {
      const name = v[0]
      const value = v[1]
      if (this._schema.meta.props.hasOwnProperty(name)) {
        this[name] = value
      }
    }

    return this
  }

  getAttributes() {
    const attributes = {}
    for (const prop of Object.entries(this._schema.meta.props)) {
      const name = prop[0]
      if (Object.keys(this).includes(name)) {
        attributes[name] = this[name]
      }
    }
    return attributes
  }

  validate() {
    try {
      new this._schema(this)
      this.errorMessage = null
      return true
    } catch (err) {
      this.errorMessage = err.message
      return false
    }
  }
}

export class DbModel extends Model {
  constructor(schema={}, initialValues={}) {
    // Commented out because of babel bug
		/*
		if (new.target === DbModel) {
      throw new TypeError('Cannot construct DbModel instances directly')
    }
		*/
    super(schema, initialValues)

    const tableName = [process.env.project, process.env.stage, this.constructor.name]
      .filter((p) => p !== undefined)
      .join('-')
    this.setTableName(tableName)

    this.getHashKey = this.getPartitionKey
    this.setHashKey = this.setPartitionKey
  }

  setTableName(tableName) {
    this._tableName = tableName
    return this
  }

  getTableName() {
    return this._tableName
  }

  setPartitionKey(partitionKey) {
    this._partitionKey = partitionKey
  }

  getPartitionKey() {
    return this._partitionKey
  }

  setSortKey(sortKey) {
    this._sortKey = sortKey
  }

  getSortKey() {
    return this._sortKey
  }

  save() {
    return DbModel._putDocument(this)
  }

  static async findByPk(partitionKey, sortKey) {
    const model = new this()
    const params = { Key: {} }
    params.Key[model.getPartitionKey()] = partitionKey
    if (sortKey) {
      params.Key[model.getSortKey()] = sortKey
    }
    const item = await DbModel._getDocument(model, params)
    return model.populate(item)
  }

  static _getDocument(model, opts={}) {
    const params = {
      TableName: model.getTableName(),
      ...opts
    }

    return docClient.get(params).promise()
      .then((resp) => (resp.Item))
  }

  static _putDocument(model) {
    return new Promise((resolve, reject) => {
      if (!model.validate()) {
        return reject(new Error(model.getValidationErrors()[0]))
      }

      const params = {
        TableName: model.getTableName(),
        Item: model.getAttributes(),
        ReturnValues: 'NONE'
      }

      return docClient.put(params).promise()
        .then((data) => resolve(data))
        .catch((error) => reject(error))
    })
  }
}

